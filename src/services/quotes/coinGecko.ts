import type { QuoteProviderInput, QuoteResult } from "./types";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";
import {
  coinGeckoSimplePriceUrl,
  defaultNow,
  getDefaultFetcher,
  isUsableProviderPrice,
  providerMarketTime,
  roundQuoteNumber,
} from "./utils";

type CoinGeckoSimplePriceResponse = Record<
  string,
  {
    inr?: number;
    inr_24h_change?: number;
    /** Unix seconds of the last price update. */
    last_updated_at?: number;
  }
>;

export function buildCoinGeckoSimplePriceUrl(coinId: string) {
  const params = new URLSearchParams({
    ids: coinId,
    vs_currencies: "inr",
    include_24hr_change: "true",
    include_last_updated_at: "true",
  });

  return `${coinGeckoSimplePriceUrl}?${params.toString()}`;
}

export async function fetchCoinGeckoQuote({
  asset,
  fetcher = getDefaultFetcher(),
  now = defaultNow,
  signal,
}: QuoteProviderInput): Promise<QuoteResult> {
  try {
    const currencyIssue = getV1AssetCurrencyIssue(asset);

    if (currencyIssue) {
      return { error: currencyIssue, ok: false };
    }

    const quoteSourceId = asset.quoteSourceId ?? asset.ticker;
    const url = buildCoinGeckoSimplePriceUrl(quoteSourceId);
    const response = signal
      ? await fetcher(url, { signal })
      : await fetcher(url);

    if (!response.ok) {
      return {
        error: `CoinGecko quote request failed with status ${response.status}.`,
        ok: false,
      };
    }

    const payload = (await response.json()) as CoinGeckoSimplePriceResponse;
    const coinPrice = payload[quoteSourceId];
    const price = coinPrice?.inr;

    if (!isUsableProviderPrice(price)) {
      return {
        error: "CoinGecko quote response did not include a valid INR price.",
        ok: false,
      };
    }

    const fetchedAt = now();
    const asOf = providerMarketTime(coinPrice.last_updated_at, fetchedAt);
    if (!asOf) {
      return {
        error: "CoinGecko quote response did not include an update time; the price was not accepted.",
        ok: false,
      };
    }

    const dayChange = coinPrice.inr_24h_change;
    return {
      ok: true,
      quote: {
        assetId: asset.id,
        asOf,
        currency: "INR",
        dayChangePct:
          typeof dayChange === "number" && Number.isFinite(dayChange)
            ? roundQuoteNumber(dayChange, 2)
            : undefined,
        fetchedAt,
        price: roundQuoteNumber(price),
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
