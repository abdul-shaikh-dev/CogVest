import type { Asset, Quote, QuoteCache } from "@/src/types";

export type QuoteFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type QuoteNow = () => string;

export type QuoteSuccess = {
  ok: true;
  quote: Quote;
};

export type QuoteFailure = {
  error: string;
  fallbackQuote?: Quote;
  ok: false;
};

export type QuoteResult = QuoteSuccess | QuoteFailure;

export type QuoteProviderInput = {
  asset: Asset;
  fetcher?: QuoteFetcher;
  now?: QuoteNow;
};

export type ResolveQuoteInput = QuoteProviderInput & {
  manualPrice?: number;
};

export type RefreshQuotesInput = {
  assets: Asset[];
  fetcher?: QuoteFetcher;
  manualPrices?: Record<string, number>;
  now?: QuoteNow;
};

export type QuoteRefreshFailure = {
  assetId: string;
  error: string;
};

export type QuoteRefreshResult = {
  failures: QuoteRefreshFailure[];
  quoteCache: QuoteCache;
};
