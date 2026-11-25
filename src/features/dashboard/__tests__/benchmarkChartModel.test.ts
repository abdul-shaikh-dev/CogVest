import { benchmarkValuesOn, type NavPoint } from "@/src/domain/benchmarkXirr";
import type { XirrFlow } from "@/src/domain/xirrInputs";

import { buildBenchmarkChartData, monthEndOf } from "../benchmarkChartModel";

// Synthetic NAV: 100 at the start, 110 at the end of February, 121 by April.
const points: NavPoint[] = [
  { close: 100, date: "2026-01-31" },
  { close: 105, date: "2026-02-27" },
  { close: 110, date: "2026-03-31" },
  { close: 121, date: "2026-04-20" },
];
const flows: XirrFlow[] = [
  { amountInr: "-1000", date: "2026-01-31", id: "start", source: "opening" },
  { amountInr: "-1050", date: "2026-02-27", id: "sip", source: "cash" },
  { amountInr: "2500", date: "2026-04-20", id: "now", source: "terminal" },
];
const snapshots = [
  { month: "2026-01", portfolioValue: 1000 },
  { month: "2026-02", portfolioValue: 2100 },
  { month: "2026-03", portfolioValue: 2300 },
];

describe("benchmark chart data (#765)", () => {
  it("finds month ends, leap years included", () => {
    expect(monthEndOf("2024-02")).toBe("2024-02-29");
    expect(monthEndOf("2026-02")).toBe("2026-02-28");
    expect(monthEndOf("2026-12")).toBe("2026-12-31");
  });

  it("values the fund with the flows up to each date, at that date's NAV", () => {
    // 10 units, then 10 more at 105; at 110 that is 2200, at 121 it is 2420.
    expect(benchmarkValuesOn(flows, ["2026-01-31", "2026-03-31", "2026-04-20"], points)).toEqual([1000, 2200, 2420]);
    // Feb 28 is a Saturday: the Friday NAV is used, after the Friday buy.
    expect(benchmarkValuesOn(flows, ["2026-02-28"], points)).toEqual([2100]);
  });

  it("draws stored month-end values against the fund, ending with today's value", () => {
    expect(buildBenchmarkChartData({ endDate: "2026-04-20", flows, points, snapshots, startDate: "2026-01-31" })).toEqual({
      dates: ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-20"],
      fund: [1000, 2100, 2200, 2420],
      labels: ["Jan 2026", "Feb 2026", "Mar 2026", "Now"],
      portfolio: [1000, 2100, 2300, 2500],
      status: "chart",
    });
  });

  it("leaves out snapshots before the start, and never estimates missing months", () => {
    const result = buildBenchmarkChartData({
      endDate: "2026-04-20", flows, points, snapshots: [{ month: "2025-12", portfolioValue: 1 }, snapshots[0], snapshots[2]], startDate: "2026-01-31",
    });
    expect(result).toMatchObject({ labels: ["Jan 2026", "Mar 2026", "Now"], status: "chart" });
  });

  it("says when there are too few snapshots to draw a line", () => {
    expect(buildBenchmarkChartData({ endDate: "2026-04-20", flows, points, snapshots: snapshots.slice(0, 1), startDate: "2026-01-31" }))
      .toEqual({ points: 2, status: "few" });
  });

  it("draws nothing when NAV is missing for a point", () => {
    expect(buildBenchmarkChartData({ endDate: "2026-04-20", flows, points: points.slice(1), snapshots, startDate: "2026-01-31" }))
      .toEqual({ status: "unavailable" });
  });
});
