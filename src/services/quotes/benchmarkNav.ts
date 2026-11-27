import { benchmarkFund, benchmarkMaxNavGapDays, type NavPoint } from "@/src/domain/benchmarkXirr";
import type { DailyPriceEntry, DailyPriceRequest } from "@/src/types";

import { amfiMonthlyChunks } from "@/src/services/mutualFunds/amfiDailyNav";
import { amfiHistoricalNavBaseUrl } from "@/src/services/mutualFunds/amfiHistoricalNav";

import { AssetHistoryError, fetchAssetHistory } from "./assetHistoryProvider";
import type { createDailyPriceCache, DailyPriceRefreshResult } from "./dailyPriceCache";

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

/**
 * Providers date "today" in UTC, so the last window stops there. In India the
 * local date runs ahead of UTC until 05:30; the end date then takes the
 * previous NAV, within the holiday gap.
 */
function providerWindows(from: string, to: string, now: Date) {
  const utcToday = now.toISOString().slice(0, 10);
  return benchmarkWindows(from, to < utcToday ? to : utcToday);
}

/** NAV already cached for the whole period, without any network request. */
export function readCachedBenchmarkNav(cache: Cache, from: string, to: string, now = new Date()): BenchmarkNavResult {
  const entries: DailyPriceEntry[] = [];
  for (const window of providerWindows(from, to, now)) {
    const cached = cache.read(benchmarkRequest(window));
    if (cached.status !== "hit") return { status: "missing" };
    entries.push(cached.entry);
  }
  return { points: merge(entries), status: "ready" };
}

/**
 * How far the load has got, over the years that need a request (cached years
 * don't count). `fraction` also moves within a year as AMFI's monthly reports
 * arrive, when the default loader is used.
 */
export type BenchmarkNavProgress = { fraction: number; year: number; yearIndex: number; years: number };

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Counts each AMFI monthly report once its body has been read. */
function countingFetcher(onReport: () => void): Fetcher {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (!input.startsWith(amfiHistoricalNavBaseUrl)) return response;
    return {
      ok: response.ok,
      status: response.status,
      text: async () => {
        const text = await response.text();
        onReport();
        return text;
      },
    } as Response;
  };
}

function failureMessage(result: DailyPriceRefreshResult, year: number, error: unknown, yearsSaved: number) {
  const reason = result.status === "failed" ? result.reason : "unavailable";
  const cause = reason === "timeout"
    ? `AMFI took too long to send the ${year} NAV history.`
    : reason === "failed" && error instanceof AssetHistoryError && error.kind === "offline"
      ? `AMFI couldn't be reached while loading ${year}. Check your connection.`
      : reason === "failed" && error instanceof Error
        ? `The ${year} NAV history from AMFI couldn't be read: ${error.message}`
        : reason === "mismatch"
          ? `AMFI's ${year} NAV history didn't match what was asked for.`
          : `The ${year} NAV history couldn't be saved on this phone.`;
  return yearsSaved > 0 ? `${cause} Earlier years are saved, so trying again continues from ${year}.` : cause;
}

/**
 * Loads every window, fetching only those not cached (and the current one when
 * a day old). Each fetched year is stored as it arrives, so a retry after a
 * failure continues from the first missing year. A failure names the year and
 * why it failed.
 */
export async function loadBenchmarkNav(
  cache: Cache,
  from: string,
  to: string,
  loader?: Loader,
  now = new Date(),
  onProgress?: (progress: BenchmarkNavProgress) => void,
): Promise<BenchmarkNavResult> {
  const windows = providerWindows(from, to, now).map((window) => {
    const request = benchmarkRequest(window);
    const cached = cache.read(request);
    return { cached: cached.status === "hit" && cached.freshness === "current" ? cached.entry : undefined, request };
  });
  const years = windows.filter((window) => !window.cached).length;
  let yearIndex = 0;
  let monthsDone = 0;
  let monthsInYear = 1;
  let year = 0;
  const report = () => onProgress?.({
    fraction: Math.min(1, (yearIndex + Math.min(monthsDone, monthsInYear) / monthsInYear) / Math.max(years, 1)),
    year,
    yearIndex,
    years,
  });
  const base: Loader = loader ?? ((request, signal) =>
    fetchAssetHistory(request, signal, countingFetcher(() => { monthsDone += 1; report(); })));
  let lastError: unknown;
  const tracked: Loader = async (request, signal) => {
    try {
      return await base(request, signal);
    } catch (error) {
      lastError = error;
      throw error;
    }
  };

  const entries: DailyPriceEntry[] = [];
  for (const { cached, request } of windows) {
    if (cached) {
      entries.push(cached);
      continue;
    }
    year = Number(request.to.slice(0, 4));
    monthsDone = 0;
    monthsInYear = amfiMonthlyChunks(request.from, request.to).length;
    lastError = undefined;
    report();
    const result = await cache.refresh(request, tracked);
    const entry = result.status === "refreshed" ? result.entry
      : result.status === "failed" ? result.entry
        : undefined;
    if (!entry) return { message: failureMessage(result, year, lastError, entries.length), status: "failed" };
    entries.push(entry);
    yearIndex += 1;
  }
  if (years > 0) {
    loadedVersion += 1;
    for (const listener of listeners) listener();
  }
  return { points: merge(entries), status: "ready" };
}

// Progress loads NAV; the Dashboard summary only reads the cache, so it is told
// when a load has stored new years.
let loadedVersion = 0;
const listeners = new Set<() => void>();

export function subscribeBenchmarkNavLoads(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function benchmarkNavLoadVersion() {
  return loadedVersion;
}
