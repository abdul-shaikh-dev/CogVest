import { benchmarkValuesOn, type NavPoint } from "@/src/domain/benchmarkXirr";
import type { XirrFlow } from "@/src/domain/xirrInputs";
import type { MonthlySnapshot } from "@/src/types";

/**
 * Data for the benchmark chart (#765): the portfolio's stored month-end
 * values, and today's value, next to what the same flows would be worth in
 * the index fund on the same dates. Portfolio values are never estimated:
 * months without a snapshot are left out.
 */
export type BenchmarkChartData =
  | { status: "chart"; dates: string[]; labels: string[]; portfolio: number[]; fund: number[] }
  /** Too few month-end snapshots in the period to draw a line. */
  | { status: "few"; points: number }
  | { status: "unavailable" };

/** At least this many points, so the chart shows a path rather than a jump. */
export const benchmarkChartMinPoints = 3;

/** The smallest step of half a power of ten at or above the value, so labels stay round. */
export function benchmarkChartCeiling(value: number) {
  if (!(value > 0)) return 1;
  const step = 10 ** Math.floor(Math.log10(value)) / 2;
  return Math.ceil(value / step) * step;
}

export function monthEndOf(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

// Built once and reused: constructing an Intl formatter costs milliseconds on
// Hermes, and a long history formats every month on each render (#851).
let shortMonthYearFormatter: Intl.DateTimeFormat | undefined;

function shortMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  shortMonthYearFormatter ??= new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC", year: "numeric" });
  return shortMonthYearFormatter.format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function buildBenchmarkChartData({ endDate, flows, points, snapshots, startDate }: {
  endDate: string;
  flows: readonly XirrFlow[];
  points: readonly NavPoint[];
  snapshots: readonly Pick<MonthlySnapshot, "month" | "portfolioValue">[];
  startDate: string;
}): BenchmarkChartData {
  const terminal = flows.find((flow) => flow.source === "terminal");
  if (!terminal) return { status: "unavailable" };
  const months = [...snapshots]
    .filter((snapshot) => Number.isFinite(snapshot.portfolioValue))
    .map((snapshot) => ({ date: monthEndOf(snapshot.month), month: snapshot.month, value: snapshot.portfolioValue }))
    .filter((item) => item.date >= startDate && item.date < endDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    // One value a month, even if a month was saved twice.
    .filter((item, index, all) => index === 0 || all[index - 1].month !== item.month);
  const rows = [
    ...months.map((item) => ({ date: item.date, label: shortMonth(item.month), value: item.value })),
    { date: endDate, label: "Now", value: Number(terminal.amountInr) },
  ];
  if (rows.length < benchmarkChartMinPoints) return { points: rows.length, status: "few" };
  const fund = benchmarkValuesOn(flows, rows.map((row) => row.date), points);
  if (fund.some((value) => value === null)) return { status: "unavailable" };
  return {
    dates: rows.map((row) => row.date),
    fund: fund as number[],
    labels: rows.map((row) => row.label),
    portfolio: rows.map((row) => row.value),
    status: "chart",
  };
}
