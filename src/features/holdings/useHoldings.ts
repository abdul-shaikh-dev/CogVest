import { useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateConsolidatedHoldingRows,
  calculateHoldings,
  calculatePortfolioRollupTotals,
  type ConsolidatedHoldingRow,
  type PortfolioRollupTotals,
} from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import {
  calculatePpfPortfolioSummary,
  getLinkedLegacyPpfAssetIds,
  type PpfPortfolioSummary,
} from "@/src/domain/ppf";
import {
  refreshQuotes as defaultRefreshQuotes,
  type QuoteRefreshFailure,
  type QuoteRefreshResult,
  type QuoteRefreshTimeout,
  type QuoteFreshnessSummary,
  type RefreshQuotesInput,
  summarizeQuoteFreshness,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Asset, DisplayMode, Holding, OpeningPosition, Trade } from "@/src/types";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type HoldingWithQuoteMetadata = Holding & {
  quoteSource?: string;
};

type UseHoldingsInput = {
  now?: Date;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export type UseHoldingsResult = {
  assets: Asset[];
  displayMode: DisplayMode;
  failed: QuoteRefreshFailure[];
  holdings: HoldingWithQuoteMetadata[];
  isRefreshing: boolean;
  maskWealthValues: boolean;
  openingPositions: OpeningPosition[];
  ppfSummary: PpfPortfolioSummary;
  refresh: () => Promise<QuoteRefreshResult>;
  quoteFreshness: QuoteFreshnessSummary;
  timedOut: QuoteRefreshTimeout[];
  rollupRows: ConsolidatedHoldingRow[];
  rollupTotals: PortfolioRollupTotals;
  toggleMaskWealthValues: () => void;
  trades: Trade[];
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function withQuoteMetadata(
  holdings: Holding[],
  quoteCache: PortfolioStoreState["quoteCache"],
): HoldingWithQuoteMetadata[] {
  return holdings.map((holding) => {
    const quote = quoteCache[holding.asset.id];

    return {
      ...holding,
      dayChangePct: quote?.dayChangePct,
      lastUpdated:
        quote?.asOf ??
        (holding.valuation.status === "manual"
          ? holding.valuation.asOf ?? undefined
          : undefined),
      quoteSource:
        quote?.source ??
        (holding.valuation.status === "manual" ? "manual" : undefined),
    };
  });
}

export function useHoldings({
  now = new Date(),
  refreshQuotes = defaultRefreshQuotes,
  store = getPortfolioStore(),
}: UseHoldingsInput = {}): UseHoldingsResult {
  const snapshot = usePortfolioSnapshot(store);
  const [failed, setFailed] = useState<QuoteRefreshFailure[]>([]);
  const [timedOut, setTimedOut] = useState<QuoteRefreshTimeout[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const asOf = formatLocalCalendarDate(now);
  const ppfSummary = calculatePpfPortfolioSummary({
    accounts: snapshot.ppfAccounts,
    asOf,
    entries: snapshot.ppfLedgerEntries,
  });
  const linkedLegacyAssetIds = getLinkedLegacyPpfAssetIds(snapshot.ppfAccounts, asOf);
  const holdings = withQuoteMetadata(
    calculateHoldings({
      assets: snapshot.assets,
      openingPositions: snapshot.openingPositions,
      quoteCache: snapshot.quoteCache,
      trades: snapshot.trades,
    }),
    snapshot.quoteCache,
  ).filter(
    (holding) => !linkedLegacyAssetIds.has(holding.asset.id),
  );
  const quoteFreshness = summarizeQuoteFreshness(
    holdings
      .filter((holding) => holding.asset.assetClass !== "cash")
      .map((holding) => holding.asset.id),
    snapshot.quoteCache,
    now,
  );
  const rollupRows = calculateConsolidatedHoldingRows(holdings);
  const rollupTotals = calculatePortfolioRollupTotals(
    rollupRows,
    0,
    holdings,
    ppfSummary,
  );

  async function refresh() {
    setIsRefreshing(true);

    try {
      const currentState = store.getState();
      const currentAsOf = formatLocalCalendarDate(now);
      const currentLinkedLegacyAssetIds = getLinkedLegacyPpfAssetIds(
        currentState.ppfAccounts,
        currentAsOf,
      );
      const heldAssetIds = new Set(
        calculateHoldings({
          assets: currentState.assets,
          openingPositions: currentState.openingPositions,
          quoteCache: currentState.quoteCache,
          trades: currentState.trades,
          now,
        })
          .filter((holding) => !currentLinkedLegacyAssetIds.has(holding.asset.id))
          .map((holding) => holding.asset.id),
      );
      const result = await refreshQuotes({
        assets: currentState.assets.filter((asset) =>
          heldAssetIds.has(asset.id),
        ),
        cachedQuotes: currentState.quoteCache,
      });

      if (store.getState().restoreEpoch !== currentState.restoreEpoch) return result;
      for (const quote of Object.values(result.quoteCache)) {
        store.getState().upsertQuote(quote);
      }

      setFailed(result.failed);
      setTimedOut(result.timedOut);

      return result;
    } finally {
      setIsRefreshing(false);
    }
  }

  function toggleMaskWealthValues() {
    store.getState().updatePreferences({
      maskWealthValues: !store.getState().preferences.maskWealthValues,
    });
  }

  return {
    assets: snapshot.assets,
    displayMode: snapshot.preferences.displayMode,
    failed,
    holdings,
    isRefreshing,
    maskWealthValues: snapshot.preferences.maskWealthValues,
    openingPositions: snapshot.openingPositions,
    ppfSummary,
    refresh,
    quoteFreshness,
    rollupRows,
    rollupTotals,
    toggleMaskWealthValues,
    timedOut,
    trades: snapshot.trades,
  };
}
