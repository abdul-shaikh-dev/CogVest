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

export type QuoteCache = Record<string, Quote>;
