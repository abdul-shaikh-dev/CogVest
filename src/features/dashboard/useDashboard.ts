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
  decimal,
  normalizeMoney,
  normalizePercentage,
  sumFinancialValues,
} from "@/src/domain/precision";
import { isTradeCashPurchase } from "@/src/domain/transactionSemantics";
import { isTransactionAfterOpeningCutover } from "@/src/domain/openingPositions";
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
import type { DisplayMode, Holding } from "@/src/types";
import {
  getCalendarDatePart,
  formatLocalCalendarDate,
  isEffectiveCalendarDate,
} from "@/src/domain/dates";
import {
  calculatePpfPortfolioSummary,
  getLinkedLegacyPpfAssetIds,
} from "@/src/domain/ppf";

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
  displayMode: DisplayMode;
  holdings: Holding[];
  instrumentAllocation: MetadataAllocationItem[];
  isRefreshing: boolean;
  maskWealthValues: boolean;
  monthlyMetrics: DashboardMonthlyMetrics;
  quoteFailed: QuoteRefreshFailure[];
  quoteFreshness: QuoteFreshnessSummary;
  quoteTimedOut: QuoteRefreshTimeout[];
  refresh: () => Promise<QuoteRefreshResult>;
  rollupRows: ConsolidatedHoldingRow[];
  rollupTotals: PortfolioRollupTotals;
  sectorAllocation: MetadataAllocationItem[];
  toggleMaskWealthValues: () => void;
  totalValue: number | null;
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
  const tradeInvestment = sumFinancialValues(
    state.trades
      .filter(isTradeCashPurchase)
      .filter(
        (trade) =>
          supportedAssetIds.has(trade.assetId) &&
          isSameMonth(trade.date, now) &&
          isTransactionAfterOpeningCutover(
            trade.date,
            state.openingPositions.filter(
              (position) => position.assetId === trade.assetId,
            ),
          ),
      )
      .map((trade) => trade.totalValue),
  );
  const openingInvestment = state.openingPositions
    .filter(
      (position) =>
        supportedAssetIds.has(position.assetId) &&
        position.date !== null &&
        isSameMonth(position.date, now),
    )
    .reduce(
      (total, position) =>
        total.plus(decimal(position.quantity).times(position.averageCostPrice)),
      decimal(0),
    );
  const cashAdded = sumFinancialValues(
    state.cashEntries
      .filter(
        (entry) => entry.type === "addition" && isSameMonth(entry.date, now),
      )
      .map((entry) => entry.amount),
  );
  const cashWithdrawn = sumFinancialValues(
    state.cashEntries
      .filter(
        (entry) => entry.type === "withdrawal" && isSameMonth(entry.date, now),
      )
      .map((entry) => entry.amount),
  );
  const investment = tradeInvestment.plus(openingInvestment);
  const ppfInvestment = sumFinancialValues(
    state.ppfLedgerEntries
      .filter(
        (entry) => entry.type === "contribution" && isSameMonth(entry.date, now),
      )
      .map((entry) => (entry.type === "contribution" ? entry.amount : 0)),
  );
  const totalInvestment = investment.plus(ppfInvestment);

  return {
    cashAdded: normalizeMoney(cashAdded),
    cashChange: normalizeMoney(cashAdded.minus(cashWithdrawn)),
    investment: normalizeMoney(totalInvestment),
    savingsRate:
      cashAdded.greaterThan(0)
        ? normalizePercentage(totalInvestment.dividedBy(cashAdded).times(100))
        : null,
  };
}

export function useDashboard({
  now = new Date(),
  refreshQuotes = defaultRefreshQuotes,
  store = getPortfolioStore(),
}: UseDashboardInput = {}): DashboardState {
  const snapshot = usePortfolioSnapshot(store);
  const [quoteFailed, setQuoteFailed] = useState<QuoteRefreshFailure[]>([]);
  const [quoteTimedOut, setQuoteTimedOut] = useState<QuoteRefreshTimeout[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currencyIssues = getPortfolioCurrencyIssues(
    snapshot.assets,
    snapshot.quoteCache,
  );
  const asOf = formatLocalCalendarDate(now);
  const linkedLegacyAssetIds = getLinkedLegacyPpfAssetIds(
    snapshot.ppfAccounts,
    asOf,
  );
  const supportedAssetIds = new Set(
    snapshot.assets
      .filter(
        (asset) =>
          !linkedLegacyAssetIds.has(asset.id) &&
          isV1CompatibleQuote(asset, snapshot.quoteCache[asset.id]),
      )
      .map((asset) => asset.id),
  );
  const ppfSummary = calculatePpfPortfolioSummary({
    accounts: snapshot.ppfAccounts,
    asOf,
    entries: snapshot.ppfLedgerEntries,
  });
  const holdings = withQuoteMetadata(
    calculateHoldings({
      assets: snapshot.assets,
      openingPositions: snapshot.openingPositions,
      quoteCache: snapshot.quoteCache,
      trades: snapshot.trades,
      now,
    }),
    snapshot.quoteCache,
  ).filter(
    (holding) => !linkedLegacyAssetIds.has(holding.asset.id),
  );
  const cashBalance = calculateCashBalance(snapshot.cashEntries, now);
  const rollupRows = calculateConsolidatedHoldingRows(holdings);
  const rollupTotals = calculatePortfolioRollupTotals(
    rollupRows,
    cashBalance,
    holdings,
    ppfSummary,
  );
  const quoteFreshness = summarizeQuoteFreshness(
    holdings
      .filter((holding) => holding.asset.assetClass !== "cash")
      .map((holding) => holding.asset.id),
    snapshot.quoteCache,
    now,
  );

  async function refresh() {
    setIsRefreshing(true);

    try {
      const currentState = store.getState();
      const currentLinkedLegacyAssetIds = getLinkedLegacyPpfAssetIds(
        currentState.ppfAccounts,
        formatLocalCalendarDate(now),
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

      for (const quote of Object.values(result.quoteCache)) {
        store.getState().upsertQuote(quote);
      }

      setQuoteFailed(result.failed);
      setQuoteTimedOut(result.timedOut);

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
      ppfConfirmedBalance: ppfSummary.confirmedBalance,
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
    displayMode: snapshot.preferences.displayMode,
    holdings,
    instrumentAllocation: calculateInstrumentAllocation(holdings),
    isRefreshing,
    maskWealthValues: snapshot.preferences.maskWealthValues,
    monthlyMetrics: calculateMonthlyMetrics(snapshot, now, supportedAssetIds),
    quoteFailed,
    quoteFreshness,
    quoteTimedOut,
    refresh,
    rollupRows,
    rollupTotals,
    sectorAllocation: calculateSectorAllocation(holdings),
    toggleMaskWealthValues,
    totalValue: calculatePortfolioTotal(
      holdings,
      snapshot.cashEntries,
      now,
      ppfSummary.confirmedBalance,
    ),
  };
}
