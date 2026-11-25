import { benchmarkFund, benchmarkMaxNavGapDays, type NavPoint } from "@/src/domain/benchmarkXirr";
import type { DailyPriceEntry, DailyPriceRequest } from "@/src/types";

import { fetchAssetHistory } from "./assetHistoryProvider";
import type { createDailyPriceCache } from "./dailyPriceCache";

/**
 * Daily NAV of the benchmark fund (#765) from AMFI, through the shared daily
 * price cache. AMFI history requests are limited to a year, so the period is
 * read in calendar-year windows; a past year's window never changes once
 * stored, and only the current year is refreshed.
 */

type Cache = Pick<ReturnType<typeof createDailyPriceCache>, "read" | "refresh">;
type Loader = (request: DailyPriceRequest, signal: AbortSignal) => Promise<DailyPriceEntry>;

export type BenchmarkNavResult =
  | { status: "ready"; points: NavPoint[] }
  | { status: "missing" }
  | { status: "failed"; message: string };

function shiftDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Calendar-year windows covering [from - holiday gap, to]. */
export function benchmarkWindows(from: string, to: string) {
  const start = shiftDays(from, -benchmarkMaxNavGapDays);
  const windows: Array<{ from: string; to: string }> = [];
  for (let year = Number(start.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    const windowFrom = year === Number(start.slice(0, 4)) ? start : `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    windows.push({ from: windowFrom, to: yearEnd < to ? yearEnd : to });
  }
  return windows;
}

export function benchmarkRequest(window: { from: string; to: string }): DailyPriceRequest {
  return { basis: "close", currency: "INR", from: window.from, provider: "amfi", providerId: benchmarkFund.isin, to: window.to };
}

function merge(entries: DailyPriceEntry[]): NavPoint[] {
  const byDate = new Map<string, number>();
  for (const entry of entries) for (const point of entry.points) byDate.set(point.date, point.close);
  return [...byDate].map(([date, close]) => ({ close, date })).sort((left, right) => left.date.localeCompare(right.date));
}

/** NAV already cached for the whole period, without any network request. */
export function readCachedBenchmarkNav(cache: Cache, from: string, to: string): BenchmarkNavResult {
  const entries: DailyPriceEntry[] = [];
  for (const window of benchmarkWindows(from, to)) {
    const cached = cache.read(benchmarkRequest(window));
    if (cached.status !== "hit") return { status: "missing" };
    entries.push(cached.entry);
  }
  return { points: merge(entries), status: "ready" };
}

/** Loads every window, fetching only those not cached (and the current one when a day old). */
export async function loadBenchmarkNav(cache: Cache, from: string, to: string, loader: Loader = fetchAssetHistory): Promise<BenchmarkNavResult> {
  const entries: DailyPriceEntry[] = [];
  for (const window of benchmarkWindows(from, to)) {
    const request = benchmarkRequest(window);
    const cached = cache.read(request);
    if (cached.status === "hit" && cached.freshness === "current") {
      entries.push(cached.entry);
      continue;
    }
    const result = await cache.refresh(request, loader);
    const entry = result.status === "refreshed" ? result.entry
      : result.status === "failed" ? result.entry
        : undefined;
    if (!entry) {
      const timedOut = result.status === "failed" && result.reason === "timeout";
      return { message: timedOut
        ? "AMFI took too long to answer. Try again later."
        : "NAV history couldn't be loaded from AMFI. Check your connection and try again.", status: "failed" };
    }
    entries.push(entry);
  }
  return { points: merge(entries), status: "ready" };
}
