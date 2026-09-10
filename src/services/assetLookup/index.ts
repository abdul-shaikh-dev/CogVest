import {
  createCanonicalAssetMatcher,
  getDefaultAssetMetadata,
} from "@/src/domain/assets";
import type {
  AssetClass,
  AssetExchange,
  Currency,
  InstrumentType,
  SectorType,
} from "@/src/types";

import type { QuoteFetcher } from "@/src/services/quotes";
import { getDefaultFetcher } from "@/src/services/quotes/utils";

export type AssetLookupProvider = "coingecko" | "yahoo";

export type AssetMetadataConfidence = "inferred" | "provider" | "reviewRequired";

export type AssetLookupResult = {
  assetClass: AssetClass;
  currency: Currency;
  exchange?: AssetExchange;
  id: string;
  instrumentType: InstrumentType;
  instrumentTypeConfidence: AssetMetadataConfidence;
  metadataReviewMessage: string;
  name: string;
  provider: AssetLookupProvider;
  quoteSourceId: string;
  sectorType: SectorType;
  sectorTypeConfidence: AssetMetadataConfidence;
  sourceLabel: string;
  symbol: string;
  ticker: string;
};

export type AssetLookupSearchResult = {
  failures: string[];
  results: AssetLookupResult[];
};

export const assetLookupPageSize = 20;
export const maxAssetLookupResults = 100;

export type YahooSearchQuote = {
  exchange?: string;
  industry?: string;
  industryDisp?: string;
  longname?: string;
  quoteType?: string;
  sector?: string;
  sectorDisp?: string;
  shortname?: string;
  symbol?: string;
};

type YahooSearchResponse = {
  quotes?: YahooSearchQuote[];
};

export type CoinGeckoSearchCoin = {
  id?: string;
  name?: string;
  symbol?: string;
};

type CoinGeckoSearchResponse = {
  coins?: CoinGeckoSearchCoin[];
};

export function buildYahooSearchUrl(query: string) {
  const params = new URLSearchParams({
    q: query,
    quotesCount: String(maxAssetLookupResults),
    newsCount: "0",
  });

  return `https://query2.finance.yahoo.com/v1/finance/search?${params.toString()}`;
}

export function buildCoinGeckoSearchUrl(query: string) {
  const params = new URLSearchParams({
    query,
  });

  return `https://api.coingecko.com/api/v3/search?${params.toString()}`;
}

function inferYahooExchange(symbol: string): AssetExchange | undefined {
  if (symbol.endsWith(".NS")) {
    return "NSE";
  }

  if (symbol.endsWith(".BO")) {
    return "BSE";
  }

  return undefined;
}

function normalizeYahooSymbol(symbol: string) {
  return symbol.replace(/\.(NS|BO)$/u, "").toUpperCase();
}

function inferYahooAssetClass(quoteType?: string): AssetClass | undefined {
  switch (quoteType?.toUpperCase()) {
    case "EQUITY":
      return "stock";
    case "ETF":
      return "etf";
    default:
      return undefined;
  }
}

function normalizeMetadataLabel(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/&/gu, "and")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

const yahooSectorAliases: Partial<Record<string, SectorType>> = {
  "basic materials": "materials",
  "communication services": "communicationServices",
  communications: "communicationServices",
  "consumer cyclical": "consumer",
  "consumer defensive": "consumer",
  "consumer discretionary": "consumer",
  "consumer staples": "consumer",
  energy: "energy",
  "financial services": "financialServices",
  financials: "financialServices",
  healthcare: "healthcare",
  industrials: "industrial",
  "real estate": "realEstate",
  technology: "technology",
  utilities: "utilities",
};

export function mapYahooSectorToSectorType(
  ...values: Array<string | undefined>
): SectorType | undefined {
  for (const value of values) {
    const normalized = normalizeMetadataLabel(value);

    if (normalized && yahooSectorAliases[normalized]) {
      return yahooSectorAliases[normalized];
    }
  }

  return undefined;
}

export function mapYahooQuoteToLookupResult(
  quote: YahooSearchQuote,
): AssetLookupResult | undefined {
  const ticker = quote.symbol?.trim();

  if (!ticker) {
    return undefined;
  }

  const exchange = inferYahooExchange(ticker);

  if (!exchange) {
    return undefined;
  }

  const quoteType = quote.quoteType?.toUpperCase();
  const assetClass = inferYahooAssetClass(quoteType);

  if (!assetClass) {
    return undefined;
  }

  const isEtf = assetClass === "etf";
  const defaults = getDefaultAssetMetadata(assetClass);
  const providerSector = isEtf
    ? undefined
    : mapYahooSectorToSectorType(quote.sector, quote.sectorDisp);
  const sectorType = providerSector ?? defaults.sectorType;
  const sectorTypeConfidence = providerSector
    ? "provider"
    : isEtf
      ? "inferred"
      : "reviewRequired";

  return {
    assetClass,
    currency: "INR",
    exchange,
    id: `yahoo:${ticker}`,
    instrumentType: defaults.instrumentType,
    instrumentTypeConfidence: "inferred",
    metadataReviewMessage: providerSector || isEtf
      ? "Provider details look ready. Confirm before saving."
      : "Sector is unknown. Add it only if it helps your portfolio review.",
    name: quote.longname?.trim() || quote.shortname?.trim() || ticker,
    provider: "yahoo",
    quoteSourceId: ticker,
    sectorType,
    sectorTypeConfidence,
    sourceLabel: "Yahoo Finance",
    symbol: normalizeYahooSymbol(ticker),
    ticker,
  };
}

