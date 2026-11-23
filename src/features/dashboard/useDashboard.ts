import { useMemo } from "react";
import { summarizeEpfForReporting, includeEpfInPortfolioTotals, type EpfReportingSummary } from "@/src/domain/epf/reporting";
import { getLinkedLegacyEpfAssetIds } from "@/src/domain/epf/legacyLinks";
import type { StoreApi } from "zustand/vanilla";

import {
  calculateAllocation,
  calculateCashBalance,
  calculateConsolidatedHoldingRows,
  calculateHoldings,
  calculateInstrumentAllocation,
  calculatePortfolioDayChange,
  calculatePortfolioRollupTotals,
  calculateMonthlyInvestmentMetrics,
  calculateSectorAllocation,
  combineFuturesWithRollupTotals,
  getConvictionReadiness,
  type AllocationItem,
  type ConsolidatedHoldingRow,
  type ConvictionReadiness,
  type MetadataAllocationItem,
  type MonthlyInvestmentMetrics,
  type PortfolioDayChange,
  type PortfolioRollupTotals,
} from "@/src/domain/calculations";
import {
  getPortfolioCurrencyIssues,
  isV1CompatibleQuote,
  type PortfolioCurrencyIssue,
} from "@/src/domain/portfolioCurrency";
import {
  type QuoteRefreshFailure,
  type QuoteRefreshResult,
  type QuoteRefreshTimeout,
  type QuoteFreshnessSummary,
  summarizeQuoteFreshness,
} from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { XirrSummary } from "@/src/domain/xirrSummary";
import { wholePortfolioScope, wholePortfolioXirrSummary, xirrNames } from "./portfolioXirr";
import type { DisplayMode, Holding } from "@/src/types";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import {
  calculatePpfPortfolioSummary,
  getLinkedLegacyPpfAssetIds,
} from "@/src/domain/ppf";
import { calculateUsdmPortfolioContribution, type UsdmPortfolioContribution } from "@/src/domain/usdmFutures";
import {
  type RefreshQuotes,
  usePortfolioFields,
  useQuoteRefresh,
  withQuoteMetadata,
} from "@/src/hooks";

