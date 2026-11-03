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
      set({ quoteCache: {} });
      storage.removeItem(quoteCacheStorageKey);
    },
    clearHistoricalQuoteCache: () => {
      set({ historicalQuoteCache: {} });
      storage.removeItem(historicalQuoteCacheStorageKey);
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
      const currencyIssue = asset
        ? getV1QuoteCurrencyIssue(asset, normalizedHistoricalQuote)
        : normalizedHistoricalQuote.currency === "INR"
          ? undefined
          : "Cannot save a non-INR historical quote without a supported asset.";

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

      set((state) => ({
        historicalQuoteCache: {
          ...state.historicalQuoteCache,
          [historicalQuoteCacheKey(
            normalizedHistoricalQuote.assetId,
            normalizedHistoricalQuote.asOfMonth,
          )]: normalizedHistoricalQuote,
        },
      }));
      persistHistoricalQuoteCache(storage, get().historicalQuoteCache);
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
      const currencyIssue = asset
        ? getV1QuoteCurrencyIssue(asset, normalizedQuote)
        : normalizedQuote.currency === "INR"
          ? undefined
          : "Cannot save a non-INR quote without a supported asset.";

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

      set((state) => ({
        quoteCache: {
          ...state.quoteCache,
          [normalizedQuote.assetId]: normalizedQuote,
        },
      }));
      persistQuoteCache(storage, get().quoteCache);
    },
  };
}
