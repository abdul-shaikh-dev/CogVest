import { normalizeIsin } from "@/src/domain/assets";
import { compareCodeUnits } from "@/src/domain/ordering";
import type { DailyPriceEntry, DailyPriceRequest } from "@/src/types";

import { amfiHistoricalNavBaseUrl, loadAmfiFundHouseIds } from "./amfiHistoricalNav";
import { lookupAmfiSchemeClassifications, parseAmfiNavDate } from "./amfiSchemeCatalog";

/**
 * Daily NAV history for one fund from AMFI's NAV history report (#799).
 *
 * The report returns a whole fund house, and AMFI redirects any request whose
 * dates span more than about four calendar months. A range is fetched one
 * calendar month at a time: a quarter of a large fund house's pre-2022 history
 * runs to about 9M characters, over the response limit, while a month stays
 * near 3M. Monthly reports also keep a phone's memory and data use per request
 * low, and let callers show progress as each month arrives.
 */

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class AmfiDailyNavError extends Error {
  readonly kind: "invalid-data" | "offline" | "provider-error" | "unsupported";

  constructor(kind: AmfiDailyNavError["kind"], message: string) {
    super(message);
    this.kind = kind;
    this.name = "AmfiDailyNavError";
  }
}

const maxResponseCharacters = 6_000_000;
const chunkConcurrency = 2;
// Weekends plus the longest Indian market-holiday run leave no NAV for up to
// six days; a longer silence at a chunk's end means a short or missing answer.
const maxNavGapDays = 6;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utcDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = utcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return isoDate(value);
}

function amfiDate(date: string) {
  const value = utcDate(date);
  return `${String(value.getUTCDate()).padStart(2, "0")}-${monthNames[value.getUTCMonth()]}-${value.getUTCFullYear()}`;
}

/** Splits [from, to] at calendar-month boundaries. */
export function amfiMonthlyChunks(from: string, to: string) {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const start = utcDate(cursor);
    const end = isoDate(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)));
    const chunkTo = end < to ? end : to;
    chunks.push({ from: cursor, to: chunkTo });
    cursor = addDays(chunkTo, 1);
  }
  return chunks;
}

export function buildAmfiDailyNavUrl(fundHouseId: string, from: string, to: string) {
  const params = new URLSearchParams({ frmdt: amfiDate(from), mf: fundHouseId, todt: amfiDate(to) });
  return `${amfiHistoricalNavBaseUrl}?${params.toString()}`;
}

/**
 * Reads one ISIN's NAVs from a fund-house report. A date with two different
 * NAVs is dropped rather than guessed.
 */
export function parseAmfiDailyNav(text: string, isin: string) {
  if (!text.replace(/^﻿/u, "").trimStart().startsWith("Scheme Code;")) {
    // AMFI answers a rejected range with a redirect to its download page.
    throw new AmfiDailyNavError("provider-error", "AMFI did not return a NAV history report for this range.");
  }
  const navs = new Map<string, number>();
  const conflicts = new Set<string>();
  for (const line of text.split(/\r?\n/u)) {
    if (!line.includes(isin)) continue;
    const fields = line.trim().split(";");
    if (fields.length < 8) continue;
    if (normalizeIsin(fields[4]) !== isin && normalizeIsin(fields[5]) !== isin) continue;
    const nav = Number(fields[6]);
    const date = parseAmfiNavDate(fields[7])?.slice(0, 10);
    if (!date || !Number.isFinite(nav) || nav <= 0 || conflicts.has(date)) continue;
    const existing = navs.get(date);
    if (existing !== undefined && existing !== nav) {
      navs.delete(date);
      conflicts.add(date);
      continue;
    }
    navs.set(date, nav);
  }
  return { conflicts: conflicts.size, navs };
}

async function fetchChunk(
  fetcher: Fetcher,
  fundHouseId: string,
  chunk: { from: string; to: string },
  signal: AbortSignal | undefined,
) {
  let response: Response;
  try {
    response = await fetcher(buildAmfiDailyNavUrl(fundHouseId, chunk.from, chunk.to), { signal });
  } catch {
    throw new AmfiDailyNavError("offline", "AMFI NAV history could not be reached.");
  }
  if (!response.ok) {
    throw new AmfiDailyNavError("provider-error", `AMFI NAV history request failed with status ${response.status}.`);
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new AmfiDailyNavError("offline", "AMFI NAV history could not be read.");
  }
  // expo/fetch can resolve a partial body once aborted.
  if (signal?.aborted) throw new AmfiDailyNavError("offline", "AMFI NAV history request was cancelled.");
  if (text.length > maxResponseCharacters) {
    throw new AmfiDailyNavError("invalid-data", "AMFI NAV history response exceeded the safety limit.");
  }
  return text;
}

async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchAmfiDailyNav(
  request: DailyPriceRequest,
  signal: AbortSignal | undefined,
  fetcher: Fetcher,
  now: Date,
): Promise<DailyPriceEntry> {
  const isin = normalizeIsin(request.providerId);
  if (!isin || isin !== request.providerId) {
    throw new AmfiDailyNavError("invalid-data", "AMFI NAV history needs a valid fund ISIN.");
  }
  const lookup = await lookupAmfiSchemeClassifications({ fetcher, isins: [isin] });
  const fundHouse = lookup.classifications[isin]?.fundHouse;
  if (!fundHouse) {
    throw new AmfiDailyNavError(
      lookup.failure ? "offline" : "unsupported",
      lookup.failure ? "AMFI fund details are unavailable right now." : "AMFI did not recognize this fund's ISIN.",
    );
  }
  let fundHouseId: string | undefined;
  try {
    fundHouseId = (await loadAmfiFundHouseIds(fetcher))[fundHouse];
  } catch {
    throw new AmfiDailyNavError("offline", "AMFI fund houses are unavailable right now.");
  }
  if (!fundHouseId) {
    throw new AmfiDailyNavError("unsupported", "AMFI does not publish NAV history for this fund house.");
  }

  const chunks = amfiMonthlyChunks(request.from, request.to);
  const parsed = await mapLimited(chunks, chunkConcurrency, async (chunk) =>
    parseAmfiDailyNav(await fetchChunk(fetcher, fundHouseId, chunk, signal), isin));

  let complete = true;
  let seenNav = false;
  const navs = new Map<string, number>();
  chunks.forEach((chunk, index) => {
    const result = parsed[index];
    if (result.conflicts > 0) complete = false;
    const dates = [...result.navs.keys()].filter((date) => date >= chunk.from && date <= chunk.to).sort(compareCodeUnits);
    if (dates.length === 0) {
      // Before launch a fund has no NAVs; a silent chunk after NAVs began is a gap.
      if (seenNav) complete = false;
      return;
    }
    if (!seenNav && dates[0] > addDays(request.from, maxNavGapDays)) complete = false;
    seenNav = true;
    if (dates.at(-1)! < addDays(chunk.to, -maxNavGapDays)) complete = false;
    for (const date of dates) navs.set(date, result.navs.get(date)!);
  });

  const points = [...navs.entries()]
    .map(([date, close]) => ({ close, date }))
    .sort((left, right) => compareCodeUnits(left.date, right.date));
  if (points.length === 0) {
    throw new AmfiDailyNavError("invalid-data", "AMFI NAV history had no NAVs for this fund in this range.");
  }
  return { ...request, complete, fetchedAt: now.toISOString(), points };
}
