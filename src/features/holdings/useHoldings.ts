import { useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateConsolidatedHoldingRows,
  calculateHoldings,
  calculatePortfolioRollupTotals,
  type ConsolidatedHoldingRow,
  type PortfolioRollupTotals,
} from "@/src/domain/calculations";
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
import type { Holding, OpeningPosition, Trade } from "@/src/types";

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
  failed: QuoteRefreshFailure[];
  holdings: HoldingWithQuoteMetadata[];
  isRefreshing: boolean;
  maskWealthValues: boolean;
  openingPositions: OpeningPosition[];
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
      lastUpdated: quote?.asOf,
      quoteSource: quote?.source,
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
  const holdings = withQuoteMetadata(
    calculateHoldings({
      assets: snapshot.assets,
      openingPositions: snapshot.openingPositions,
      quoteCache: snapshot.quoteCache,
      trades: snapshot.trades,
    }),
    snapshot.quoteCache,
  );
  const quoteFreshness = summarizeQuoteFreshness(
    holdings
      .filter((holding) => holding.asset.assetClass !== "cash")
      .map((holding) => holding.asset.id),
    snapshot.quoteCache,
    now,
  );
  const rollupRows = calculateConsolidatedHoldingRows(holdings);
  const rollupTotals = calculatePortfolioRollupTotals(rollupRows);

  async function refresh() {
    setIsRefreshing(true);

    try {
      const currentState = store.getState();
      const heldAssetIds = new Set(
        calculateHoldings({
          assets: currentState.assets,
          openingPositions: currentState.openingPositions,
          quoteCache: currentState.quoteCache,
          trades: currentState.trades,
          now,
        }).map((holding) => holding.asset.id),
      );
      const result = await refreshQuotes({
        assets: currentState.assets.filter((asset) =>
          heldAssetIds.has(asset.id),
        ),
        cachedQuotes: currentState.quoteCache,
      });

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
    failed,
    holdings,
    isRefreshing,
    maskWealthValues: snapshot.preferences.maskWealthValues,
    openingPositions: snapshot.openingPositions,
    refresh,
    quoteFreshness,
    rollupRows,
    rollupTotals,
    toggleMaskWealthValues,
    timedOut,
    trades: snapshot.trades,
  };
}
