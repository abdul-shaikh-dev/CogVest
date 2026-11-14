import { normalizeQuote } from "@/src/domain/financialRecords";
import { getV1QuoteCurrencyIssue } from "@/src/domain/portfolioCurrency";
import { historicalQuoteCacheKey } from "@/src/types";

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
  | "upsertQuote">;

export function createQuoteActions({ get, set, storage }: StoreContext): QuoteActions {
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
    upsertQuote: (quote) => {
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
      const asset = get().assets.find(
        (currentAsset) => currentAsset.id === normalizedQuote.assetId,
      );
      // A quote refresh can finish after its holding was deleted (#651).
      if (!asset) return;
      const currencyIssue = getV1QuoteCurrencyIssue(asset, normalizedQuote);

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

      const quoteCache = {
        ...get().quoteCache,
        [normalizedQuote.assetId]: normalizedQuote,
      };
      persistQuoteCache(storage, quoteCache);
      set({ quoteCache });
    },
  };
}
