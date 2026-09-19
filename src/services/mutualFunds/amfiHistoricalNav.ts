import { normalizeIsin } from "@/src/domain/assets";
import type {
  HistoricalPriceProviderInput,
  HistoricalPriceResult,
  QuoteFetcher,
} from "@/src/services/quotes/types";
import { getDefaultFetcher, roundQuoteNumber } from "@/src/services/quotes/utils";

import {
  lookupAmfiSchemeClassifications,
  parseAmfiNavDate,
} from "./amfiSchemeCatalog";

export const amfiNavDownloadPageUrl =
  "https://www.amfiindia.com/net-asset-value/nav-download";
export const amfiHistoricalNavBaseUrl =
  "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx";
const maxAmfiResponseCharacters = 6_000_000;

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function formatAmfiDate(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}-${monthNames[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

export function buildAmfiHistoricalNavUrl(
  fundHouseId: string,
  targetMonth: string,
) {
  const match = /^(\d{4})-(\d{2})$/u.exec(targetMonth);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  if (!match || month < 1 || month > 12) {
    throw new Error("Invalid target month. Expected YYYY-MM with month 01-12.");
  }
  const to = new Date(Date.UTC(year, month, 0));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 9);
  const params = new URLSearchParams({
    frmdt: formatAmfiDate(from),
    mf: fundHouseId,
    todt: formatAmfiDate(to),
  });
  return `${amfiHistoricalNavBaseUrl}?${params.toString()}`;
}

export function parseAmfiFundHouseIds(text: string) {
  const ids: Record<string, string> = {};
  const pattern = /mfId\\?"\s*:\s*\\?"(\d+)\\?"\s*,\s*\\?"mfName\\?"\s*:\s*\\?"([^"\\]+)\\?"/gu;
  for (const match of text.matchAll(pattern)) ids[match[2].trim()] = match[1];
  return ids;
}

function parseAmfiHistoricalNavCatalog(text: string) {
  const points: Record<string, { asOf: string; nav: number }> = {};
  const conflicts = new Set<string>();
  for (const rawLine of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const fields = rawLine.trim().split(";");
    if (fields.length < 8) continue;
    const nav = Number(fields[6]);
    const asOf = parseAmfiNavDate(fields[7]);
    if (!Number.isFinite(nav) || nav <= 0 || !asOf) continue;
    for (const rawIsin of [fields[4], fields[5]]) {
      const isin = normalizeIsin(rawIsin);
      if (!isin || conflicts.has(isin)) continue;
      const latest = points[isin];
      if (latest?.asOf === asOf && latest.nav !== nav) {
        delete points[isin];
        conflicts.add(isin);
      } else if (!latest || asOf > latest.asOf) {
        points[isin] = { asOf, nav };
      }
    }
  }
  return points;
}

export function parseAmfiHistoricalNav(text: string, isin: string) {
  const normalizedIsin = normalizeIsin(isin);
  return normalizedIsin
    ? parseAmfiHistoricalNavCatalog(text)[normalizedIsin]
    : undefined;
}

let fundHouseIds: Record<string, string> | undefined;
let fundHouseRequest: Promise<Record<string, string>> | undefined;
const historyResponseCache = new Map<
  string,
  Promise<Record<string, { asOf: string; nav: number }>>
>();

async function fetchText(fetcher: QuoteFetcher, url: string, label: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${label} request failed with status ${response.status}.`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function loadFundHouseIds(fetcher: QuoteFetcher) {
  if (fundHouseIds) return fundHouseIds;
  fundHouseRequest ??= (async () => {
    const parsed = parseAmfiFundHouseIds(
      await fetchText(fetcher, amfiNavDownloadPageUrl, "AMFI fund-house"),
    );
    if (Object.keys(parsed).length === 0) {
      throw new Error("AMFI fund-house catalogue contained no identities.");
    }
    fundHouseIds = parsed;
    return parsed;
  })().finally(() => {
    fundHouseRequest = undefined;
  });
  return fundHouseRequest;
}

async function loadHistoricalResponse(
  fetcher: QuoteFetcher,
  fundHouseId: string,
  targetMonth: string,
) {
  const key = `${fundHouseId}:${targetMonth}`;
  const cached = historyResponseCache.get(key);
  if (cached) return cached;
  const request = (async () => {
    const text = await fetchText(
      fetcher,
      buildAmfiHistoricalNavUrl(fundHouseId, targetMonth),
      "AMFI historical NAV",
    );
    if (text.length > maxAmfiResponseCharacters) {
      throw new Error("AMFI historical NAV response exceeded the safety limit.");
    }
    return parseAmfiHistoricalNavCatalog(text);
  })().catch((error) => {
    historyResponseCache.delete(key);
    throw error;
  });
  historyResponseCache.set(key, request);
  while (historyResponseCache.size > 12) {
    historyResponseCache.delete(historyResponseCache.keys().next().value!);
  }
  return request;
}

export async function fetchAmfiHistoricalNav({
  asset,
  fetcher = getDefaultFetcher(),
  now = () => new Date().toISOString(),
  targetMonth,
}: HistoricalPriceProviderInput): Promise<HistoricalPriceResult> {
  try {
    const isin = normalizeIsin(asset.isin);
    if (!isin) {
      return {
        error: "A valid mutual-fund ISIN is required for AMFI historical NAV.",
        ok: false,
      };
    }
    const lookup = await lookupAmfiSchemeClassifications({ fetcher, isins: [isin] });
    const scheme = lookup.classifications[isin];
    if (!scheme) {
      return {
        error: lookup.failure ?? "AMFI did not recognize this mutual-fund ISIN.",
        ok: false,
      };
    }
    if (!scheme.fundHouse) {
      return {
        error: "AMFI did not provide a fund-house identity for this scheme.",
        ok: false,
      };
    }
    const ids = await loadFundHouseIds(fetcher);
    const fundHouseId = ids[scheme.fundHouse];
    if (!fundHouseId) {
      return {
        error: "AMFI did not provide a historical identifier for this fund house.",
        ok: false,
      };
    }
    const points = await loadHistoricalResponse(fetcher, fundHouseId, targetMonth);
    const point = points[isin];
    if (!point || point.asOf.slice(0, 7) !== targetMonth) {
      return {
        error: "AMFI historical NAV response did not include a usable NAV for this ISIN and month.",
        ok: false,
      };
    }
    return {
      ok: true,
      quote: {
        assetId: asset.id,
        asOfMonth: targetMonth,
        basis: "historical-close",
        currency: "INR",
        fetchedAt: now(),
        price: roundQuoteNumber(point.nav),
        source: "amfi",
      },
    };
  } catch (error) {
    return { error: `AMFI historical NAV request failed: ${error instanceof Error ? error.message : "Unexpected error."}`, ok: false };
  }
}

export function clearAmfiHistoricalNavCacheForTests() {
  fundHouseIds = undefined;
  fundHouseRequest = undefined;
  historyResponseCache.clear();
}
