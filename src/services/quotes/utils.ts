import type { Asset, Quote } from "@/src/types";
import {
  financialPrecision,
  roundHalfUp,
} from "@/src/domain/precision";

import type { QuoteFetcher, QuoteNow } from "./types";

export const yahooChartBaseUrl =
  "https://query1.finance.yahoo.com/v8/finance/chart";
export const coinGeckoSimplePriceUrl =
  "https://api.coingecko.com/api/v3/simple/price";
export const coinGeckoMarketChartBaseUrl =
  "https://api.coingecko.com/api/v3/coins";

export function defaultNow() {
  return new Date().toISOString();
}

export function getDefaultFetcher(): QuoteFetcher {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available.");
  }

  return fetch;
}

/** A provider price is usable only if it is a finite number above zero (#658). */
export function isUsableProviderPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * The market time of a provider quote as an ISO timestamp, or undefined when it
 * is missing or invalid. A time ahead of the fetch (a device clock running
 * behind) is capped at the fetch time, so the quote is never dated in the future.
 */
export function providerMarketTime(epochSeconds: unknown, fetchedAt: string) {
  if (typeof epochSeconds !== "number" || !Number.isFinite(epochSeconds) || epochSeconds <= 0) {
    return undefined;
  }
  const marketMs = epochSeconds * 1000;
  const fetchedMs = Date.parse(fetchedAt);
  return new Date(Number.isFinite(fetchedMs) ? Math.min(marketMs, fetchedMs) : marketMs).toISOString();
}

export function roundQuoteNumber(
  value: number,
  decimals: number = financialPrecision.unitPrice,
) {
  return roundHalfUp(value, decimals);
}

export function createManualQuote({
  asset,
  now = defaultNow,
  price,
}: {
  asset: Asset;
  now?: QuoteNow;
  price: number;
}): Quote {
  return {
    assetId: asset.id,
    asOf: now(),
    currency: "INR",
    price: roundQuoteNumber(price),
    source: "manual",
  };
}
