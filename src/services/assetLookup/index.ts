import { getDefaultAssetMetadata } from "@/src/domain/assets";
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

export type AssetLookupResult = {
  assetClass: AssetClass;
  currency: Currency;
  exchange?: AssetExchange;
  id: string;
  instrumentType: InstrumentType;
  name: string;
  provider: AssetLookupProvider;
  quoteSourceId: string;
  sectorType: SectorType;
  sourceLabel: string;
  symbol: string;
  ticker: string;
};

export type AssetLookupSearchResult = {
  failures: string[];
  results: AssetLookupResult[];
};

export type YahooSearchQuote = {
  exchange?: string;
  longname?: string;
  quoteType?: string;
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
    quotesCount: "8",
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

function inferYahooCurrency(symbol: string): Currency {
  return symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "INR" : "USD";
}

function normalizeYahooSymbol(symbol: string) {
  return symbol.replace(/\.(NS|BO)$/u, "").toUpperCase();
}

function inferYahooAssetClass(quoteType?: string): AssetClass {
  return quoteType?.toUpperCase() === "ETF" ? "etf" : "stock";
}

export function mapYahooQuoteToLookupResult(
  quote: YahooSearchQuote,
): AssetLookupResult | undefined {
  const ticker = quote.symbol?.trim();

  if (!ticker) {
    return undefined;
  }

  const assetClass = inferYahooAssetClass(quote.quoteType);
  const defaults = getDefaultAssetMetadata(assetClass);

  return {
    assetClass,
    currency: inferYahooCurrency(ticker),
    exchange: inferYahooExchange(ticker),
    id: `yahoo:${ticker}`,
    instrumentType: defaults.instrumentType,
    name: quote.longname?.trim() || quote.shortname?.trim() || ticker,
    provider: "yahoo",
    quoteSourceId: ticker,
    sectorType: defaults.sectorType,
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
    name: coin.name?.trim() || symbol.toUpperCase(),
    provider: "coingecko",
    quoteSourceId: coinId,
    sectorType: defaults.sectorType,
    sourceLabel: "CoinGecko",
    symbol: symbol.toUpperCase(),
    ticker: coinId,
  };
}

async function searchYahoo({
  fetcher,
  query,
}: {
  fetcher: QuoteFetcher;
  query: string;
}) {
  const response = await fetcher(buildYahooSearchUrl(query));

  if (!response.ok) {
    throw new Error(`Yahoo lookup request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as YahooSearchResponse;

  return (payload.quotes ?? [])
    .map(mapYahooQuoteToLookupResult)
    .filter((result): result is AssetLookupResult => result !== undefined);
}

async function searchCoinGecko({
  fetcher,
  query,
}: {
  fetcher: QuoteFetcher;
  query: string;
}) {
  const response = await fetcher(buildCoinGeckoSearchUrl(query));

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
}: {
  fetcher?: QuoteFetcher;
  query: string;
}): Promise<AssetLookupSearchResult> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return { failures: [], results: [] };
  }

  const settledResults = await Promise.allSettled([
    searchYahoo({ fetcher, query: trimmedQuery }),
    searchCoinGecko({ fetcher, query: trimmedQuery }),
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
    results,
  };
}
