import type { Asset } from "@/src/types";

import type {
  DailyPriceEntry,
  DailyPriceRequest,
} from "./dailyPriceCache";

const yahooChartUrl = "https://query1.finance.yahoo.com/v8/finance/chart";
const coinGeckoUrl = "https://api.coingecko.com/api/v3/coins";
const maxResponseBytes = 4 * 1024 * 1024;
const maxYahooRows = 4_000;
const maxCoinGeckoRows = 50_000;

export const cryptoDailyObservationNote =
  "CoinGecko daily observations are UTC-boundary values, not an exchange-closing guarantee.";

export type AssetHistoryErrorKind =
  | "corporate-action"
  | "invalid-data"
  | "offline"
  | "provider-error"
  | "rate-limited"
  | "unsupported";

export class AssetHistoryError extends Error {
  readonly kind: AssetHistoryErrorKind;

  constructor(kind: AssetHistoryErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "AssetHistoryError";
  }
}

type HistoryFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type YahooPayload = {
  chart?: {
    result?: Array<{
      events?: {
        splits?: Record<string, { date?: number }>;
      };
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
      meta?: {
        currency?: string;
        exchangeTimezoneName?: string;
        gmtoffset?: number;
      };
      timestamp?: number[];
    }>;
  };
};

type CoinGeckoPayload = {
  prices?: Array<[number, number]>;
};

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function nextUtcDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1));
}

function dateAtUtcMidnight(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function today(now: Date) {
  return now.toISOString().slice(0, 10);
}

function requestIsValid(request: DailyPriceRequest, now: Date) {
  if (
    request.provider !== "yahoo" && request.provider !== "coingecko" ||
    request.currency !== "INR" && request.currency !== "USD" ||
    request.basis !== "close" && request.basis !== "adjusted-close" ||
    !isDate(request.from) ||
    !isDate(request.to) ||
    request.from > request.to ||
    request.providerId.length === 0 ||
    request.providerId.length > 160
  ) {
    return false;
  }
  if (request.to > today(now) || request.providerId.trim() !== request.providerId) {
    return false;
  }

  return rangeIsWithinTenYears(request.from, request.to);
}

function providerId(asset: Asset) {
  return validatedProviderId(asset.quoteSourceId) ?? validatedProviderId(asset.ticker);
}

function validatedProviderId(value: string | undefined) {
  if (!value || value.trim() !== value || value.length > 160) return null;

  return value;
}

function rangeIsWithinTenYears(from: string, to: string) {
  const [year, month, day] = from.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year + 10, month, 0)).getUTCDate();
  const anniversary = new Date(Date.UTC(year + 10, month - 1, Math.min(day, monthEnd)));

  return dateAtUtcMidnight(to) <= anniversary;
}

export function getAssetHistoryRequest(
  asset: Asset,
  from: string,
  to: string,
): DailyPriceRequest | null {
  if (!isDate(from) || !isDate(to) || from > to || !rangeIsWithinTenYears(from, to)) {
    return null;
  }

  if (
    (asset.assetClass === "stock" || asset.assetClass === "etf") &&
    asset.currency === "INR" &&
    asset.instrumentType !== "mutualFund" &&
    asset.instrumentType !== "ppf" &&
    asset.instrumentType !== "fixedDeposit"
  ) {
    const id = providerId(asset);

    return id
      ? { basis: "close", currency: "INR", from, provider: "yahoo", providerId: id, to }
      : null;
  }

  const cryptoProviderId = validatedProviderId(asset.quoteSourceId);
  if (asset.assetClass === "crypto" && cryptoProviderId) {
    return {
      basis: "close",
      currency: asset.currency,
      from,
      provider: "coingecko",
      providerId: cryptoProviderId,
      to,
    };
  }

  return null;
}

function responseBodyIsTooLarge(response: Response) {
  const value = response.headers?.get("content-length");
  const contentLength = value ? Number(value) : 0;

  return Number.isFinite(contentLength) && contentLength > maxResponseBytes;
}

function throwForResponse(response: Response, provider: string) {
  if (response.status === 429) {
    throw new AssetHistoryError("rate-limited", `${provider} historical request was rate limited.`);
  }
  if (response.status === 403 && provider === "CoinGecko") {
    throw new AssetHistoryError(
      "unsupported",
      "CoinGecko daily history is not available for this public request.",
    );
  }
  throw new AssetHistoryError(
    "provider-error",
    `${provider} historical request failed with status ${response.status}.`,
  );
}

