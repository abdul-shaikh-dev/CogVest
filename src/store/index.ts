import { createStore, type StoreApi } from "zustand/vanilla";

import { normalizeAssetMetadata } from "@/src/domain/assets";
import type { JsonStorage, JsonValue } from "@/src/services/storage";
import { createMmkvJsonStorage } from "@/src/services/storage";
import type {
  Asset,
  CashEntry,
  OpeningPosition,
  Preferences,
  Quote,
  QuoteCache,
  Trade,
} from "@/src/types";

export {
  selectAssetById,
  selectCashBalance,
  selectOpeningPositionsForAsset,
  selectQuoteForAsset,
  selectTradesForAsset,
} from "./selectors";

export const portfolioStorageKey = "cogvest:v1:portfolio";
export const quoteCacheStorageKey = "cogvest:v1:quote-cache";
export const portfolioSchemaVersion = 3;

export type RawPortfolioSnapshot = {
  assets: Asset[];
  cashEntries: CashEntry[];
  openingPositions: OpeningPosition[];
  preferences: Preferences;
  schemaVersion: typeof portfolioSchemaVersion;
  trades: Trade[];
};

export type PortfolioStoreState = RawPortfolioSnapshot & {
  addAsset: (asset: Asset) => void;
  addCashEntry: (cashEntry: CashEntry) => void;
  addOpeningPosition: (openingPosition: OpeningPosition) => void;
  addTrade: (trade: Trade) => void;
  clearQuoteCache: () => void;
  quoteCache: QuoteCache;
  removeAsset: (assetId: string) => void;
  removeCashEntry: (cashEntryId: string) => void;
  removeOpeningPosition: (openingPositionId: string) => void;
  removeTrade: (tradeId: string) => void;
  updateAsset: (asset: Asset) => void;
  updateCashEntry: (cashEntry: CashEntry) => void;
  updateOpeningPosition: (openingPosition: OpeningPosition) => void;
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
    openingPositions: [],
    preferences: createDefaultPreferences(),
    schemaVersion: portfolioSchemaVersion,
    trades: [],
  };
}

type StoredPortfolioSnapshot = Partial<
  Omit<RawPortfolioSnapshot, "schemaVersion">
> & {
  schemaVersion?: number;
};

function readPortfolioSnapshot(storage: JsonStorage): RawPortfolioSnapshot {
  const stored = storage.getItem<StoredPortfolioSnapshot & JsonValue>(
    portfolioStorageKey,
  );

  if (
    !stored ||
    ![1, 2, portfolioSchemaVersion].includes(stored.schemaVersion ?? 0)
  ) {
    return createEmptyPortfolioSnapshot();
  }

  return {
    assets: (stored.assets ?? []).map(normalizeAssetMetadata),
    cashEntries: stored.cashEntries ?? [],
    openingPositions: stored.openingPositions ?? [],
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
    openingPositions: state.openingPositions,
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
      set((state) => ({
        assets: [...state.assets, normalizeAssetMetadata(asset)],
      }));
      persistPortfolio(storage, get());
    },
    addCashEntry: (cashEntry) => {
      set((state) => ({ cashEntries: [...state.cashEntries, cashEntry] }));
      persistPortfolio(storage, get());
    },
    addOpeningPosition: (openingPosition) => {
      set((state) => ({
        openingPositions: [...state.openingPositions, openingPosition],
      }));
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
    removeOpeningPosition: (openingPositionId) => {
      set((state) => ({
        openingPositions: state.openingPositions.filter(
          (openingPosition) => openingPosition.id !== openingPositionId,
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
      const normalizedAsset = normalizeAssetMetadata(asset);

      set((state) => ({
        assets: state.assets.map((currentAsset) =>
          currentAsset.id === asset.id ? normalizedAsset : currentAsset,
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
    updateOpeningPosition: (openingPosition) => {
      set((state) => ({
        openingPositions: state.openingPositions.map((currentPosition) =>
          currentPosition.id === openingPosition.id
            ? openingPosition
            : currentPosition,
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
