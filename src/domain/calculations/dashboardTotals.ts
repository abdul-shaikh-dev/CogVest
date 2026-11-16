import { epfContributionsForMonth } from "@/src/domain/epf/reporting";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import {
  decimal,
  normalizeMoney,
  normalizePercentage,
  sumFinancialValues,
} from "@/src/domain/precision";
import { getTradeNetAmount } from "@/src/domain/transactionSemantics";
import type { UsdmPortfolioContribution } from "@/src/domain/usdmFutures";
import type { EpfState } from "@/src/domain/epf/persistence";
import type { CashEntry, OpeningPosition, PpfLedgerEntry, Trade } from "@/src/types";

import {
  isInMonthToDate,
  monthToDateCashPurchases,
  type PortfolioRollupTotals,
} from "./holdings";

export type MonthlyInvestmentMetrics = {
  cashAdded: number;
  cashChange: number;
  investment: number;
};

/**
 * This month's investment and cash movement for the Dashboard: buys and
 * opening positions in supported holdings, PPF and EPF contributions, and
 * cash added and withdrawn. Records dated after `now` are left out.
 */
export function calculateMonthlyInvestmentMetrics({
  cashEntries,
  epf,
  now,
  openingPositions,
  ppfLedgerEntries,
  supportedAssetIds,
  trades,
}: {
  cashEntries: readonly CashEntry[];
  epf: EpfState;
  now: Date;
  openingPositions: readonly OpeningPosition[];
  ppfLedgerEntries: readonly PpfLedgerEntry[];
  supportedAssetIds: ReadonlySet<string>;
  trades: readonly Trade[];
}): MonthlyInvestmentMetrics {
  // Imported buys keep their charges beside a gross total (#649).
  const tradeInvestment = sumFinancialValues(
    monthToDateCashPurchases(trades, openingPositions, now)
      .filter((trade) => supportedAssetIds.has(trade.assetId))
      .map(getTradeNetAmount),
  );
  const openingInvestment = openingPositions
    .filter(
      (position) =>
        supportedAssetIds.has(position.assetId) &&
        position.date !== null &&
        isInMonthToDate(position.date, now),
    )
    .reduce(
      (total, position) =>
        total.plus(decimal(position.quantity).times(position.averageCostPrice)),
      decimal(0),
    );
  const cashTotal = (type: CashEntry["type"]) => sumFinancialValues(
    cashEntries
      .filter((entry) => entry.type === type && isInMonthToDate(entry.date, now))
      .map((entry) => entry.amount),
  );
  const cashAdded = cashTotal("addition");
  const cashWithdrawn = cashTotal("withdrawal");
  const ppfInvestment = sumFinancialValues(
    ppfLedgerEntries.flatMap((entry) =>
      entry.type === "contribution" && isInMonthToDate(entry.date, now) ? [entry.amount] : []),
  );
  const investment = tradeInvestment
    .plus(openingInvestment)
    .plus(ppfInvestment)
    .plus(epfContributionsForMonth(epf, formatLocalCalendarDate(now)));

  return {
    cashAdded: normalizeMoney(cashAdded),
    cashChange: normalizeMoney(cashAdded.minus(cashWithdrawn)),
    investment: normalizeMoney(investment),
  };
}

export type FuturesContribution = UsdmPortfolioContribution & { accountId: string };

/**
 * Adds futures accounts to the spot portfolio totals. A futures account
 * without a current valuation makes the combined value and P&L unknown, and
 * counts as a pending holding, rather than being valued at zero.
 */
export function combineFuturesWithRollupTotals(
  spot: PortfolioRollupTotals,
  futures: readonly FuturesContribution[],
): { futuresEquityInr: number | null; totals: PortfolioRollupTotals } {
  const pending = futures.filter((item) => item.status === "pending");
  const equity = sumFinancialValues(futures.map((item) => item.equityInr ?? 0));
  const invested = sumFinancialValues(futures.map((item) => item.investedInr ?? 0));
  const combinedInvested = decimal(spot.totalInvested).plus(invested);
  const value = spot.totalCurrentValue === null || pending.length
    ? null : decimal(spot.totalCurrentValue).plus(equity);
  const pnl = spot.pnl === null || pending.length
    ? null : decimal(spot.pnl).plus(equity).minus(invested);

  return {
    futuresEquityInr: pending.length ? null : normalizeMoney(equity),
    totals: {
      ...spot,
      holdingsCurrentValue: spot.holdingsCurrentValue === null || pending.length
        ? null : normalizeMoney(decimal(spot.holdingsCurrentValue).plus(equity)),
      pnl: pnl === null ? null : normalizeMoney(pnl),
      pnlPct: pnl === null ? null : combinedInvested.isZero() ? 0
        : normalizePercentage(pnl.dividedBy(combinedInvested).times(100)),
      totalCurrentValue: value === null ? null : normalizeMoney(value),
      totalInvested: normalizeMoney(combinedInvested),
      valuedHoldingsSubtotal: normalizeMoney(decimal(spot.valuedHoldingsSubtotal).plus(equity)),
      valuationCoverage: {
        ...spot.valuationCoverage,
        status: pending.length ? "incomplete" : spot.valuationCoverage.status,
        pendingAssetIds: [...spot.valuationCoverage.pendingAssetIds, ...pending.map((item) => item.accountId)],
        pendingHoldings: spot.valuationCoverage.pendingHoldings + pending.length,
        totalHoldings: spot.valuationCoverage.totalHoldings + futures.length,
        valuedHoldings: spot.valuationCoverage.valuedHoldings + futures.length - pending.length,
      },
    },
  };
}
