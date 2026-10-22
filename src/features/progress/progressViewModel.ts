import { MASKED_INR_VALUE } from "@/src/components/common";
import type { MonthlyProgressChartSeries } from "@/src/domain/calculations";
import { formatCompactINR } from "@/src/domain/formatters";
import { decimal, normalizePercentage } from "@/src/domain/precision";
import type { PortfolioStoreState } from "@/src/store";
import type { ThemeColors } from "@/src/theme";

import type { ProgressSnapshotAutomationStatus } from "./useProgress";

// Pure view logic for the Progress screen: month labels, chart geometry,
// series colours and snapshot status copy.

export function getMonthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatMonth(month: string) {
  const [year, monthPart] = month.split("-");
  const monthIndex = Number(monthPart) - 1;

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(Number(year), monthIndex, 1)));
}

export function formatShortMonth(month: string) {
  const [year, monthPart] = month.split("-");

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(monthPart) - 1, 1)));
}

export function formatSignedCompactINR(value: number) {
  const amount = formatCompactINR(Math.abs(value));

  if (value > 0) {
    return `+${amount}`;
  }

  if (value < 0) {
    return `-${amount}`;
  }

  return amount;
}

export function formatOptionalSignedCompactINR(value: number | null) {
  return value === null ? "Unavailable" : formatSignedCompactINR(value);
}

export const chartHeight = 154;
export const chartWidth = 228;
export const chartSections = 2;
export const chartInitialSpacing = 18;
export const chartEndSpacing = 36;

export function getSeriesColor(colors: ThemeColors, label: string) {
  switch (label) {
    case "Portfolio":
      return colors.profit;
    case "Invested":
      return colors.text.primary;
    case "Equity":
      return colors.primary;
    case "Debt":
      return colors.blue;
    case "Crypto":
      return colors.cryptoAmber;
    default:
      return colors.text.secondary;
  }
}

export function getChartMaxValue(series: MonthlyProgressChartSeries[]) {
  const maxValue = Math.max(...series.flatMap((item) => item.values), 1);
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalized = maxValue / magnitude;
  const niceMultiplier = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceMultiplier * magnitude;
}

export function formatChartYLabel(value: number | string, masked: boolean) {
  if (masked) {
    return MASKED_INR_VALUE;
  }

  return formatCompactINR(Number(value));
}

export function formatChartAxisLabel(monthLabel: string) {
  return monthLabel.split(" ")[0] ?? monthLabel;
}

export function shouldShowAxisLabel(index: number, total: number) {
  if (total <= 3) {
    return true;
  }

  return index === 0 || index === Math.floor((total - 1) / 2) || index === total - 1;
}

export function getChartPointRadius(
  pointCount: number,
  index: number,
  selectedIndex?: number,
) {
  if (index === selectedIndex) return 6;
  if (pointCount <= 12) return 3;
  if (pointCount <= 24) return 2;
  return 0;
}

export function getChartSpacing(pointCount: number, width: number) {
  if (pointCount <= 1) {
    return width / 2;
  }

  return Math.max(
    0,
    (width - chartInitialSpacing - chartEndSpacing) / (pointCount - 1),
  );
}

function getDimmedSeriesColor(colors: ThemeColors, label: string) {
  return `${getSeriesColor(colors, label)}3D`;
}

export function getDisplayedSeriesColor(colors: ThemeColors, label: string, focusedSeries: string | null) {
  return focusedSeries && focusedSeries !== label
    ? getDimmedSeriesColor(colors, label)
    : getSeriesColor(colors, label);
}

export function getSeriesValue(
  series: MonthlyProgressChartSeries[],
  label: string,
  index: number,
) {
  return series.find((item) => item.label === label)?.values[index] ?? 0;
}

export function getSelectedChange(
  values: number[],
  selectedIndex: number,
): number | null {
  if (selectedIndex <= 0) {
    return null;
  }

  const previousValue = values[selectedIndex - 1] ?? 0;
  const currentValue = values[selectedIndex] ?? 0;

  return previousValue === 0
    ? null
    : normalizePercentage(
        decimal(currentValue).minus(previousValue).dividedBy(previousValue).times(100),
      );
}

export const snapshotStatusTitles: Record<
  ProgressSnapshotAutomationStatus["kind"],
  string
> = {
  checking: "Checking monthly history",
  complete: "Monthly history is up to date",
  empty: "No portfolio history yet",
  estimated: "Some months use estimates",
  generating: "Building monthly history",
  "incomplete-ppf": "Earlier PPF balances are missing",
  "missing-price": "Historical prices are unavailable",
  "records-incomplete": "Portfolio history needs attention",
  "reconstructed-history": "Market and cash history available",
  "waiting-for-first-month": "Waiting for the first month-end",
};

export function snapshotStatusMessage(status: ProgressSnapshotAutomationStatus) {
  const availableThroughMonth = status.availableThroughMonth
    ? formatMonth(status.availableThroughMonth)
    : null;

  if (status.progress) {
    const checkedLabel = status.progress.totalCount === 1 ? "month" : "months";
    const latestCopy = availableThroughMonth
      ? ` Latest stored: ${availableThroughMonth}.`
      : " Completed months will appear as they are saved.";

    return `${status.progress.checkedCount} of ${status.progress.totalCount} ${checkedLabel} checked. Checking ${formatMonth(status.progress.currentMonth)}.${latestCopy} Keep CogVest open to continue.`;
  }

  if (status.kind === "reconstructed-history") {
    return `Market and cash history is available${availableThroughMonth ? ` through ${availableThroughMonth}` : ""}. Full portfolio snapshots need earlier confirmed PPF balances.`;
  }

  if (status.kind === "incomplete-ppf") {
    const pendingCopy = status.pendingMonths.length > 0
      ? ` for ${status.pendingMonths.length} ${status.pendingMonths.length === 1 ? "month" : "months"}`
      : "";
    return `Full portfolio history cannot be completed without earlier confirmed PPF balances${pendingCopy}.`;
  }

  if (status.kind === "missing-price") {
    return `${status.message}${availableThroughMonth ? ` Latest full snapshot: ${availableThroughMonth}.` : ""} Try again when price data is available.`;
  }

  if (status.kind === "records-incomplete") {
    return `${status.message}${availableThroughMonth ? ` Latest full snapshot: ${availableThroughMonth}.` : ""} Check the affected holdings before trying again.`;
  }

  if (status.kind === "complete" && availableThroughMonth) {
    return `${status.message} Latest full snapshot: ${availableThroughMonth}.`;
  }

  return status.message;
}

export function getSingleEpfAccountId(state: PortfolioStoreState) {
  return state.epf.accounts.length === 1 ? state.epf.accounts[0].id : undefined;
}