async function getPayload<T>(
  url: string,
  signal: AbortSignal | undefined,
  fetcher: HistoryFetcher,
  provider: string,
) {
  let response: Response;
  try {
    response = await fetcher(url, { signal });
  } catch (error) {
    if (error instanceof AssetHistoryError) throw error;
    throw new AssetHistoryError("offline", `${provider} historical request could not reach the provider.`);
  }

  if (!response.ok) throwForResponse(response, provider);
  if (responseBodyIsTooLarge(response)) {
    throw new AssetHistoryError("invalid-data", `${provider} historical response exceeded the safety limit.`);
  }

  let body: string;
  try {
    body = await response.text();
  } catch {
    throw new AssetHistoryError("invalid-data", `${provider} historical response body could not be read.`);
  }
  if (utf8ByteCount(body) > maxResponseBytes) {
    throw new AssetHistoryError("invalid-data", `${provider} historical response exceeded the safety limit.`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new AssetHistoryError("invalid-data", `${provider} historical response was not valid JSON.`);
  }
}

function utf8ByteCount(value: string) {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function dateInExchange(
  timestamp: number,
  timezone: string | undefined,
  offset: number | undefined,
) {
  const date = new Date(timestamp * 1000);
  if (!Number.isFinite(date.getTime())) return null;

  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        month: "2-digit",
        timeZone: timezone,
        year: "numeric",
      }).formatToParts(date);
      const part = (type: string) => parts.find((item) => item.type === type)?.value;
      const year = part("year");
      const month = part("month");
      const day = part("day");

      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      // Fall back to Yahoo's numeric exchange offset when the runtime lacks this zone.
    }
  }

  if (typeof offset === "number" && Number.isFinite(offset)) {
    return new Date((timestamp + offset) * 1000).toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function hasYahooSplitAfterFrom(
  splits: Record<string, { date?: number }> | undefined,
  from: string,
  now: Date,
) {
  const fromSeconds = dateAtUtcMidnight(from).getTime() / 1000;
  const nowSeconds = now.getTime() / 1000;

  return Object.values(splits ?? {}).some((split) =>
    typeof split.date === "number" &&
    Number.isFinite(split.date) &&
    split.date >= fromSeconds &&
    split.date <= nowSeconds,
  );
}

function yahooUrl(request: DailyPriceRequest, now: Date) {
  const params = new URLSearchParams({
    events: "splits",
    interval: "1d",
    period1: String(dateAtUtcMidnight(request.from).getTime() / 1000),
    period2: String(nextUtcDate(today(now)).getTime() / 1000),
  });

  return `${yahooChartUrl}/${encodeURIComponent(request.providerId)}?${params.toString()}`;
}

function coinGeckoUrlFor(request: DailyPriceRequest) {
  const params = new URLSearchParams({
    from: String(nextUtcDate(request.from).getTime() / 1000),
    interval: "daily",
    to: String(nextUtcDate(request.to).getTime() / 1000 + 1),
    vs_currency: request.currency.toLowerCase(),
  });

  return `${coinGeckoUrl}/${encodeURIComponent(request.providerId)}/market_chart/range?${params.toString()}`;
}

function yahooEntry(request: DailyPriceRequest, payload: YahooPayload, now: Date): DailyPriceEntry {
  const result = payload && typeof payload === "object" ? payload.chart?.result?.[0] : undefined;
  if (!result || result.meta?.currency !== request.currency) {
    throw new AssetHistoryError("invalid-data", "Yahoo historical response currency did not match the request.");
  }
  if (hasYahooSplitAfterFrom(result.events?.splits, request.from, now)) {
    throw new AssetHistoryError(
      "corporate-action",
      "A stock split affects this range. History needs corporate-action support before it can be shown safely.",
    );
  }

  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes) || timestamps.length > maxYahooRows) {
    throw new AssetHistoryError("invalid-data", "Yahoo historical response did not contain a bounded close series.");
  }

  let complete = timestamps.length === closes.length;
  const dates = new Map<string, number>();
  const conflicts = new Set<string>();
  const length = Math.min(timestamps.length, closes.length);
  for (let index = 0; index < length; index += 1) {
    const timestamp = timestamps[index];
    const close = closes[index];
    const date = typeof timestamp === "number"
      ? dateInExchange(timestamp, result.meta?.exchangeTimezoneName, result.meta?.gmtoffset)
      : null;
    if (!date || date < request.from || date > request.to) {
      if (date === null) complete = false;
      continue;
    }
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
      complete = false;
      continue;
    }
    const existing = dates.get(date);
    if (existing !== undefined && existing !== close) {
      complete = false;
      conflicts.add(date);
      dates.delete(date);
      continue;
    }
    if (!conflicts.has(date)) dates.set(date, close);
  }

  const points = [...dates.entries()]
    .map(([date, close]) => ({ close, date }))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (points.length === 0) {
    throw new AssetHistoryError("invalid-data", "Yahoo historical response did not include usable closes.");
  }
  if (
    points[0].date > dateAfter(request.from, 4) ||
    points.at(-1)!.date < dateAfter(request.to, -4)
  ) {
    complete = false;
  }

  return { ...request, complete, fetchedAt: now.toISOString(), points };
}

