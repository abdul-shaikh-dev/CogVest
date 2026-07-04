import type { Currency } from "./asset";

export type QuoteSource = "yahoo" | "coingecko" | "manual";

export type Quote = {
  assetId: string;
  asOf: string;
  currency: Currency;
  dayChangeAbs?: number;
  dayChangePct?: number;
  price: number;
  source: QuoteSource;
};

export type HistoricalPriceBasis =
  | "historical-close"
  | "cached-historical-close"
  | "latest-local-fallback"
  | "manual-fallback"
  | "unavailable";

export type HistoricalQuote = {
  assetId: string;
  asOfMonth: string;
  basis: HistoricalPriceBasis;
  currency: Currency;
  fetchedAt: string;
  price: number;
  source: QuoteSource;
};

export type QuoteCache = Record<string, Quote>;
export type HistoricalQuoteCache = Record<string, HistoricalQuote>;
