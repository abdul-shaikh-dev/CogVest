import { useState, useSyncExternalStore } from "react";
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
import {
  getPortfolioCurrencyIssues,
  isV1CompatibleQuote,
  type PortfolioCurrencyIssue,
} from "@/src/domain/portfolioCurrency";
import {
  refreshQuotes as defaultRefreshQuotes,
  type QuoteRefreshFailure,
  type QuoteRefreshResult,
  type RefreshQuotesInput,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Holding } from "@/src/types";
import {
  getCalendarDatePart,
  isEffectiveCalendarDate,
} from "@/src/domain/dates";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type DashboardHolding = Holding & {
  quoteSource?: string;
};

type UseDashboardInput = {
  now?: Date;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export type DashboardMonthlyMetrics = {
  cashAdded: number;
  cashChange: number;
  investment: number;
  savingsRate: number | null;
};

export type DashboardState = {
  allocation: AllocationItem[];
  cashBalance: number;
  convictionReadiness: ConvictionReadiness;
  currencyIssues: PortfolioCurrencyIssue[];
  dayChange: PortfolioDayChange;
  holdings: Holding[];
  instrumentAllocation: MetadataAllocationItem[];
  isRefreshing: boolean;
  latestQuoteAsOf?: string;
  latestQuoteSource?: string;
  maskWealthValues: boolean;
  monthlyMetrics: DashboardMonthlyMetrics;
  quoteFailures: QuoteRefreshFailure[];
  refresh: () => Promise<QuoteRefreshResult>;
  rollupRows: ConsolidatedHoldingRow[];
  rollupTotals: PortfolioRollupTotals;
  sectorAllocation: MetadataAllocationItem[];
  toggleMaskWealthValues: () => void;
  totalValue: number;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function withQuoteMetadata(
  holdings: Holding[],
  quoteCache: PortfolioStoreState["quoteCache"],
): DashboardHolding[] {
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

function getLatestQuote(holdings: DashboardHolding[]) {
  return holdings
    .map((holding) => {
      if (!holding.lastUpdated) {
        return null;
      }

      return {
        asOf: holding.lastUpdated,
        source: holding.quoteSource,
      };
    })
    .filter((value): value is { asOf: string; source: string } => Boolean(value))
    .sort(
      (left, right) =>
        new Date(right.asOf).getTime() - new Date(left.asOf).getTime(),
    )[0];
}

function isSameMonth(isoDate: string, now: Date) {
  const calendarDate = getCalendarDatePart(isoDate);

  return (
    calendarDate !== null &&
    isEffectiveCalendarDate(calendarDate, now) &&
    calendarDate.slice(0, 7) ===
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
}

function calculateMonthlyMetrics(
  state: PortfolioStoreState,
  now: Date,
  supportedAssetIds: Set<string>,
): DashboardMonthlyMetrics {
  const tradeInvestment = state.trades
    .filter(
      (trade) =>
        supportedAssetIds.has(trade.assetId) &&
        trade.type === "buy" &&
        isSameMonth(trade.date, now),
    )
    .reduce((total, trade) => total + trade.totalValue, 0);
  const openingInvestment = state.openingPositions
    .filter(
      (position) =>
        supportedAssetIds.has(position.assetId) &&
        isSameMonth(position.date, now),
    )
    .reduce(
      (total, position) =>
        total + position.quantity * position.averageCostPrice,
      0,
    );
  const cashAdded = state.cashEntries
    .filter((entry) => entry.type === "addition" && isSameMonth(entry.date, now))
    .reduce((total, entry) => total + entry.amount, 0);
  const cashWithdrawn = state.cashEntries
    .filter((entry) => entry.type === "withdrawal" && isSameMonth(entry.date, now))
    .reduce((total, entry) => total + entry.amount, 0);
  const investment = tradeInvestment + openingInvestment;

  return {
    cashAdded,
    cashChange: cashAdded - cashWithdrawn,
    investment,
    savingsRate:
      cashAdded > 0
        ? Number(((investment / cashAdded) * 100).toFixed(2))
        : null,
  };
}

export function useDashboard({
  now = new Date(),
  refreshQuotes = defaultRefreshQuotes,
  store = getPortfolioStore(),
}: UseDashboardInput = {}): DashboardState {
  const snapshot = usePortfolioSnapshot(store);
  const [quoteFailures, setQuoteFailures] = useState<QuoteRefreshFailure[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currencyIssues = getPortfolioCurrencyIssues(
    snapshot.assets,
    snapshot.quoteCache,
  );
  const supportedAssetIds = new Set(
    snapshot.assets
      .filter((asset) =>
        isV1CompatibleQuote(asset, snapshot.quoteCache[asset.id]),
      )
      .map((asset) => asset.id),
  );
  const holdings = withQuoteMetadata(
    calculateHoldings({
      assets: snapshot.assets,
      openingPositions: snapshot.openingPositions,
      quoteCache: snapshot.quoteCache,
      trades: snapshot.trades,
      now,
    }),
    snapshot.quoteCache,
  );
  const cashBalance = calculateCashBalance(snapshot.cashEntries, now);
  const rollupRows = calculateConsolidatedHoldingRows(holdings);
  const rollupTotals = calculatePortfolioRollupTotals(rollupRows, cashBalance);
  const latestQuote = getLatestQuote(holdings);

  async function refresh() {
    setIsRefreshing(true);

    try {
      const currentState = store.getState();
      const result = await refreshQuotes({
        assets: currentState.assets,
        cachedQuotes: currentState.quoteCache,
      });

      for (const quote of Object.values(result.quoteCache)) {
        store.getState().upsertQuote(quote);
      }

      setQuoteFailures(result.failures);

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
    allocation: calculateAllocation({
      cashBalance,
      holdings,
    }),
    cashBalance,
    convictionReadiness: getConvictionReadiness(
      snapshot.trades.filter((trade) => supportedAssetIds.has(trade.assetId)),
      undefined,
      snapshot.openingPositions.filter((position) =>
        supportedAssetIds.has(position.assetId),
      ),
    ),
    currencyIssues,
    dayChange: calculatePortfolioDayChange(holdings),
    holdings,
    instrumentAllocation: calculateInstrumentAllocation(holdings),
    isRefreshing,
    latestQuoteAsOf: latestQuote?.asOf,
    latestQuoteSource: latestQuote?.source,
    maskWealthValues: snapshot.preferences.maskWealthValues,
    monthlyMetrics: calculateMonthlyMetrics(snapshot, now, supportedAssetIds),
    quoteFailures,
    refresh,
    rollupRows,
    rollupTotals,
    sectorAllocation: calculateSectorAllocation(holdings),
    toggleMaskWealthValues,
    totalValue: calculatePortfolioTotal(holdings, snapshot.cashEntries, now),
  };
}