export function mapCoinGeckoCoinToLookupResult(
  coin: CoinGeckoSearchCoin,
): AssetLookupResult | undefined {
  const coinId = coin.id?.trim();
  const symbol = coin.symbol?.trim();

  if (!coinId || !symbol) {
    return undefined;
  }

  const defaults = getDefaultAssetMetadata("crypto");

  return {
    assetClass: "crypto",
    currency: "INR",
    exchange: "CRYPTO",
    id: `coingecko:${coinId}`,
    instrumentType: defaults.instrumentType,
    instrumentTypeConfidence: "inferred",
    metadataReviewMessage: "Provider details look ready. Confirm before saving.",
    name: coin.name?.trim() || symbol.toUpperCase(),
    provider: "coingecko",
    quoteSourceId: coinId,
    sectorType: defaults.sectorType,
    sectorTypeConfidence: "inferred",
    sourceLabel: "CoinGecko",
    symbol: symbol.toUpperCase(),
    ticker: coinId,
  };
}

async function searchYahoo({
  fetcher,
  query,
  signal,
}: {
  fetcher: QuoteFetcher;
  query: string;
  signal?: AbortSignal;
}) {
  const response = await fetcher(
    buildYahooSearchUrl(query),
    signal ? { signal } : undefined,
  );

  if (!response.ok) {
    throw new Error(`Yahoo lookup request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as YahooSearchResponse;

  return (payload.quotes ?? [])
    .map(mapYahooQuoteToLookupResult)
    .filter((result): result is AssetLookupResult => result !== undefined);
}

function resultRank(query: string, result: AssetLookupResult) {
  const normalizedQuery = normalizeMetadataLabel(query) ?? "";
  const normalizedIdentityQuery = query.trim().toUpperCase();
  const normalizedSymbol = normalizeMetadataLabel(result.symbol) ?? "";
  const normalizedTicker = normalizeMetadataLabel(result.ticker) ?? "";
  const normalizedQuoteSourceId = result.quoteSourceId.trim().toUpperCase();
  const normalizedName = normalizeMetadataLabel(result.name) ?? "";

  if (
    normalizedIdentityQuery === result.symbol.trim().toUpperCase() ||
    normalizedIdentityQuery === result.ticker.trim().toUpperCase() ||
    normalizedIdentityQuery === normalizedQuoteSourceId
  ) {
    return 0;
  }

  if (
    normalizedSymbol.startsWith(normalizedQuery) ||
    normalizedTicker.startsWith(normalizedQuery) ||
    normalizeMetadataLabel(result.quoteSourceId)?.startsWith(normalizedQuery)
  ) {
    return 1;
  }

  if (normalizedName === normalizedQuery) return 2;

  if (normalizedName.startsWith(normalizedQuery)) {
    return 3;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 4;
  }

  return 5;
}

export function prepareAssetLookupResults(
  query: string,
  results: AssetLookupResult[],
) {
  const uniqueResults: AssetLookupResult[] = [];
  const matcher = createCanonicalAssetMatcher(uniqueResults);

  for (const result of results) {
    if (!matcher.find(result)) {
      uniqueResults.push(result);
      matcher.add(result);
    }
  }

  return uniqueResults
    .sort((left, right) => {
      const rankDifference = resultRank(query, left) - resultRank(query, right);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, maxAssetLookupResults);
}

export function getAssetLookupResultsPage(
  results: AssetLookupResult[],
  page: number = 0,
) {
  const normalizedPage = Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0;
  const start = normalizedPage * assetLookupPageSize;

  return results.slice(start, Math.min(start + assetLookupPageSize, maxAssetLookupResults));
}

async function searchCoinGecko({
  fetcher,
  query,
  signal,
}: {
  fetcher: QuoteFetcher;
  query: string;
  signal?: AbortSignal;
}) {
  const response = await fetcher(
    buildCoinGeckoSearchUrl(query),
    signal ? { signal } : undefined,
  );

  if (!response.ok) {
    throw new Error(
      `CoinGecko lookup request failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as CoinGeckoSearchResponse;

  return (payload.coins ?? [])
    .map(mapCoinGeckoCoinToLookupResult)
    .filter((result): result is AssetLookupResult => result !== undefined);
}

export async function searchAssetLookupResults({
  fetcher = getDefaultFetcher(),
  query,
  signal,
}: {
  fetcher?: QuoteFetcher;
  query: string;
  signal?: AbortSignal;
}): Promise<AssetLookupSearchResult> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return { failures: [], results: [] };
  }

  const settledResults = await Promise.allSettled([
    searchYahoo({ fetcher, query: trimmedQuery, signal }),
    searchCoinGecko({ fetcher, query: trimmedQuery, signal }),
  ]);

  const results: AssetLookupResult[] = [];
  const failures: string[] = [];

  for (const settledResult of settledResults) {
    if (settledResult.status === "fulfilled") {
      results.push(...settledResult.value);
      continue;
    }

    failures.push(
      settledResult.reason instanceof Error
        ? settledResult.reason.message
        : "Asset lookup request failed.",
    );
  }

  return {
    failures,
    results: prepareAssetLookupResults(trimmedQuery, results),
  };
}
