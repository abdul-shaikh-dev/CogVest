import type { MonthlyProgressSummary } from "@/src/domain/calculations";
import { formatINR } from "@/src/domain/formatters";
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
