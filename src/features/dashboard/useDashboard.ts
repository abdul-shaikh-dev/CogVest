import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateAllocation,
  calculateCashBalance,
  calculateConsolidatedHoldingRows,
  calculateHoldings,
  calculateInstrumentAllocation,
  calculatePortfolioDayChange,
  calculatePortfolioRollupTotals,
  calculatePortfolioTotal,
  calculateSectorAllocation,
  getConvictionReadiness,
  type AllocationItem,
  type ConsolidatedHoldingRow,
  type ConvictionReadiness,
  type MetadataAllocationItem,
  type PortfolioDayChange,
  type PortfolioRollupTotals,
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
  instrumentAllocation: MetadataAllocationItem[];
  latestQuoteAsOf?: string;
  maskWealthValues: boolean;
  rollupRows: ConsolidatedHoldingRow[];
  rollupTotals: PortfolioRollupTotals;
  sectorAllocation: MetadataAllocationItem[];
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
      openingPositions: snapshot.openingPositions,
      quoteCache: snapshot.quoteCache,
      trades: snapshot.trades,
    }),
    snapshot.quoteCache,
  );
  const cashBalance = calculateCashBalance(snapshot.cashEntries);
  const rollupRows = calculateConsolidatedHoldingRows(holdings);
  const rollupTotals = calculatePortfolioRollupTotals(rollupRows, cashBalance);

  return {
    allocation: calculateAllocation({
      cashBalance,
      holdings,
    }),
    cashBalance,
    convictionReadiness: getConvictionReadiness(
      snapshot.trades,
      undefined,
      snapshot.openingPositions,
    ),
    dayChange: calculatePortfolioDayChange(holdings),
    holdings,
    instrumentAllocation: calculateInstrumentAllocation(holdings),
    latestQuoteAsOf: getLatestQuoteAsOf(holdings),
    maskWealthValues: snapshot.preferences.maskWealthValues,
    rollupRows,
    rollupTotals,
    sectorAllocation: calculateSectorAllocation(holdings),
    totalValue: calculatePortfolioTotal(holdings, snapshot.cashEntries),
  };
}
