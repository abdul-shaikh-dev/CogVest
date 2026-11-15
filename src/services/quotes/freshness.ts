import type { Quote, QuoteCache } from "@/src/types";

export const QUOTE_FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000;
export const AMFI_QUOTE_FRESHNESS_THRESHOLD_MS = 4 * 24 * 60 * 60 * 1000;
/** The oldest market time a just-fetched exchange or crypto price can have and stay current. */
export const MARKET_TIME_FRESHNESS_THRESHOLD_MS = 4 * 24 * 60 * 60 * 1000;

export type QuoteFreshness = "current" | "stale" | "manual" | "missing";

export type PortfolioQuoteFreshness =
  | QuoteFreshness
  | "empty"
  | "partial";

export type QuoteFreshnessSummary = {
  current: number;
  manual: number;
  missing: number;
  stale: number;
  status: PortfolioQuoteFreshness;
  total: number;
};

export function classifyQuoteFreshness(
  quote: Quote | undefined,
  now = new Date(),
): QuoteFreshness {
  if (!quote) {
    return "missing";
  }

  if (quote.source === "manual") {
    return "manual";
  }

  const quoteTime = new Date(quote.asOf).getTime();

  if (!Number.isFinite(quoteTime)) {
    return "missing";
  }

  const age = now.getTime() - quoteTime;

  if (age < 0) {
    return "missing";
  }

  if (quote.source === "amfi") {
    return age <= AMFI_QUOTE_FRESHNESS_THRESHOLD_MS ? "current" : "stale";
  }

  // Since #658 asOf is the market time and fetchedAt the fetch. A price is
  // current when it was fetched recently and the market time is recent enough
  // to be the latest price: a Friday close fetched on Sunday stays current, a
  // suspended stock's month-old price does not. Older quotes have no
  // fetchedAt; their asOf was the fetch time.
  const fetchedTime = quote.fetchedAt === undefined ? quoteTime : new Date(quote.fetchedAt).getTime();
  if (!Number.isFinite(fetchedTime) || fetchedTime > now.getTime()) {
    return "missing";
  }

  return now.getTime() - fetchedTime <= QUOTE_FRESHNESS_THRESHOLD_MS &&
    age <= MARKET_TIME_FRESHNESS_THRESHOLD_MS
    ? "current"
    : "stale";
}

export function summarizeQuoteFreshness(
  assetIds: string[],
  quoteCache: QuoteCache,
  now = new Date(),
): QuoteFreshnessSummary {
  const uniqueAssetIds = [...new Set(assetIds)];
  const counts = {
    current: 0,
    manual: 0,
    missing: 0,
    stale: 0,
  };

  for (const assetId of uniqueAssetIds) {
    counts[classifyQuoteFreshness(quoteCache[assetId], now)] += 1;
  }

  const populatedStates = Object.values(counts).filter((count) => count > 0);
  const status: PortfolioQuoteFreshness =
    uniqueAssetIds.length === 0
      ? "empty"
      : populatedStates.length > 1
        ? "partial"
        : counts.current > 0
          ? "current"
          : counts.stale > 0
            ? "stale"
            : counts.manual > 0
              ? "manual"
              : "missing";

  return {
    ...counts,
    status,
    total: uniqueAssetIds.length,
  };
}
