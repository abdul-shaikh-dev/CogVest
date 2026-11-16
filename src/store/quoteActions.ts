import { normalizeQuote } from "@/src/domain/financialRecords";
import { getV1QuoteCurrencyIssue } from "@/src/domain/portfolioCurrency";
import { type Asset, historicalQuoteCacheKey, type Quote } from "@/src/types";

import type { StoreContext } from "./storeContext";
import {
  historicalQuoteCacheStorageKey,
  type PortfolioStoreState,
  quoteCacheStorageKey,
} from "./storeTypes";
import { persistHistoricalQuoteCache, persistQuoteCache } from "./persistence";

type QuoteActions = Pick<PortfolioStoreState,
  | "clearQuoteCache"
  | "clearHistoricalQuoteCache"
  | "upsertHistoricalQuote"
  | "upsertQuote"
  | "upsertQuotes">;

/** Checks one quote and returns it normalised. Throws when it is invalid. */
function validQuote(quote: Quote, assetsById: Map<string, Asset>) {
  if (
    !Number.isFinite(quote.price) ||
    (quote.dayChangeAbs !== undefined &&
      !Number.isFinite(quote.dayChangeAbs)) ||
    (quote.dayChangePct !== undefined &&
      !Number.isFinite(quote.dayChangePct))
  ) {
    throw new Error("Quote financial values must be finite.");
  }
  const normalizedQuote = normalizeQuote(quote);
  if (normalizedQuote.price <= 0) {
    throw new Error("Quote price is below supported precision.");
  }
  const asset = assetsById.get(normalizedQuote.assetId);
  // A quote refresh can finish after its holding was deleted (#651).
  if (!asset) return undefined;
  const currencyIssue = getV1QuoteCurrencyIssue(asset, normalizedQuote);

  if (currencyIssue) {
    throw new Error(currencyIssue);
  }
  return normalizedQuote;
}

export function createQuoteActions({ get, set, storage }: StoreContext): QuoteActions {
  /**
   * Checks every quote before writing any, then saves the cache once (#661).
   * One invalid quote leaves the cache unchanged.
   */
  function upsertQuotes(quotes: readonly Quote[]) {
    const assetsById = new Map(get().assets.map((asset) => [asset.id, asset]));
    const accepted = quotes.flatMap((quote) => validQuote(quote, assetsById) ?? []);
    if (accepted.length === 0) return;

    const quoteCache = { ...get().quoteCache };
    for (const quote of accepted) {
      quoteCache[quote.assetId] = quote;
    }
    persistQuoteCache(storage, quoteCache);
    set({ quoteCache });
  }

  return {
    clearQuoteCache: () => {
      storage.removeItem(quoteCacheStorageKey);
      set({ quoteCache: {} });
    },
    clearHistoricalQuoteCache: () => {
      storage.removeItem(historicalQuoteCacheStorageKey);
      set({ historicalQuoteCache: {} });
    },
    upsertHistoricalQuote: (historicalQuote) => {
      if (!Number.isFinite(historicalQuote.price)) {
        throw new Error("Historical quote price must be finite.");
      }
      const normalizedHistoricalQuote = normalizeQuote(historicalQuote);
      if (normalizedHistoricalQuote.price <= 0) {
        throw new Error("Historical quote price is below supported precision.");
      }
      const asset = get().assets.find(
        (currentAsset) =>
          currentAsset.id === normalizedHistoricalQuote.assetId,
      );
      // A month-end run can finish after its holding was deleted; its quote
      // belongs to nothing and would block backup export (#651).
      if (!asset) return;
      const currencyIssue = getV1QuoteCurrencyIssue(asset, normalizedHistoricalQuote);

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

      const historicalQuoteCache = {
        ...get().historicalQuoteCache,
        [historicalQuoteCacheKey(
          normalizedHistoricalQuote.assetId,
          normalizedHistoricalQuote.asOfMonth,
        )]: normalizedHistoricalQuote,
      };
      persistHistoricalQuoteCache(storage, historicalQuoteCache);
      set({ historicalQuoteCache });
    },
    upsertQuote: (quote) => upsertQuotes([quote]),
    upsertQuotes: (quotes) => upsertQuotes(quotes),
  };
}
