import type { MonthlyProgressSummary } from "@/src/domain/calculations";
import type { MonthlyPerformanceUnavailableReason } from "@/src/domain/calculations/monthlyPerformance";
import { formatCompactINR, formatINR, formatPercentage } from "@/src/domain/formatters";
import { compareCodeUnits } from "@/src/domain/ordering";
import type { AssetClass } from "@/src/types";

function monthDate(month: string) {
  const [year, monthPart] = month.split("-");
  return new Date(Date.UTC(Number(year), Number(monthPart) - 1, 1));
}

export function formatMonth(month: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(monthDate(month));
}

export function formatShortMonth(month: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
  }).format(monthDate(month));
}

export function previousCalendarMonth(month: string) {
  const [year, monthPart] = month.split("-");
  const previous = new Date(Date.UTC(Number(year), Number(monthPart) - 2, 1));

  return `${previous.getUTCFullYear()}-${String(
    previous.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

export function formatSignedValue(value: number) {
  const amount = formatINR(Math.abs(value));

  if (value > 0) return `+${amount}`;
  if (value < 0) return `-${amount}`;
  return amount;
}

export function getAssetAllocation(summary: MonthlyProgressSummary, assetClass: AssetClass) {
  return summary.assetSnapshot.find((item) => item.assetClass === assetClass)
    ?.percentage;
}

/** Years with snapshots, newest first. */
export function historyYears(summaries: MonthlyProgressSummary[]) {
  return [...new Set(summaries.map((summary) => summary.snapshot.month.slice(0, 4)))].sort(
    (left, right) => compareCodeUnits(right, left),
  );
}

/**
 * One year's months, newest first, with the value bars' scale. Bars are shown
 * only for unmasked, non-negative values with a positive largest month.
 */
export function yearOverview(
  summaries: MonthlyProgressSummary[],
  year: string,
  maskWealthValues: boolean,
) {
  const months = summaries
    .filter((summary) => summary.snapshot.month.startsWith(`${year}-`))
    .sort((left, right) => compareCodeUnits(right.snapshot.month, left.snapshot.month));
  const largestValue = Math.max(0, ...months.map((summary) => summary.snapshot.portfolioValue));
  const showValueBars = !maskWealthValues && largestValue > 0 &&
    months.every((summary) => summary.snapshot.portfolioValue >= 0);

  return {
    barWidth: (value: number): `${number}%` => `${value / largestValue * 100}%`,
    months,
    showValueBars,
  };
}

export type HistoryColumn = "monthGain" | "vsInvested";

const unavailableReason: Record<MonthlyPerformanceUnavailableReason, string> = {
  "ambiguous-cash-flow": "some money moved in or out on an unclear date",
  "invalid-denominator": "the previous month's value was zero or below",
  "legacy-snapshot": "this month was saved before money moved in and out was recorded",
  "manual-snapshot": "this month's value was entered by hand",
  "ppf-reconciliation": "PPF records for this month need reconciling",
  "unknown-opening-position-date": "a starting holding has no known date",
  "missing-previous-snapshot": "there is no saved value for the month before",
  "non-consecutive-snapshot": "the month before has no saved value",
  "out-of-date-snapshot": "this month or the one before was saved before later records were added",
};

const signedCompact = (value: number) => (value > 0 ? `+${formatCompactINR(value)}` : formatCompactINR(value));

/**
 * One month's gain or loss for the history list: its market change, the
 * change in value less money added or withdrawn that month (#743).
 */
export function monthGainCell(summary: MonthlyProgressSummary, maskWealthValues: boolean) {
  const { marketMovement, marketMovementPct, reason } = summary.performance;
  if (marketMovement === null) {
    const why = reason ? unavailableReason[reason] : "it can't be worked out from the saved months";
    return { amount: null, exactAmount: null, percentage: null, tone: "neutral" as const,
      accessibility: `Month gain unavailable: ${why}` };
  }
  const tone = marketMovement > 0 ? "gain" as const : marketMovement < 0 ? "loss" as const : "neutral" as const;
  const percentage = marketMovementPct === null ? null : formatPercentage(marketMovementPct);
  const spoken = [maskWealthValues ? null : formatSignedValue(marketMovement), percentage].filter(Boolean).join(", ");
  return {
    amount: signedCompact(marketMovement),
    exactAmount: formatSignedValue(marketMovement),
    percentage,
    tone,
    accessibility: `Month gain ${spoken || "hidden"}, excluding money added or withdrawn`,
  };
}
