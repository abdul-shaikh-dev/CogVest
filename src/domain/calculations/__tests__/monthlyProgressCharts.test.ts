import { buildMonthlyProgressChartData } from "@/src/domain/calculations";
import type { MonthlySnapshot } from "@/src/types";

function snapshot(
  month: string,
  values: Partial<MonthlySnapshot> = {},
): MonthlySnapshot {
  return {
    cashValue: 0,
    cryptoValue: 0,
    debtValue: 0,
    equityValue: 0,
    id: `snapshot-${month}`,
    investedValue: 0,
    month,
    monthlyInvestment: 0,
    portfolioValue: 0,
    salary: 0,
    ...values,
  };
}

describe("buildMonthlyProgressChartData", () => {
  it("marks chart history as insufficient until two snapshots exist", () => {
    const chartData = buildMonthlyProgressChartData([
      snapshot("2026-05", {
        investedValue: 100000,
        portfolioValue: 110000,
      }),
    ]);

    expect(chartData.hasEnoughHistory).toBe(false);
    expect(chartData.monthLabels).toEqual(["May 2026"]);
    expect(chartData.portfolioSeries).toEqual([]);
    expect(chartData.assetSeries).toEqual([]);
  });

  it("builds chronological portfolio and invested series", () => {
    const chartData = buildMonthlyProgressChartData([
      snapshot("2026-05", {
        investedValue: 1060000,
        portfolioValue: 1385000,
      }),
      snapshot("2026-04", {
        investedValue: 1000000,
        portfolioValue: 1260000,
      }),
    ]);

    expect(chartData.hasEnoughHistory).toBe(true);
    expect(chartData.monthLabels).toEqual(["Apr 2026", "May 2026"]);
    expect(chartData.portfolioSeries).toEqual([
      {
        label: "Portfolio",
        values: [1260000, 1385000],
      },
      {
        label: "Invested",
        values: [1000000, 1060000],
      },
    ]);
  });

  it("builds asset series for equity debt and crypto while excluding cash", () => {
    const chartData = buildMonthlyProgressChartData([
      snapshot("2026-04", {
        cashValue: 120000,
        cryptoValue: 40000,
        debtValue: 300000,
        equityValue: 800000,
      }),
      snapshot("2026-05", {
        cashValue: 140000,
        cryptoValue: 45000,
        debtValue: 320000,
        equityValue: 880000,
      }),
    ]);

    expect(chartData.assetSeries).toEqual([
      {
        label: "Equity",
        values: [800000, 880000],
      },
      {
        label: "Debt",
        values: [300000, 320000],
      },
      {
        label: "Crypto",
        values: [40000, 45000],
      },
    ]);
    expect(chartData.assetSeries.some((series) => series.label === "Cash")).toBe(
      false,
    );
  });
});
