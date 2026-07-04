import type {
  HistoricalPriceProviderInput,
  HistoricalPriceResult,
} from "./types";
import {
  coinGeckoMarketChartBaseUrl,
  defaultNow,
  getDefaultFetcher,
  roundQuoteNumber,
  yahooChartBaseUrl,
} from "./utils";

type YahooHistoricalChartResponse = {
  chart?: {
    result?: Array<{
      indicators?: {
        quote?: Array<{
          close?: Array<number | null | undefined>;
        }>;
      };
      timestamp?: number[];
    }>;
  };
};

type CoinGeckoHistoricalRangeResponse = {
  prices?: Array<[number, number]>;
};

export function getMonthEndDateUtc(targetMonth: string) {
  const [year, month] = targetMonth.split("-").map(Number);

  return new Date(Date.UTC(year, month, 0, 23, 59, 59));
}

export function buildYahooHistoricalChartUrl(
  ticker: string,
  targetMonth: string,
) {
  const monthEnd = getMonthEndDateUtc(targetMonth);
  const period2 = Math.floor(monthEnd.getTime() / 1000) + 1;
  const period1 = period2 - 14 * 24 * 60 * 60;
  const params = new URLSearchParams({
    interval: "1d",
    period1: String(period1),
    period2: String(period2),
  });

  return `${yahooChartBaseUrl}/${encodeURIComponent(ticker)}?${params.toString()}`;
}

export function buildCoinGeckoHistoricalRangeUrl(
  coinId: string,
  targetMonth: string,
) {
  const monthEnd = getMonthEndDateUtc(targetMonth);
  const to = Math.floor(monthEnd.getTime() / 1000) + 1;
  const from = to - 3 * 24 * 60 * 60;
  const params = new URLSearchParams({
    from: String(from),
    to: String(to),
    vs_currency: "inr",
  });

  return `${coinGeckoMarketChartBaseUrl}/${encodeURIComponent(
    coinId,
  )}/market_chart/range?${params.toString()}`;
}

export async function fetchYahooHistoricalPrice({
  asset,
  fetcher = getDefaultFetcher(),
  now = defaultNow,
  targetMonth,
}: HistoricalPriceProviderInput): Promise<HistoricalPriceResult> {
  try {
    const response = await fetcher(
      buildYahooHistoricalChartUrl(asset.quoteSourceId ?? asset.ticker, targetMonth),
    );

    if (!response.ok) {
      return {
        error: `Yahoo historical price request failed with status ${response.status}.`,
        ok: false,
      };
    }

    const payload = (await response.json()) as YahooHistoricalChartResponse;
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const monthEndSeconds = Math.floor(getMonthEndDateUtc(targetMonth).getTime() / 1000);

    const latestClose = timestamps
      .map((timestamp, index) => ({
        close: closes[index],
        timestamp,
      }))
      .filter(
        (point) =>
          point.timestamp <= monthEndSeconds &&
          typeof point.close === "number" &&
          Number.isFinite(point.close),
      )
      .at(-1);

    if (!latestClose) {
      return {
        error: "Yahoo historical price response did not include a usable close.",
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
        price: roundQuoteNumber(latestClose.close),
        source: "yahoo",
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Yahoo historical price request failed.",
      ok: false,
    };
  }
}

export async function fetchCoinGeckoHistoricalPrice({
  asset,
  fetcher = getDefaultFetcher(),
  now = defaultNow,
  targetMonth,
}: HistoricalPriceProviderInput): Promise<HistoricalPriceResult> {
  try {
    const response = await fetcher(
      buildCoinGeckoHistoricalRangeUrl(
        asset.quoteSourceId ?? asset.ticker,
        targetMonth,
      ),
    );

    if (!response.ok) {
      return {
        error: `CoinGecko historical price request failed with status ${response.status}.`,
        ok: false,
      };
    }

    const payload = (await response.json()) as CoinGeckoHistoricalRangeResponse;
    const monthEndMs = getMonthEndDateUtc(targetMonth).getTime();
    const latestPrice = (payload.prices ?? [])
      .filter(
        (point) =>
          point[0] <= monthEndMs &&
          typeof point[1] === "number" &&
          Number.isFinite(point[1]),
      )
      .at(-1);

    if (!latestPrice) {
      return {
        error: "CoinGecko historical price response did not include a usable INR price.",
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
        price: roundQuoteNumber(latestPrice[1]),
        source: "coingecko",
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "CoinGecko historical price request failed.",
      ok: false,
    };
  }
}

export function resolveHistoricalPrice(input: HistoricalPriceProviderInput) {
  if (input.asset.assetClass === "cash" || input.asset.assetClass === "debt") {
    return Promise.resolve({
      error: "Historical provider prices are not available for this asset class.",
      ok: false,
    } satisfies HistoricalPriceResult);
  }

  return input.asset.assetClass === "crypto"
    ? fetchCoinGeckoHistoricalPrice(input)
    : fetchYahooHistoricalPrice(input);
}
