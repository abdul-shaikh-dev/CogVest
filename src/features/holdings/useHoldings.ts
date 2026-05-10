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

type UseHoldingsInput = {
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export type UseHoldingsResult = {
  failures: QuoteRefreshFailure[];
  holdings: Holding[];
  isRefreshing: boolean;
  maskWealthValues: boolean;
  refresh: () => Promise<QuoteRefreshResult>;
  rollupRows: ConsolidatedHoldingRow[];
  rollupTotals: PortfolioRollupTotals;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function withQuoteMetadata(
  holdings: Holding[],
  quoteCache: PortfolioStoreState["quoteCache"],
) {
  return holdings.map((holding) => {
    const quote = quoteCache[holding.asset.id];

    return {
      ...holding,
      dayChangePct: quote?.dayChangePct,
      lastUpdated: quote?.asOf,
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

  return {
    failures,
    holdings,
    isRefreshing,
    maskWealthValues: snapshot.preferences.maskWealthValues,
    refresh,
    rollupRows,
    rollupTotals,
  };
}
