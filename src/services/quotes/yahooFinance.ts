import type { QuoteProviderInput, QuoteResult } from "./types";
import {
  defaultNow,
  getDefaultFetcher,
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
}: QuoteProviderInput): Promise<QuoteResult> {
  try {
    const response = await fetcher(buildYahooChartUrl(asset.ticker));

    if (!response.ok) {
      return {
        error: `Yahoo quote request failed with status ${response.status}.`,
        ok: false,
      };
    }

    const payload = (await response.json()) as YahooChartResponse;
    const meta = payload.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;

    if (typeof price !== "number") {
      return {
        error: "Yahoo quote response did not include a current price.",
        ok: false,
      };
    }

    const previousClose = meta?.chartPreviousClose;
    const dayChangeAbs =
      typeof previousClose === "number" ? price - previousClose : undefined;
    const dayChangePct =
      typeof previousClose === "number" && previousClose !== 0
        ? (dayChangeAbs! / previousClose) * 100
        : undefined;

    return {
      ok: true,
      quote: {
        assetId: asset.id,
        asOf: now(),
        currency: "INR",
        dayChangeAbs:
          dayChangeAbs === undefined
            ? undefined
            : roundQuoteNumber(dayChangeAbs),
        dayChangePct:
          dayChangePct === undefined
            ? undefined
            : roundQuoteNumber(dayChangePct),
        price,
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