type UseDashboardInput = {
  now?: Date;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export type DashboardMonthlyMetrics = MonthlyInvestmentMetrics;

export type DashboardState = {
  epfSummary: EpfReportingSummary;
  epfAccountNames: Record<string, string>;
  investedCapitalComplete: boolean;
  /** Annualised Investments return (D8), derived on demand. */
  wholePortfolioXirr: XirrSummary;
  wholePortfolioXirrScope: string;
  xirrNames: Record<string, string>;
  allocation: AllocationItem[];
  cashBalance: number;
  convictionReadiness: ConvictionReadiness;
  currencyIssues: PortfolioCurrencyIssue[];
  dayChange: PortfolioDayChange;
  displayMode: DisplayMode;
  holdings: Holding[];
  hasPortfolioRecords: boolean;
  futuresContributions: (UsdmPortfolioContribution & { accountId: string })[];
  futuresEquityInr: number | null;
  ppfConfirmedBalance: number;
  instrumentAllocation: MetadataAllocationItem[];
  isRefreshing: boolean;
  maskWealthValues: boolean;
  monthlyMetrics: DashboardMonthlyMetrics;
  quoteFailed: QuoteRefreshFailure[];
  quoteFreshness: QuoteFreshnessSummary;
  quoteTimedOut: QuoteRefreshTimeout[];
  refresh: () => Promise<QuoteRefreshResult>;
  refreshError?: string;
  rollupRows: ConsolidatedHoldingRow[];
  rollupTotals: PortfolioRollupTotals;
  sectorAllocation: MetadataAllocationItem[];
  /** The home-screen widget opt-in (#786). */
  showWidgetValue: boolean;
  toggleMaskWealthValues: () => void;
  totalValue: number | null;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return usePortfolioFields(store, ["assets", "cashEntries", "distributionCoverage", "distributions", "epf", "futuresAccounts", "measurementBasis", "monthlySnapshots", "openingPositions", "ppfAccounts", "ppfLedgerEntries", "preferences", "quoteCache", "trades"]);
}

export function useDashboard({
  now = new Date(),
  refreshQuotes,
  store = getPortfolioStore(),
}: UseDashboardInput = {}): DashboardState {
  const snapshot = usePortfolioSnapshot(store);
  const {
    failed: quoteFailed,
    isRefreshing,
    refresh,
    refreshError,
    timedOut: quoteTimedOut,
  } = useQuoteRefresh({ now, refreshQuotes, store });
  const asOf = formatLocalCalendarDate(now);
  const {
    assets, cashEntries, distributionCoverage, distributions, epf, futuresAccounts, measurementBasis,
    monthlySnapshots, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades,
  } = snapshot;
  // The solver is bounded but not free, so it reruns only when a record it reads or the day
  // changes, not on a preference toggle (#663).
  const wholePortfolioXirr = useMemo(
    () => wholePortfolioXirrSummary({
      assets, cashEntries, distributionCoverage, distributions, epf, futuresAccounts, measurementBasis,
      monthlySnapshots, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades,
    }, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the calendar day (asOf), not the per-render Date.
    [assets, cashEntries, distributionCoverage, distributions, epf, futuresAccounts, measurementBasis,
      monthlySnapshots, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades, asOf],
  );
  // Holdings, totals and allocations depend on the records and the calendar day only (#663).
  const derived = useMemo(() => {
    const currencyIssues = getPortfolioCurrencyIssues(assets, quoteCache);
    // EPF-linked legacy holdings are replaced by the account value included below.
    const linkedLegacyAssetIds = new Set([
      ...getLinkedLegacyPpfAssetIds(ppfAccounts, asOf),
      ...getLinkedLegacyEpfAssetIds(epf.accounts, asOf),
    ]);
    const supportedAssetIds = new Set(
      assets
        .filter(
          (asset) =>
            !linkedLegacyAssetIds.has(asset.id) &&
            isV1CompatibleQuote(asset, quoteCache[asset.id]),
        )
        .map((asset) => asset.id),
    );
    const ppfSummary = calculatePpfPortfolioSummary({
      accounts: ppfAccounts,
      asOf,
      entries: ppfLedgerEntries,
    });
    const holdings = withQuoteMetadata(
      calculateHoldings({ assets, openingPositions, quoteCache, trades, now }),
      quoteCache,
    ).filter(
      (holding) => !linkedLegacyAssetIds.has(holding.asset.id),
    );
    const cashBalance = calculateCashBalance(cashEntries, now);
    const rollupRows = calculateConsolidatedHoldingRows(holdings);
    const epfSummary = summarizeEpfForReporting(epf, asOf);
    return {
      allocation: calculateAllocation({
        cashBalance,
        holdings,
        ppfConfirmedBalance: ppfSummary.confirmedBalance,
        epfRecordedBalance: epfSummary.value,
      }),
      cashBalance,
      convictionReadiness: getConvictionReadiness(
        trades.filter((trade) => supportedAssetIds.has(trade.assetId)),
        undefined,
        openingPositions.filter((position) =>
          supportedAssetIds.has(position.assetId),
        ),
      ),
      currencyIssues,
      dayChange: calculatePortfolioDayChange(holdings),
      epfSummary,
      holdings,
      instrumentAllocation: calculateInstrumentAllocation(holdings),
      monthlyMetrics: calculateMonthlyInvestmentMetrics({
        cashEntries, epf, now, openingPositions, ppfLedgerEntries, supportedAssetIds, trades,
      }),
      ppfConfirmedBalance: ppfSummary.confirmedBalance,
      rollupRows,
      sectorAllocation: calculateSectorAllocation(holdings),
      spotRollupTotals: calculatePortfolioRollupTotals(rollupRows, cashBalance, holdings, ppfSummary),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the calendar day (asOf), not the per-render Date.
  }, [assets, cashEntries, epf, openingPositions, ppfAccounts, ppfLedgerEntries, quoteCache, trades, asOf]);
  const { cashBalance, epfSummary, holdings } = derived;
  // Futures valuations are compared with the current time, so they are not memoised.
  const futuresContributions = futuresAccounts.map((account) => ({
    accountId: account.id,
    ...calculateUsdmPortfolioContribution(account, now.toISOString(), cashEntries),
  }));
  const { futuresEquityInr, totals: nonEpfRollupTotals } = combineFuturesWithRollupTotals(
    derived.spotRollupTotals,
    futuresContributions,
  );
  const { totals: rollupTotals, capitalComplete: investedCapitalComplete } = includeEpfInPortfolioTotals(nonEpfRollupTotals, epfSummary);
  const quoteFreshness = summarizeQuoteFreshness(
    holdings
      .filter((holding) => holding.asset.assetClass !== "cash")
      .map((holding) => holding.asset.id),
    quoteCache,
    now,
  );

  function toggleMaskWealthValues() {
    store.getState().updatePreferences({
      maskWealthValues: !store.getState().preferences.maskWealthValues,
    });
  }

  return {
    epfSummary,
    epfAccountNames: Object.fromEntries(epf.accounts.map((account) => [account.id, account.nickname])),
    investedCapitalComplete,
    wholePortfolioXirr,
    wholePortfolioXirrScope: wholePortfolioScope(snapshot, now),
    xirrNames: xirrNames(snapshot),
    ppfConfirmedBalance: derived.ppfConfirmedBalance,
    allocation: derived.allocation,
    cashBalance,
    convictionReadiness: derived.convictionReadiness,
    currencyIssues: derived.currencyIssues,
    dayChange: derived.dayChange,
    displayMode: snapshot.preferences.displayMode,
    holdings,
    futuresContributions,
    hasPortfolioRecords: [cashEntries, trades, openingPositions,
      ppfAccounts, ppfLedgerEntries, futuresAccounts, monthlySnapshots, epf.accounts]
      .some((records) => records.length > 0),
    futuresEquityInr,
    instrumentAllocation: derived.instrumentAllocation,
    isRefreshing,
    maskWealthValues: snapshot.preferences.maskWealthValues,
    monthlyMetrics: derived.monthlyMetrics,
    quoteFailed,
    quoteFreshness,
    quoteTimedOut,
    refresh,
    refreshError,
    rollupRows: derived.rollupRows,
    rollupTotals,
    sectorAllocation: derived.sectorAllocation,
    showWidgetValue: snapshot.preferences.showWidgetValue === true,
    toggleMaskWealthValues,
    totalValue: rollupTotals.totalCurrentValue,
  };
}