function coinGeckoEntry(request: DailyPriceRequest, payload: CoinGeckoPayload, now: Date): DailyPriceEntry {
  const prices = payload && typeof payload === "object" ? payload.prices : undefined;
  if (!Array.isArray(prices) || prices.length === 0 || prices.length > maxCoinGeckoRows) {
    throw new AssetHistoryError("invalid-data", "CoinGecko historical response did not contain a bounded price series.");
  }

  let complete = true;
  const dates = new Map<string, number>();
  const conflicts = new Set<string>();
  const firstSampleMs = nextUtcDate(request.from).getTime();
  const lastSampleMs = nextUtcDate(request.to).getTime();
  for (const point of prices) {
    if (!Array.isArray(point) || point.length < 2 || typeof point[0] !== "number" ||
      typeof point[1] !== "number" || !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) || point[1] <= 0) {
      complete = false;
      continue;
    }
    if (point[0] < firstSampleMs || point[0] > lastSampleMs) continue;
    const observedAt = new Date(point[0]);
    if (!Number.isFinite(observedAt.getTime())) {
      complete = false;
      continue;
    }
    if (point[0] % 86_400_000 !== 0) {
      complete = false;
      continue;
    }
    // CoinGecko's midnight observation represents the preceding UTC day's close.
    const date = new Date(point[0] - 1).toISOString().slice(0, 10);
    const existing = dates.get(date);
    if (existing !== undefined && existing !== point[1]) {
      complete = false;
      conflicts.add(date);
      dates.delete(date);
      continue;
    }
    if (!conflicts.has(date)) dates.set(date, point[1]);
  }

  const points = [...dates.entries()]
    .map(([date, close]) => ({ close, date }))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (points.length === 0) {
    throw new AssetHistoryError("invalid-data", "CoinGecko historical response did not include usable prices.");
  }
  for (let cursor = request.from; cursor <= request.to; cursor = dateAfter(cursor, 1)) {
    if (!dates.has(cursor)) complete = false;
  }

  return { ...request, complete, fetchedAt: now.toISOString(), points };
}

function dateAfter(date: string, days: number) {
  const value = dateAtUtcMidnight(date);

  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function fetchAssetHistory(
  request: DailyPriceRequest,
  signal?: AbortSignal,
  fetcher: HistoryFetcher = fetch,
  now: Date = new Date(),
): Promise<DailyPriceEntry> {
  if (!requestIsValid(request, now)) {
    throw new AssetHistoryError("invalid-data", "Daily history request is invalid or outside supported coverage.");
  }
  if (request.basis !== "close") {
    throw new AssetHistoryError("unsupported", "Adjusted-close history is not supported by this provider adapter.");
  }

  if (request.provider === "yahoo") {
    const payload = await getPayload<YahooPayload>(
      yahooUrl(request, now), signal, fetcher, "Yahoo",
    );
    return yahooEntry(request, payload, now);
  }
  if (request.provider === "coingecko") {
    const payload = await getPayload<CoinGeckoPayload>(
      coinGeckoUrlFor(request), signal, fetcher, "CoinGecko",
    );
    return coinGeckoEntry(request, payload, now);
  }

  throw new AssetHistoryError("unsupported", "Daily history provider is unsupported.");
}
