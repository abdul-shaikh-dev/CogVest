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
