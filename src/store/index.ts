import { createStore, type StoreApi } from "zustand/vanilla";

import type { JsonStorage, JsonValue } from "@/src/services/storage";
import { createMmkvJsonStorage } from "@/src/services/storage";
import type {
  Asset,
  CashEntry,
  Preferences,
  Quote,
  QuoteCache,
  Trade,
} from "@/src/types";

export {
  selectAssetById,
  selectCashBalance,
  selectQuoteForAsset,
  selectTradesForAsset,
} from "./selectors";

export const portfolioStorageKey = "cogvest:v1:portfolio";
export const quoteCacheStorageKey = "cogvest:v1:quote-cache";
export const portfolioSchemaVersion = 1;

export type RawPortfolioSnapshot = {
  assets: Asset[];
  cashEntries: CashEntry[];
  preferences: Preferences;
  schemaVersion: typeof portfolioSchemaVersion;
  trades: Trade[];
};

export type PortfolioStoreState = RawPortfolioSnapshot & {
  addAsset: (asset: Asset) => void;
  addCashEntry: (cashEntry: CashEntry) => void;
  addTrade: (trade: Trade) => void;
  clearQuoteCache: () => void;
  quoteCache: QuoteCache;
  removeAsset: (assetId: string) => void;
  removeCashEntry: (cashEntryId: string) => void;
  removeTrade: (tradeId: string) => void;
  updateAsset: (asset: Asset) => void;
  updateCashEntry: (cashEntry: CashEntry) => void;
  updatePreferences: (preferences: Partial<Preferences>) => void;
  updateTrade: (trade: Trade) => void;
  upsertQuote: (quote: Quote) => void;
};

type CreatePortfolioStoreOptions = {
  storage?: JsonStorage;
};

export function createDefaultPreferences(): Preferences {
  return {
    defaultChartRange: "1M",
    hasCompletedOnboarding: false,
    maskWealthValues: false,
  };
}

export function createEmptyPortfolioSnapshot(): RawPortfolioSnapshot {
  return {
    assets: [],
    cashEntries: [],
    preferences: createDefaultPreferences(),
    schemaVersion: portfolioSchemaVersion,
    trades: [],
  };
}

function readPortfolioSnapshot(storage: JsonStorage): RawPortfolioSnapshot {
  const stored = storage.getItem<RawPortfolioSnapshot & JsonValue>(
    portfolioStorageKey,
  );

  if (!stored || stored.schemaVersion !== portfolioSchemaVersion) {
    return createEmptyPortfolioSnapshot();
  }

  return {
    assets: stored.assets ?? [],
    cashEntries: stored.cashEntries ?? [],
    preferences: {
      ...createDefaultPreferences(),
      ...stored.preferences,
    },
    schemaVersion: portfolioSchemaVersion,
    trades: stored.trades ?? [],
  };
}

function readQuoteCache(storage: JsonStorage): QuoteCache {
  return storage.getItem<QuoteCache & JsonValue>(quoteCacheStorageKey) ?? {};
}

function selectRawSnapshot(
  state: PortfolioStoreState,
): RawPortfolioSnapshot {
  return {
    assets: state.assets,
    cashEntries: state.cashEntries,
    preferences: state.preferences,
    schemaVersion: portfolioSchemaVersion,
    trades: state.trades,
  };
}

function persistPortfolio(
  storage: JsonStorage,
  state: PortfolioStoreState,
) {
  storage.setItem(portfolioStorageKey, selectRawSnapshot(state) as JsonValue);
}

function persistQuoteCache(storage: JsonStorage, quoteCache: QuoteCache) {
  storage.setItem(quoteCacheStorageKey, quoteCache as JsonValue);
}

export function createPortfolioStore({
  storage = createMmkvJsonStorage(),
}: CreatePortfolioStoreOptions = {}): StoreApi<PortfolioStoreState> {
  const snapshot = readPortfolioSnapshot(storage);
  const quoteCache = readQuoteCache(storage);

  return createStore<PortfolioStoreState>((set, get) => ({
    ...snapshot,
    addAsset: (asset) => {
      set((state) => ({ assets: [...state.assets, asset] }));
      persistPortfolio(storage, get());
    },
    addCashEntry: (cashEntry) => {
      set((state) => ({ cashEntries: [...state.cashEntries, cashEntry] }));
      persistPortfolio(storage, get());
    },
    addTrade: (trade) => {
      set((state) => ({ trades: [...state.trades, trade] }));
      persistPortfolio(storage, get());
    },
    clearQuoteCache: () => {
      set({ quoteCache: {} });
      storage.removeItem(quoteCacheStorageKey);
    },
    quoteCache,
    removeAsset: (assetId) => {
      set((state) => ({
        assets: state.assets.filter((asset) => asset.id !== assetId),
      }));
      persistPortfolio(storage, get());
    },
    removeCashEntry: (cashEntryId) => {
      set((state) => ({
        cashEntries: state.cashEntries.filter(
          (cashEntry) => cashEntry.id !== cashEntryId,
        ),
      }));
      persistPortfolio(storage, get());
    },
    removeTrade: (tradeId) => {
      set((state) => ({
        trades: state.trades.filter((trade) => trade.id !== tradeId),
      }));
      persistPortfolio(storage, get());
    },
    schemaVersion: portfolioSchemaVersion,
    updateAsset: (asset) => {
      set((state) => ({
        assets: state.assets.map((currentAsset) =>
          currentAsset.id === asset.id ? asset : currentAsset,
        ),
      }));
      persistPortfolio(storage, get());
    },
    updateCashEntry: (cashEntry) => {
      set((state) => ({
        cashEntries: state.cashEntries.map((currentEntry) =>
          currentEntry.id === cashEntry.id ? cashEntry : currentEntry,
        ),
      }));
      persistPortfolio(storage, get());
    },
    updatePreferences: (preferences) => {
      set((state) => ({
        preferences: {
          ...state.preferences,
          ...preferences,
        },
      }));
      persistPortfolio(storage, get());
    },
    updateTrade: (trade) => {
      set((state) => ({
        trades: state.trades.map((currentTrade) =>
          currentTrade.id === trade.id ? trade : currentTrade,
        ),
      }));
      persistPortfolio(storage, get());
    },
    upsertQuote: (quote) => {
      set((state) => ({
        quoteCache: {
          ...state.quoteCache,
          [quote.assetId]: quote,
        },
      }));
      persistQuoteCache(storage, get().quoteCache);
    },
  }));
}

let runtimePortfolioStore: StoreApi<PortfolioStoreState> | undefined;

export function getPortfolioStore() {
  runtimePortfolioStore ??= createPortfolioStore();

  return runtimePortfolioStore;
}
