import { benchmarkValuesOn, benchmarkXirr, navOn, type NavPoint } from "@/src/domain/benchmarkXirr";
import { decimal } from "@/src/domain/precision";
import { calculateXirr } from "@/src/domain/xirr";
import type { XirrFlow } from "@/src/domain/xirrInputs";

function flow(date: string, amountInr: string, source: XirrFlow["source"] = "cash"): XirrFlow {
  return { amountInr, date, id: `${source}-${date}`, source };
}

describe("benchmark XIRR (#765)", () => {
  it("takes the last NAV on or before a date, within six days", () => {
    const points = [{ close: 100, date: "2026-01-02" }, { close: 0, date: "2026-01-05" }, { close: 101, date: "2026-01-06" }];
    expect(navOn(points, "2026-01-05")).toEqual({ close: 100, date: "2026-01-02" });
    expect(navOn(points, "2026-01-06")).toEqual({ close: 101, date: "2026-01-06" });
    expect(navOn(points, "2026-01-13")).toBeNull();
    expect(navOn(points, "2026-01-01")).toBeNull();
  });

  it("earns the fund's own growth for one investment held to the end", () => {
    const points = [{ close: 100, date: "2025-01-01" }, { close: 110, date: "2026-01-01" }];
    const result = benchmarkXirr([flow("2025-01-01", "-1000"), flow("2026-01-01", "1500", "terminal")], "2026-01-01", points);
    expect(result).toMatchObject({ endValueInr: 1100, navAsOf: "2026-01-01", status: "rate" });
    expect(result.status === "rate" && result.rate).toBeCloseTo(0.1, 6);
  });

  it("replays money in and out with the portfolio's dates and amounts, ignoring its terminal value", () => {
    const points = [
      { close: 100, date: "2025-01-01" },
      { close: 125, date: "2025-07-01" },
      { close: 150, date: "2026-01-01" },
    ];
    const flows = [
      flow("2025-01-01", "-1000"),
      flow("2025-07-01", "-500", "trade"),
      flow("2025-07-01", "250", "distribution"),
      flow("2026-01-01", "999999", "terminal"),
    ];
    const result = benchmarkXirr(flows, "2026-01-01", points);
    // 10 units + 4 - 2 = 12 units at 150.
    expect(result).toMatchObject({ endValueInr: 1800, status: "rate" });
    const expected = calculateXirr([
      { amountInr: "-1000", date: "2025-01-01" }, { amountInr: "-500", date: "2025-07-01" },
      { amountInr: "250", date: "2025-07-01" }, { amountInr: "1800", date: "2026-01-01" },
    ]);
    expect(result.status === "rate" && expected.status === "rate" && result.rate).toBeCloseTo(expected.status === "rate" ? expected.rate : 0, 10);
  });

  it("is unavailable with the date when a flow has no NAV", () => {
    const points = [{ close: 100, date: "2025-01-01" }, { close: 110, date: "2026-01-01" }];
    const result = benchmarkXirr([flow("2025-01-01", "-1000"), flow("2025-06-15", "-100")], "2026-01-01", points);
    expect(result).toEqual({ message: expect.stringContaining("15 Jun 2025"), reason: "missing-nav", status: "unavailable" });
    expect(benchmarkXirr([flow("2025-01-01", "-1000")], "2026-03-01", points)).toMatchObject({ reason: "missing-nav" });
  });

  it("is unavailable when withdrawals exceed what the fund would have held", () => {
    const points = [{ close: 100, date: "2025-01-01" }, { close: 50, date: "2025-06-02" }, { close: 60, date: "2026-01-01" }];
    const result = benchmarkXirr([flow("2025-01-01", "-1000"), flow("2025-06-02", "800")], "2026-01-01", points);
    expect(result).toMatchObject({ reason: "units-below-zero", status: "unavailable" });
  });

  it("values a portfolio-sized history exactly as a flow-by-flow replay would, without rescanning NAV", () => {
    // Seven years of weekday NAV, 480 flows and a month-end for each month, as on a real phone.
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const points: NavPoint[] = [];
    for (let day = Date.parse("2019-03-25T00:00:00Z"); day <= Date.parse("2026-11-26T00:00:00Z"); day += 86_400_000) {
      const date = new Date(day);
      if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) points.push({ close: 60 + random() * 120, date: date.toISOString().slice(0, 10) });
    }
    const flows = Array.from({ length: 480 }, (_, index) => {
      const date = new Date(Date.parse("2019-04-01T00:00:00Z") + Math.floor(random() * 2_780) * 86_400_000).toISOString().slice(0, 10);
      return { ...flow(date, random() < 0.9 ? `-${Math.round(random() * 50_000)}` : `${Math.round(random() * 5_000)}`), id: `f${index}` };
    });
    const dates = Array.from({ length: 92 }, (_, index) => new Date(Date.UTC(2019, 3 + index, 0)).toISOString().slice(0, 10));

    // Reference: replay every flow up to each date, looking each NAV up afresh.
    const ordered = [...flows].sort((a, b) => a.date.localeCompare(b.date));
    const expected = dates.map((date) => {
      let units = decimal(0);
      for (const item of ordered) {
        if (item.date > date) break;
        const nav = navOn(points, item.date);
        if (!nav) return null;
        units = units.minus(decimal(item.amountInr).dividedBy(nav.close));
        if (units.lessThan(-1e-9)) return null;
      }
      const end = navOn(points, date);
      return end ? units.times(end.close).toDecimalPlaces(2).toNumber() : null;
    });

    const started = Date.now();
    const values = benchmarkValuesOn(flows, dates, points);
    expect(Date.now() - started).toBeLessThan(500);
    expect(values).toEqual(expected);
    expect(values.filter((value) => value !== null).length).toBeGreaterThan(80);
  });

  it("keeps the first NAV when a date appears twice, and ignores unusable NAVs", () => {
    const points = [{ close: 0, date: "2026-01-02" }, { close: 100, date: "2026-01-02" }, { close: 105, date: "2026-01-02" }];
    expect(navOn(points, "2026-01-02")).toEqual({ close: 100, date: "2026-01-02" });
    expect(navOn([{ close: Number.NaN, date: "2026-01-02" }], "2026-01-02")).toBeNull();
  });
});
