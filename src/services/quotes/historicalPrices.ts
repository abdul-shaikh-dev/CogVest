import type {
  HistoricalPriceProviderInput,
  HistoricalPriceResult,
} from "./types";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";
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
      meta?: {
        currency?: string;
      };
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

type HistoricalClosePoint = {
  close: number;
  timestamp: number;
};

type CoinGeckoHistoricalPricePoint = {
  price: number;
  timestampMs: number;
};

const invalidTargetMonthMessage =
  "Invalid target month. Expected YYYY-MM with month 01-12.";

function validateTargetMonth(targetMonth: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(targetMonth);

  if (!match) {
    throw new Error(invalidTargetMonthMessage);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(invalidTargetMonthMessage);
  }

  return { month, year };
}

function getErrorMessage(prefix: string, error: unknown) {
  return `${prefix}: ${error instanceof Error ? error.message : "Unexpected error."}`;
}

export function getMonthEndDateUtc(targetMonth: string) {
  const { month, year } = validateTargetMonth(targetMonth);

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
    const currencyIssue = getV1AssetCurrencyIssue(asset);

    if (currencyIssue) {
      return { error: currencyIssue, ok: false };
    }

    const providerId = asset.quoteSourceId ?? asset.ticker;
    const response = await fetcher(
      buildYahooHistoricalChartUrl(providerId, targetMonth),
    );

    if (!response.ok) {
      return {
        error: `Yahoo historical price request failed with status ${response.status}.`,
        ok: false,
      };
    }

    const payload = (await response.json()) as YahooHistoricalChartResponse;
    const result = Array.isArray(payload.chart?.result)
      ? payload.chart.result[0]
      : undefined;

    if (result?.meta?.currency?.toUpperCase() !== "INR") {
      return {
        error:
          "Yahoo historical quote currency was not INR; the price was not accepted.",
        ok: false,
      };
    }

    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const monthEndSeconds = Math.floor(
      getMonthEndDateUtc(targetMonth).getTime() / 1000,
    );

    const latestClose = timestamps
      .map((timestamp, index) => ({
        close: closes[index],
        timestamp,
      }))
      .filter((point): point is HistoricalClosePoint => {
        return (
          typeof point.timestamp === "number" &&
          Number.isFinite(point.timestamp) &&
          point.timestamp <= monthEndSeconds &&
          typeof point.close === "number" &&
          Number.isFinite(point.close)
        );
      })
      .reduce<HistoricalClosePoint | undefined>((latestPoint, point) => {
        if (!latestPoint || point.timestamp > latestPoint.timestamp) {
          return point;
        }

        return latestPoint;
      }, undefined);

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
      error: getErrorMessage("Yahoo historical price request failed", error),
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
    const currencyIssue = getV1AssetCurrencyIssue(asset);

    if (currencyIssue) {
      return { error: currencyIssue, ok: false };
    }

    const providerId = asset.quoteSourceId ?? asset.ticker;
    const response = await fetcher(
      buildCoinGeckoHistoricalRangeUrl(providerId, targetMonth),
    );

    if (!response.ok) {
      return {
        error: `CoinGecko historical price request failed with status ${response.status}.`,
        ok: false,
      };
    }

    const payload = (await response.json()) as CoinGeckoHistoricalRangeResponse;
    const monthEndMs = getMonthEndDateUtc(targetMonth).getTime();
    const latestPrice = (Array.isArray(payload.prices) ? payload.prices : [])
      .filter((point): point is [number, number] => {
        return (
          Array.isArray(point) &&
          point.length === 2 &&
          typeof point[0] === "number" &&
          Number.isFinite(point[0]) &&
          typeof point[1] === "number" &&
          Number.isFinite(point[1]) &&
          point[0] <= monthEndMs
        );
      })
      .map(([timestampMs, price]) => ({ price, timestampMs }))
      .reduce<CoinGeckoHistoricalPricePoint | undefined>((latestPoint, point) => {
        if (!latestPoint || point.timestampMs > latestPoint.timestampMs) {
          return point;
        }

        return latestPoint;
      }, undefined);

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
        price: roundQuoteNumber(latestPrice.price),
        source: "coingecko",
      },
    };
  } catch (error) {
    return {
      error: getErrorMessage("CoinGecko historical price request failed", error),
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
