import { parseCalendarDate } from "./dates";
import { decimal } from "./precision";

/**
 * Bounded XIRR solver for #534. Contract: docs/design/xirr-solver.md.
 * Solves sum(C_i / (1 + r)^(days_i / 365)) = 0 over r in [XIRR_MIN_RATE, XIRR_MAX_RATE].
 * A rate is returned only when exactly one root is proven inside that range.
 */

export const XIRR_MIN_RATE = -0.9999;
export const XIRR_MAX_RATE = 100;
/** Periods shorter than this are annualised but flagged for an explicit qualification. */
export const XIRR_SHORT_PERIOD_DAYS = 365;
/** Bisection stops once the bracket on ln(1 + r) is narrower than this. */
const X_TOLERANCE = 1e-12;
const MAX_BISECTIONS = 200;
/** Root isolation gives up rather than guessing after this many interval checks. */
const MAX_INTERVALS = 20_000;
/** Centred exponents stay finite for any period up to this length. */
const MAX_SPAN_DAYS = 150 * 365;

export type XirrCashFlow = { date: string; amountInr: string };

export type XirrUnavailable =
  | "invalid-flow" | "single-date" | "no-negative-flow" | "no-positive-flow"
  | "no-rate-in-range" | "multiple-rates" | "undetermined";

export type XirrResult =
  | {
    status: "rate";
    /** Annual rate as a fraction: 0.1 is 10%. */
    rate: number;
    startDate: string;
    endDate: string;
    days: number;
    /** Shorter than a year: annualised, not the period gain; the UI must say so. */
    shortPeriod: boolean;
  }
  | { status: "unavailable"; reason: XirrUnavailable };

function dayNumber(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * Validates, combines same-day flows and scales amounts so the largest is 1.
 * Times are centred on the middle of the period: multiplying f by the positive
 * factor e^(x T / 2) keeps every exponent bounded without moving any root.
 */
function prepare(flows: readonly XirrCashFlow[]) {
  const byDate = new Map<string, ReturnType<typeof decimal>>();
  for (const flow of flows) {
    if (flow.date.length !== 10 || !parseCalendarDate(flow.date)) return null;
    let amount;
    try {
      amount = decimal(flow.amountInr);
    } catch {
      return null;
    }
    if (!Number.isFinite(amount.toNumber())) return null;
    byDate.set(flow.date, (byDate.get(flow.date) ?? decimal(0)).plus(amount));
  }
  const dates = [...byDate.keys()].sort();
  const nonZero = dates.filter((date) => !byDate.get(date)!.isZero());
  if (!nonZero.length) return { first: "", last: "", terms: [] };
  const scale = nonZero.map((date) => byDate.get(date)!.abs()).reduce((a, b) => (a.greaterThan(b) ? a : b));
  const [first, last] = [nonZero[0], nonZero[nonZero.length - 1]];
  const middle = (dayNumber(first) + dayNumber(last)) / 2;
  const terms = nonZero.map((date) => ({
    t: (dayNumber(date) - middle) / 365,
    c: byDate.get(date)!.dividedBy(scale).toNumber(),
  }));
  return { first, last, terms };
}

type Term = { t: number; c: number };

/** f(x) = sum c_i e^(-x t_i), with x = ln(1 + r) and t centred on the period. */
function npv(terms: readonly Term[], x: number) {
  return terms.reduce((sum, { t, c }) => sum + c * Math.exp(-x * t), 0);
}

/** Each term is monotone in x, so its range on [a, b] lies between its endpoint values. */
function enclosure(terms: readonly Term[], a: number, b: number, derivative: boolean) {
  let low = 0;
  let high = 0;
  let magnitude = 0;
  for (const { t, c } of terms) {
    const k = derivative ? -t * c : c;
    const ends = [k * Math.exp(-a * t), k * Math.exp(-b * t)];
    low += Math.min(...ends);
    high += Math.max(...ends);
    magnitude += Math.max(Math.abs(ends[0]), Math.abs(ends[1]));
  }
  // Floating-point slack: never treat a bound this close to zero as proof of a sign.
  const slack = magnitude * 1e-12;
  return { low: low - slack, high: high + slack };
}

/** Counts roots of f on [a, b] exactly, or returns null when they cannot be isolated in budget. */
function isolateRoots(terms: readonly Term[], a: number, b: number) {
  const roots: Array<[number, number]> = [];
  const stack: Array<[number, number]> = [[a, b]];
  let checked = 0;
  while (stack.length) {
    if (++checked > MAX_INTERVALS) return null;
    const [lo, hi] = stack.pop()!;
    const value = enclosure(terms, lo, hi, false);
    if (value.low > 0 || value.high < 0) continue;
    const slope = enclosure(terms, lo, hi, true);
    if (slope.low > 0 || slope.high < 0) {
      // Strictly monotone here: at most one root, present exactly when the ends differ in sign.
      const [fl, fh] = [npv(terms, lo), npv(terms, hi)];
      if (fl === 0 || fh === 0 || Math.sign(fl) !== Math.sign(fh)) roots.push([lo, hi]);
      continue;
    }
    const mid = (lo + hi) / 2;
    if (mid <= lo || mid >= hi) return null;
    stack.push([lo, mid], [mid, hi]);
  }
  return roots;
}

function bisect(terms: readonly Term[], lo: number, hi: number) {
  let fl = npv(terms, lo);
  if (fl === 0) return lo;
  if (npv(terms, hi) === 0) return hi;
  for (let i = 0; i < MAX_BISECTIONS && hi - lo > X_TOLERANCE; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(terms, mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(fl)) {
      lo = mid;
      fl = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calculateXirr(flows: readonly XirrCashFlow[]): XirrResult {
  const prepared = prepare(flows);
  if (!prepared) return { status: "unavailable", reason: "invalid-flow" };
  const { first, last, terms } = prepared;
  if (!terms.some(({ c }) => c < 0)) return { status: "unavailable", reason: "no-negative-flow" };
  if (!terms.some(({ c }) => c > 0)) return { status: "unavailable", reason: "no-positive-flow" };
  // Both signs need two dates after same-day netting; kept as a guard.
  if (new Set(terms.map(({ t }) => t)).size < 2) return { status: "unavailable", reason: "single-date" };
  const days = dayNumber(last) - dayNumber(first);
  if (days > MAX_SPAN_DAYS) return { status: "unavailable", reason: "undetermined" };

  const roots = isolateRoots(terms, Math.log1p(XIRR_MIN_RATE), Math.log1p(XIRR_MAX_RATE));
  if (roots === null) return { status: "unavailable", reason: "undetermined" };
  if (!roots.length) return { status: "unavailable", reason: "no-rate-in-range" };
  // Adjacent intervals can share a root that sits exactly on their boundary.
  const distinct = roots.sort((p, q) => p[0] - q[0])
    .filter((root, i, all) => i === 0 || root[0] > all[i - 1][1] || npv(terms, root[0]) !== 0);
  if (distinct.length > 1) return { status: "unavailable", reason: "multiple-rates" };

  const rate = Math.expm1(bisect(terms, ...distinct[0]));
  if (!Number.isFinite(rate)) return { status: "unavailable", reason: "undetermined" };
  return {
    status: "rate",
    rate,
    startDate: first,
    endDate: last,
    days,
    shortPeriod: days < XIRR_SHORT_PERIOD_DAYS,
  };
}
