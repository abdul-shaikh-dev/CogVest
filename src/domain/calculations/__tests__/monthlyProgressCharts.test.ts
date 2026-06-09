import {
  buildMonthlyProgressChartData,
  getDefaultMonthlyChartRange,
} from "@/src/domain/calculations";
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
  const monthlySnapshots = [
    snapshot("2025-11", {
      cashValue: 120000,
      cryptoValue: 80000,
      debtValue: 260000,
      equityValue: 760000,
      investedValue: 1120000,
      monthlyInvestment: 40000,
      portfolioValue: 1220000,
    }),
    snapshot("2025-12", {
      cashValue: 125000,
      cryptoValue: 90000,
      debtValue: 270000,
      equityValue: 790000,
      investedValue: 1160000,
      monthlyInvestment: 40000,
      portfolioValue: 1275000,
    }),
    snapshot("2026-01", {
      cashValue: 130000,
      cryptoValue: 85000,
      debtValue: 280000,
      equityValue: 830000,
      investedValue: 1200000,
      monthlyInvestment: 40000,
      portfolioValue: 1325000,
    }),
    snapshot("2026-02", {
      cashValue: 140000,
      cryptoValue: 95000,
      debtValue: 292000,
      equityValue: 865000,
      investedValue: 1245000,
      monthlyInvestment: 45000,
      portfolioValue: 1392000,
    }),
    snapshot("2026-03", {
      cashValue: 150000,
      cryptoValue: 110000,
      debtValue: 305000,
      equityValue: 910000,
      investedValue: 1295000,
      monthlyInvestment: 50000,
      portfolioValue: 1475000,
    }),
    snapshot("2026-04", {
      cashValue: 155000,
      cryptoValue: 100000,
      debtValue: 312000,
      equityValue: 950000,
      investedValue: 1340000,
      monthlyInvestment: 45000,
      portfolioValue: 1517000,
    }),
    snapshot("2026-05", {
      cashValue: 165600,
      cryptoValue: 92000,
      debtValue: 324000,
      equityValue: 1008000,
      investedValue: 1385000,
      monthlyInvestment: 45000,
      portfolioValue: 1589600,
    }),
  ];

  it("chooses the default range from available snapshot count", () => {
    expect(getDefaultMonthlyChartRange(0)).toBe("All");
    expect(getDefaultMonthlyChartRange(6)).toBe("All");
    expect(getDefaultMonthlyChartRange(7)).toBe("6M");
  });

  it("filters to the selected latest timeframe", () => {
    const chartData = buildMonthlyProgressChartData(monthlySnapshots, "3M");

    expect(chartData.selectedRange).toBe("3M");
    expect(chartData.monthLabels).toEqual(["Mar 2026", "Apr 2026", "May 2026"]);
    expect(chartData.portfolioSeries[0]?.values).toEqual([
      1475000,
      1517000,
      1589600,
    ]);
  });

  it("defaults to six latest snapshots when more than six exist", () => {
    const chartData = buildMonthlyProgressChartData(monthlySnapshots);

    expect(chartData.selectedRange).toBe("6M");
    expect(chartData.monthLabels).toEqual([
      "Dec 2025",
      "Jan 2026",
      "Feb 2026",
      "Mar 2026",
      "Apr 2026",
      "May 2026",
    ]);
  });

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
    expect(chartData.portfolioInsight).toMatchObject({
      latestInvestedValue: 100000,
      latestMonthlyGain: 0,
      latestPortfolioValue: 110000,
      valueGap: 10000,
      valueGapPct: 10,
      valueMove: 0,
    });
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

  it("derives portfolio insight and value move from filtered snapshots", () => {
    const chartData = buildMonthlyProgressChartData(monthlySnapshots, "3M");

    expect(chartData.portfolioInsight).toEqual({
      latestInvestedValue: 1385000,
      latestMonthlyGain: 72600,
      latestMonthlyInvestment: 45000,
      latestPortfolioValue: 1589600,
      valueGap: 204600,
      valueGapPct: 14.772563176895307,
      valueMove: 27600,
    });
  });

  it("derives asset insights and largest percentage movement", () => {
    const chartData = buildMonthlyProgressChartData(monthlySnapshots, "3M");

    expect(chartData.assetInsights).toHaveLength(3);
    expect(chartData.assetInsights[0]).toMatchObject({
      label: "Equity",
      latestDelta: 58000,
      latestValue: 1008000,
    });
    expect(chartData.assetInsights[0]?.latestDeltaPct).toBeCloseTo(6.105);
    expect(chartData.assetInsights[0]?.allocationPct).toBeCloseTo(63.412);
    expect(chartData.assetInsights[0]?.allocationShiftPct).toBeCloseTo(0.789);
    expect(chartData.assetInsights[1]).toMatchObject({
      label: "Debt",
      latestDelta: 12000,
      latestValue: 324000,
    });
    expect(chartData.assetInsights[1]?.latestDeltaPct).toBeCloseTo(3.846);
    expect(chartData.assetInsights[1]?.allocationPct).toBeCloseTo(20.382);
    expect(chartData.assetInsights[1]?.allocationShiftPct).toBeCloseTo(-0.184);
    expect(chartData.assetInsights[2]).toMatchObject({
      label: "Crypto",
      latestDelta: -8000,
      latestValue: 92000,
    });
    expect(chartData.assetInsights[2]?.latestDeltaPct).toBeCloseTo(-8);
    expect(chartData.assetInsights[2]?.allocationPct).toBeCloseTo(5.788);
    expect(chartData.assetInsights[2]?.allocationShiftPct).toBeCloseTo(-0.804);
    expect(chartData.largestAssetMove).toMatchObject({
      label: "Crypto",
      latestDelta: -8000,
      latestDeltaPct: -8,
    });
  });
});
