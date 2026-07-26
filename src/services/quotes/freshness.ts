import type { Quote, QuoteCache } from "@/src/types";

export const QUOTE_FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000;

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

  return age <= QUOTE_FRESHNESS_THRESHOLD_MS ? "current" : "stale";
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
