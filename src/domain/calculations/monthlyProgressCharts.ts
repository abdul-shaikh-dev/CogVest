import type { MonthlySnapshot } from "@/src/types";

import {
  calculateMonthlyPerformance,
  type MonthlyPerformanceResult,
} from "./monthlyPerformance";

export type MonthlyChartRange = "3M" | "6M" | "1Y" | "All";

export const MONTHLY_CHART_RANGES: MonthlyChartRange[] = [
  "3M",
  "6M",
  "1Y",
  "All",
];

export type MonthlyProgressChartSeries = {
  label: string;
  values: number[];
};

export type PortfolioChartInsight = {
  latestInvestedValue: number;
  latestMonthlyInvestment: number;
  latestPortfolioValue: number;
  performance: MonthlyPerformanceResult;
  valueGap: number;
  valueGapPct: number;
};

export type AssetChartInsight = {
  allocationPct: number;
  allocationShiftPct: number;
  label: "Equity" | "Debt" | "Crypto";
  latestDelta: number;
  latestDeltaPct: number;
  latestValue: number;
};

export type MonthlyProgressChartData = {
  assetSeries: MonthlyProgressChartSeries[];
  assetInsights: AssetChartInsight[];
  availableRanges: MonthlyChartRange[];
  hasEnoughHistory: boolean;
  largestAssetMove: AssetChartInsight | null;
  monthLabels: string[];
  portfolioInsight: PortfolioChartInsight | null;
  portfolioSeries: MonthlyProgressChartSeries[];
  selectedRange: MonthlyChartRange;
};

function formatShortMonth(month: string) {
  const [year, monthPart] = month.split("-");

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(Number(year), Number(monthPart) - 1, 1)));
}

function safePercentage(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

function getRangeLimit(range: MonthlyChartRange) {
  switch (range) {
    case "3M":
      return 3;
    case "6M":
      return 6;
    case "1Y":
      return 12;
    case "All":
      return Number.POSITIVE_INFINITY;
  }
}

export function getDefaultMonthlyChartRange(
  snapshotCount: number,
): MonthlyChartRange {
  return snapshotCount <= 6 ? "All" : "6M";
}

function getFilteredSnapshots(
  chronological: MonthlySnapshot[],
  range: MonthlyChartRange,
) {
  const limit = getRangeLimit(range);

  return Number.isFinite(limit) ? chronological.slice(-limit) : chronological;
}

function buildPortfolioInsight(
  chronological: MonthlySnapshot[],
): PortfolioChartInsight | null {
  const latestSnapshot = chronological.at(-1);

  if (!latestSnapshot) {
    return null;
  }

  const previousSnapshot = chronological.at(-2);
  const valueGap =
    latestSnapshot.portfolioValue - latestSnapshot.investedValue;

  return {
    latestInvestedValue: latestSnapshot.investedValue,
    latestMonthlyInvestment: latestSnapshot.monthlyInvestment,
    latestPortfolioValue: latestSnapshot.portfolioValue,
    performance: calculateMonthlyPerformance(previousSnapshot, latestSnapshot),
    valueGap,
    valueGapPct: safePercentage(valueGap, latestSnapshot.investedValue),
  };
}

function getSnapshotAssetTotal(snapshot: MonthlySnapshot) {
  return (
    snapshot.equityValue +
    snapshot.debtValue +
    snapshot.cryptoValue +
    snapshot.cashValue
  );
}

function getAssetValue(
  snapshot: MonthlySnapshot,
  label: AssetChartInsight["label"],
) {
  switch (label) {
    case "Equity":
      return snapshot.equityValue;
    case "Debt":
      return snapshot.debtValue;
    case "Crypto":
      return snapshot.cryptoValue;
  }
}

function buildAssetInsights(
  chronological: MonthlySnapshot[],
): AssetChartInsight[] {
  const latestSnapshot = chronological.at(-1);

  if (!latestSnapshot) {
    return [];
  }

  const previousSnapshot = chronological.at(-2);
  const latestTotal = getSnapshotAssetTotal(latestSnapshot);
  const previousTotal = previousSnapshot
    ? getSnapshotAssetTotal(previousSnapshot)
    : 0;
  const labels: AssetChartInsight["label"][] = ["Equity", "Debt", "Crypto"];

  return labels.map((label) => {
    const latestValue = getAssetValue(latestSnapshot, label);
    const previousValue = previousSnapshot
      ? getAssetValue(previousSnapshot, label)
      : 0;
    const latestDelta = previousSnapshot ? latestValue - previousValue : 0;
    const allocationPct = safePercentage(latestValue, latestTotal);
    const previousAllocationPct = previousSnapshot
      ? safePercentage(previousValue, previousTotal)
      : allocationPct;

    return {
      allocationPct,
      allocationShiftPct: allocationPct - previousAllocationPct,
      label,
      latestDelta,
      latestDeltaPct: safePercentage(latestDelta, previousValue),
      latestValue,
    };
  });
}

function getLargestAssetMove(assetInsights: AssetChartInsight[]) {
  if (assetInsights.length === 0) {
    return null;
  }

  return [...assetInsights].sort(
    (left, right) =>
      Math.abs(right.latestDeltaPct) - Math.abs(left.latestDeltaPct),
  )[0];
}

export function buildMonthlyProgressChartData(
  snapshots: MonthlySnapshot[],
  range?: MonthlyChartRange,
): MonthlyProgressChartData {
  const chronological = [...snapshots].sort((left, right) =>
    left.month.localeCompare(right.month),
  );
  const selectedRange = range ?? getDefaultMonthlyChartRange(chronological.length);
  const filtered = getFilteredSnapshots(chronological, selectedRange);
  const monthLabels = filtered.map((snapshot) =>
    formatShortMonth(snapshot.month),
  );
  const assetInsights = buildAssetInsights(filtered);

  if (filtered.length < 2) {
    return {
      assetSeries: [],
      assetInsights,
      availableRanges: MONTHLY_CHART_RANGES,
      hasEnoughHistory: false,
      largestAssetMove: getLargestAssetMove(assetInsights),
      monthLabels,
      portfolioInsight: buildPortfolioInsight(filtered),
      portfolioSeries: [],
      selectedRange,
    };
  }

  return {
    assetSeries: [
      {
        label: "Equity",
        values: filtered.map((snapshot) => snapshot.equityValue),
      },
      {
        label: "Debt",
        values: filtered.map((snapshot) => snapshot.debtValue),
      },
      {
        label: "Crypto",
        values: filtered.map((snapshot) => snapshot.cryptoValue),
      },
    ],
    assetInsights,
    availableRanges: MONTHLY_CHART_RANGES,
    hasEnoughHistory: true,
    largestAssetMove: getLargestAssetMove(assetInsights),
    monthLabels,
    portfolioInsight: buildPortfolioInsight(filtered),
    portfolioSeries: [
      {
        label: "Portfolio",
        values: filtered.map((snapshot) => snapshot.portfolioValue),
      },
      {
        label: "Invested",
        values: filtered.map((snapshot) => snapshot.investedValue),
      },
    ],
    selectedRange,
  };
}
