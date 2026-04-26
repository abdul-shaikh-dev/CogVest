import type { Asset, Quote } from "@/src/types";

import type { QuoteFetcher, QuoteNow } from "./types";

export const yahooChartBaseUrl =
  "https://query1.finance.yahoo.com/v8/finance/chart";
export const coinGeckoSimplePriceUrl =
  "https://api.coingecko.com/api/v3/simple/price";

export function defaultNow() {
  return new Date().toISOString();
}

export function getDefaultFetcher(): QuoteFetcher {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available.");
  }

  return fetch;
}

export function roundQuoteNumber(value: number, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round((value + Number.EPSILON) * factor) / factor;
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
    price,
    source: "manual",
  };
}
