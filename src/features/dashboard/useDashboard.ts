import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateAllocation,
  calculateCashBalance,
  calculateHoldings,
  calculatePortfolioDayChange,
  calculatePortfolioTotal,
  getConvictionReadiness,
  type AllocationItem,
  type ConvictionReadiness,
  type PortfolioDayChange,
} from "@/src/domain/calculations";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Holding } from "@/src/types";

type UseDashboardInput = {
  store?: StoreApi<PortfolioStoreState>;
};

export type DashboardState = {
  allocation: AllocationItem[];
  cashBalance: number;
  convictionReadiness: ConvictionReadiness;
  dayChange: PortfolioDayChange;
  holdings: Holding[];
  latestQuoteAsOf?: string;
  maskWealthValues: boolean;
  totalValue: number;
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

function getLatestQuoteAsOf(holdings: Holding[]) {
  return holdings
    .map((holding) => holding.lastUpdated)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

export function useDashboard({
  store = getPortfolioStore(),
}: UseDashboardInput = {}): DashboardState {
  const snapshot = usePortfolioSnapshot(store);
  const holdings = withQuoteMetadata(
    calculateHoldings({
      assets: snapshot.assets,
      quoteCache: snapshot.quoteCache,
      trades: snapshot.trades,
    }),
    snapshot.quoteCache,
  );
  const cashBalance = calculateCashBalance(snapshot.cashEntries);

  return {
    allocation: calculateAllocation({
      cashBalance,
      holdings,
    }),
    cashBalance,
    convictionReadiness: getConvictionReadiness(snapshot.trades),
    dayChange: calculatePortfolioDayChange(holdings),
    holdings,
    latestQuoteAsOf: getLatestQuoteAsOf(holdings),
    maskWealthValues: snapshot.preferences.maskWealthValues,
    totalValue: calculatePortfolioTotal(holdings, snapshot.cashEntries),
  };
}
