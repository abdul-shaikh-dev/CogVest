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

/** The latest NAV on or before the date, within the holiday gap. */
export function navOn(points: readonly NavPoint[], date: string): NavPoint | null {
  let best: NavPoint | null = null;
  for (const point of points) {
    if (point.date <= date && Number.isFinite(point.close) && point.close > 0 && (!best || point.date > best.date)) best = point;
  }
  return best && daysBetween(best.date, date) <= benchmarkMaxNavGapDays ? best : null;
}

export function benchmarkXirr(flows: readonly XirrFlow[], endDate: string, points: readonly NavPoint[]): BenchmarkXirr {
  const missing = (date: string): BenchmarkXirr => ({
    message: `The ${benchmarkFund.shortName}'s NAV for ${formatDate(date)} isn't available, so the comparison can't be made.`,
    reason: "missing-nav",
    status: "unavailable",
  });
  let units = decimal(0);
  const replayed: Array<{ date: string; amountInr: string }> = [];
  for (const flow of [...flows].filter((item) => item.source !== "terminal").sort((a, b) => a.date.localeCompare(b.date))) {
    const nav = navOn(points, flow.date);
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
  const end = navOn(points, endDate);
  if (!end) return missing(endDate);
  const endValue = units.times(end.close).toDecimalPlaces(2);
  const result = calculateXirr([...replayed, { amountInr: endValue.toString(), date: endDate }]);
  if (result.status === "unavailable") {
    return { message: "A comparison return can't be calculated from these flows.", reason: "no-rate", status: "unavailable" };
  }
  return { days: result.days, endValueInr: endValue.toNumber(), navAsOf: end.date, rate: result.rate, shortPeriod: result.shortPeriod, status: "rate" };
}
