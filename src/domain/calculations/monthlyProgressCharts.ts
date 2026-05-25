import type { MonthlySnapshot } from "@/src/types";

export type MonthlyProgressChartSeries = {
  label: string;
  values: number[];
};

export type MonthlyProgressChartData = {
  assetSeries: MonthlyProgressChartSeries[];
  hasEnoughHistory: boolean;
  monthLabels: string[];
  portfolioSeries: MonthlyProgressChartSeries[];
};

function formatShortMonth(month: string) {
  const [year, monthPart] = month.split("-");

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(Number(year), Number(monthPart) - 1, 1)));
}

export function buildMonthlyProgressChartData(
  snapshots: MonthlySnapshot[],
): MonthlyProgressChartData {
  const chronological = [...snapshots].sort((left, right) =>
    left.month.localeCompare(right.month),
  );
  const monthLabels = chronological.map((snapshot) =>
    formatShortMonth(snapshot.month),
  );

  if (chronological.length < 2) {
    return {
      assetSeries: [],
      hasEnoughHistory: false,
      monthLabels,
      portfolioSeries: [],
    };
  }

  return {
    assetSeries: [
      {
        label: "Equity",
        values: chronological.map((snapshot) => snapshot.equityValue),
      },
      {
        label: "Debt",
        values: chronological.map((snapshot) => snapshot.debtValue),
      },
      {
        label: "Crypto",
        values: chronological.map((snapshot) => snapshot.cryptoValue),
      },
    ],
    hasEnoughHistory: true,
    monthLabels,
    portfolioSeries: [
      {
        label: "Portfolio",
        values: chronological.map((snapshot) => snapshot.portfolioValue),
      },
      {
        label: "Invested",
        values: chronological.map((snapshot) => snapshot.investedValue),
      },
    ],
  };
}
