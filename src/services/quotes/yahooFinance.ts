import type { QuoteProviderInput, QuoteResult } from "./types";
import {
  defaultNow,
  getDefaultFetcher,
  isUsableProviderPrice,
  providerMarketTime,
  roundQuoteNumber,
  yahooChartBaseUrl,
} from "./utils";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        chartPreviousClose?: number;
        currency?: string;
        regularMarketPrice?: number;
        /** Unix seconds of the last trade or close. */
        regularMarketTime?: number;
      };
    }>;
  };
};

export function buildYahooChartUrl(ticker: string) {
  return `${yahooChartBaseUrl}/${encodeURIComponent(
    ticker,
  )}?range=1d&interval=1d`;
}

export async function fetchYahooQuote({
  asset,
  fetcher = getDefaultFetcher(),
  now = defaultNow,
  signal,
}: QuoteProviderInput): Promise<QuoteResult> {
  try {
    const url = buildYahooChartUrl(asset.quoteSourceId ?? asset.ticker);
    const response = signal
      ? await fetcher(url, { signal })
      : await fetcher(url);

    if (!response.ok) {
      return {
        error: `Yahoo quote request failed with status ${response.status}.`,
        ok: false,
      };
    }

    const payload = (await response.json()) as YahooChartResponse;
    const meta = payload.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;

    if (meta?.currency?.toUpperCase() !== "INR") {
      return {
        error: "Yahoo quote currency was not INR; the price was not accepted.",
        ok: false,
      };
    }

    if (!isUsableProviderPrice(price)) {
      return {
        error: "Yahoo quote response did not include a valid current price.",
        ok: false,
      };
    }

    const fetchedAt = now();
    const asOf = providerMarketTime(meta?.regularMarketTime, fetchedAt);
    if (!asOf) {
      return {
        error: "Yahoo quote response did not include a market time; the price was not accepted.",
        ok: false,
      };
    }

    const previousClose = meta?.chartPreviousClose;
    const dayChangeAbs = isUsableProviderPrice(previousClose)
      ? price - previousClose
      : undefined;
    const dayChangePct = isUsableProviderPrice(previousClose)
      ? (dayChangeAbs! / previousClose) * 100
      : undefined;

    return {
      ok: true,
      quote: {
        assetId: asset.id,
        asOf,
        currency: "INR",
        dayChangeAbs:
          dayChangeAbs === undefined
            ? undefined
            : roundQuoteNumber(dayChangeAbs),
        dayChangePct:
          dayChangePct === undefined
            ? undefined
            : roundQuoteNumber(dayChangePct, 2),
        fetchedAt,
        price: roundQuoteNumber(price),
        source: "yahoo",
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Yahoo quote request failed.",
      ok: false,
    };
  }
}
