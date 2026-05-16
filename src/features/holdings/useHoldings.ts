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
  type RefreshQuotesInput,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Holding } from "@/src/types";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type HoldingWithQuoteMetadata = Holding & {
  quoteSource?: string;
};

type UseHoldingsInput = {
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export type UseHoldingsResult = {
  failures: QuoteRefreshFailure[];
  holdings: HoldingWithQuoteMetadata[];
  isRefreshing: boolean;
  latestQuoteAsOf?: string;
  manualFallbackCount: number;
  maskWealthValues: boolean;
  refresh: () => Promise<QuoteRefreshResult>;
  rollupRows: ConsolidatedHoldingRow[];
  rollupTotals: PortfolioRollupTotals;
  toggleMaskWealthValues: () => void;
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

function selectManualPrices(state: PortfolioStoreState) {
  return Object.fromEntries(
    Object.entries(state.quoteCache).map(([assetId, quote]) => [
      assetId,
      quote.price,
    ]),
  );
}

function getLatestQuoteAsOf(holdings: HoldingWithQuoteMetadata[]) {
  return holdings
    .map((holding) => holding.lastUpdated)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function countManualFallbacks(holdings: HoldingWithQuoteMetadata[]) {
  return holdings.filter((holding) => holding.quoteSource === "manual").length;
}

export function useHoldings({
  refreshQuotes = defaultRefreshQuotes,
  store = getPortfolioStore(),
}: UseHoldingsInput = {}): UseHoldingsResult {
  const snapshot = usePortfolioSnapshot(store);
  const [failures, setFailures] = useState<QuoteRefreshFailure[]>([]);
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
  const rollupRows = calculateConsolidatedHoldingRows(holdings);
  const rollupTotals = calculatePortfolioRollupTotals(rollupRows);

  async function refresh() {
    setIsRefreshing(true);

    try {
      const currentState = store.getState();
      const result = await refreshQuotes({
        assets: currentState.assets,
        manualPrices: selectManualPrices(currentState),
      });

      for (const quote of Object.values(result.quoteCache)) {
        store.getState().upsertQuote(quote);
      }

      setFailures(result.failures);

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
    failures,
    holdings,
    isRefreshing,
    latestQuoteAsOf: getLatestQuoteAsOf(holdings),
    manualFallbackCount: countManualFallbacks(holdings),
    maskWealthValues: snapshot.preferences.maskWealthValues,
    refresh,
    rollupRows,
    rollupTotals,
    toggleMaskWealthValues,
  };
}
