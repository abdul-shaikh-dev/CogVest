import { formatDate } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";

import { calculateXirr } from "./xirr";
import type { XirrFlow } from "./xirrInputs";

/**
 * Benchmark return (#765): what a Nifty 50 index fund would have earned with
 * the portfolio return's own dated flows. Each money-in flow buys fund units
 * at that day's NAV, each money-out flow sells them, and what is left is
 * valued at the NAV on the end date. Hypothetical; never stored.
 */

export const benchmarkFund = {
  isin: "INF789F01XA0",
  name: "UTI Nifty 50 Index Fund (Direct, Growth)",
  shortName: "Nifty 50 index fund",
} as const;

/** NAV is published on trading days only; a flow on a holiday takes the last NAV within this many days. */
export const benchmarkMaxNavGapDays = 6;

export type NavPoint = { close: number; date: string };

export type BenchmarkXirr =
  | { status: "rate"; rate: number; endValueInr: number; navAsOf: string; days: number; shortPeriod: boolean }
  | { status: "unavailable"; reason: "missing-nav" | "units-below-zero" | "no-rate"; message: string };

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Looks up the latest NAV on or before a date, within the holiday gap. The
 * points are sorted once and searched by halving, so replaying hundreds of
 * flows over years of daily NAV stays cheap on a phone. A date with two NAVs
 * keeps the first, as a linear scan would.
 */
export function createNavLookup(points: readonly NavPoint[]) {
  const sorted: NavPoint[] = [];
  for (const point of points
    .filter((item) => Number.isFinite(item.close) && item.close > 0)
    .map((item, index) => ({ index, item }))
    .sort((left, right) => (left.item.date < right.item.date ? -1 : left.item.date > right.item.date ? 1 : left.index - right.index))
    .map(({ item }) => item)) {
    if (sorted.at(-1)?.date !== point.date) sorted.push(point);
  }
  return (date: string): NavPoint | null => {
    let low = 0;
    let high = sorted.length - 1;
    let best: NavPoint | null = null;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (sorted[middle].date <= date) {
        best = sorted[middle];
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return best && daysBetween(best.date, date) <= benchmarkMaxNavGapDays ? best : null;
  };
}

/** The latest NAV on or before the date, within the holiday gap. */
export function navOn(points: readonly NavPoint[], date: string): NavPoint | null {
  return createNavLookup(points)(date);
}

function orderedFlows(flows: readonly XirrFlow[]) {
  return [...flows].filter((item) => item.source !== "terminal").sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * What the index fund would have been worth on each date (#765 chart): the
 * units bought and sold by the flows up to that date, at that date's NAV.
 * Null where NAV is missing or withdrawals exceed the units held. The flows
 * are replayed once, keeping the units held after each one.
 */
export function benchmarkValuesOn(flows: readonly XirrFlow[], dates: readonly string[], points: readonly NavPoint[]): (number | null)[] {
  const lookup = createNavLookup(points);
  const ordered = orderedFlows(flows);
  // Units held after each flow; null from the first flow that can't be replayed.
  const held: (ReturnType<typeof decimal> | null)[] = [];
  let units = decimal(0);
  let broken = false;
  for (const flow of ordered) {
    const nav = broken ? null : lookup(flow.date);
    if (nav) units = units.minus(decimal(flow.amountInr).dividedBy(nav.close));
    if (!nav || units.lessThan(-1e-9)) broken = true;
    held.push(broken ? null : units);
  }
  return dates.map((date) => {
    // Flows on or before the date.
    let low = 0;
    let high = ordered.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (ordered[middle].date <= date) low = middle + 1;
      else high = middle;
    }
    const unitsThen = low === 0 ? decimal(0) : held[low - 1];
    if (!unitsThen) return null;
    const end = lookup(date);
    return end ? unitsThen.times(end.close).toDecimalPlaces(2).toNumber() : null;
  });
}

export function benchmarkXirr(flows: readonly XirrFlow[], endDate: string, points: readonly NavPoint[]): BenchmarkXirr {
  const missing = (date: string): BenchmarkXirr => ({
    message: `The ${benchmarkFund.shortName}'s NAV for ${formatDate(date)} isn't available, so the comparison can't be made.`,
    reason: "missing-nav",
    status: "unavailable",
  });
  const lookup = createNavLookup(points);
  let units = decimal(0);
  const replayed: Array<{ date: string; amountInr: string }> = [];
  for (const flow of orderedFlows(flows)) {
    const nav = lookup(flow.date);
    if (!nav) return missing(flow.date);
    // Money in (negative) buys units; money out (positive) sells them.
    units = units.minus(decimal(flow.amountInr).dividedBy(nav.close));
    if (units.lessThan(-1e-9)) {
      return {
        message: "Money taken out exceeds what the index fund would have held, so the comparison can't be made.",
        reason: "units-below-zero",
        status: "unavailable",
      };
    }
    replayed.push({ amountInr: flow.amountInr, date: flow.date });
  }
  const end = lookup(endDate);
  if (!end) return missing(endDate);
  const endValue = units.times(end.close).toDecimalPlaces(2);
  const result = calculateXirr([...replayed, { amountInr: endValue.toString(), date: endDate }]);
  if (result.status === "unavailable") {
    return { message: "A comparison return can't be calculated from these flows.", reason: "no-rate", status: "unavailable" };
  }
  return { days: result.days, endValueInr: endValue.toNumber(), navAsOf: end.date, rate: result.rate, shortPeriod: result.shortPeriod, status: "rate" };
}
