import type { QuoteProviderInput, QuoteResult } from "./types";
import {
  coinGeckoSimplePriceUrl,
  defaultNow,
  getDefaultFetcher,
  roundQuoteNumber,
} from "./utils";

type CoinGeckoSimplePriceResponse = Record<
  string,
  {
    inr?: number;
    inr_24h_change?: number;
  }
>;

export function buildCoinGeckoSimplePriceUrl(coinId: string) {
  const params = new URLSearchParams({
    ids: coinId,
    vs_currencies: "inr",
    include_24hr_change: "true",
  });

  return `${coinGeckoSimplePriceUrl}?${params.toString()}`;
}

export async function fetchCoinGeckoQuote({
  asset,
  fetcher = getDefaultFetcher(),
  now = defaultNow,
}: QuoteProviderInput): Promise<QuoteResult> {
  try {
    const response = await fetcher(buildCoinGeckoSimplePriceUrl(asset.ticker));

    if (!response.ok) {
      return {
        error: `CoinGecko quote request failed with status ${response.status}.`,
        ok: false,
      };
    }

    const payload = (await response.json()) as CoinGeckoSimplePriceResponse;
    const coinPrice = payload[asset.ticker];
    const price = coinPrice?.inr;

    if (typeof price !== "number") {
      return {
        error: "CoinGecko quote response did not include an INR price.",
        ok: false,
      };
    }

    return {
      ok: true,
      quote: {
        assetId: asset.id,
        asOf: now(),
        currency: "INR",
        dayChangePct:
          typeof coinPrice.inr_24h_change === "number"
            ? roundQuoteNumber(coinPrice.inr_24h_change)
            : undefined,
        price,
        source: "coingecko",
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "CoinGecko quote request failed.",
      ok: false,
    };
  }
}
