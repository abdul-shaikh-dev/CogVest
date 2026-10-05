import type { PortfolioRollupTotals } from "@/src/domain/calculations/holdings";
import { decimal, normalizeMoney, normalizePercentage } from "@/src/domain/precision";
import { calculateEpfLedger } from "./calculations";
import type { EpfState } from "./persistence";

/** Current recorded value is not proof of a confirmed historical month-end. */
export function summarizeEpfForReporting(epf: EpfState, asOf: string) {
  const result = calculateEpfLedger({ accounts: epf.accounts, events: epf.events }, asOf, asOf);
  const linkedIds = new Set(epf.cashLinks.map(link => link.eventId));
  return {
    accountCount: epf.accounts.length,
    value: result.ok ? result.total : null,
    capital: result.ok ? result.capital : null,
    inTransit: result.ok ? result.inTransit : null,
    accounts: result.ok ? result.accounts : [],
    reasons: result.ok ? result.coverageReasons.filter(reason => {
      const suffix = ":unknownWithdrawalDestination";
      return !reason.endsWith(suffix) || !linkedIds.has(reason.slice(0, -suffix.length));
    }) : result.errors,
  };
}

export type EpfReportingSummary = ReturnType<typeof summarizeEpfForReporting>;

export function epfContributionsForMonth(epf: EpfState, asOf: string) {
  const linkedIds = new Set(epf.cashLinks.map(link => link.eventId));
  const events = new Map(epf.events.map(event => [event.id, event]));
  let total = decimal(0);
  for (const event of epf.events) {
    if (event.effectiveDate > asOf || event.effectiveDate.slice(0, 7) !== asOf.slice(0, 7)) continue;
    if (event.type === "contribution" && !linkedIds.has(event.id)) total = total.plus(event.amount);
    if (event.type === "reversal") {
      const original = events.get(event.reversesId);
      if (original?.type === "contribution" && !linkedIds.has(original.id)) total = total.minus(original.amount);
    }
  }
  return normalizeMoney(total);
}

export function includeEpfInPortfolioTotals(base: PortfolioRollupTotals, epf: EpfReportingSummary) {
  const valueReady = epf.value !== null;
  const capitalComplete = epf.capital !== null;
  const invested = decimal(base.totalInvested).plus(epf.capital ?? 0);
  const pnl = base.pnl === null || !valueReady || !capitalComplete ? null
    : decimal(base.pnl).plus(epf.value!).minus(epf.capital!);
  const addValue = (value: number | null) => value === null || !valueReady ? null
    : normalizeMoney(decimal(value).plus(epf.value!));
  const totals: PortfolioRollupTotals = {
    ...base,
    totalCurrentValue: addValue(base.totalCurrentValue),
    holdingsCurrentValue: addValue(base.holdingsCurrentValue),
    valuedHoldingsSubtotal: normalizeMoney(decimal(base.valuedHoldingsSubtotal).plus(epf.value ?? 0)),
    // This is a subtotal only when capitalComplete is false; callers must not
    // display it as whole-portfolio invested capital.
    totalInvested: normalizeMoney(invested),
    pnl: pnl === null ? null : normalizeMoney(pnl),
    pnlPct: pnl === null ? null : invested.isZero() ? 0
      : normalizePercentage(pnl.dividedBy(invested).times(100)),
    valuationCoverage: {
      ...base.valuationCoverage,
      status: valueReady ? base.valuationCoverage.status : "incomplete",
      totalHoldings: base.valuationCoverage.totalHoldings + epf.accountCount,
      valuedHoldings: base.valuationCoverage.valuedHoldings + (valueReady ? epf.accountCount : 0),
      pendingHoldings: base.valuationCoverage.pendingHoldings + (valueReady ? 0 : epf.accountCount),
      pendingAssetIds: [...base.valuationCoverage.pendingAssetIds, ...(!valueReady && epf.accountCount ? ["epf:unavailable"] : [])],
    },
  };
  return { totals, capitalComplete };
}
