import { createStore, type StoreApi } from "zustand/vanilla";

import { normalizeAssetMetadata } from "@/src/domain/assets";
import type { JsonStorage, JsonValue } from "@/src/services/storage";
import { createMmkvJsonStorage } from "@/src/services/storage";
import type {
  Asset,
  CashEntry,
  CashEntryPurpose,
  HistoricalQuote,
  HistoricalQuoteCache,
  MonthlySnapshot,
  OpeningPosition,
  Preferences,
  Quote,
  QuoteCache,
  Trade,
} from "@/src/types";
import { historicalQuoteCacheKey } from "@/src/types";

export {
  selectAssetById,
  selectCashBalance,
  selectOpeningPositionsForAsset,
  selectQuoteForAsset,
  selectTradesForAsset,
} from "./selectors";

export const portfolioStorageKey = "cogvest:v1:portfolio";
export const quoteCacheStorageKey = "cogvest:v1:quote-cache";
export const historicalQuoteCacheStorageKey =
  "cogvest:v1:historical-quote-cache";
export const portfolioSchemaVersion = 5;

export { historicalQuoteCacheKey };

export type RawPortfolioSnapshot = {
  assets: Asset[];
  cashEntries: CashEntry[];
  monthlySnapshots: MonthlySnapshot[];
  openingPositions: OpeningPosition[];
  preferences: Preferences;
  schemaVersion: typeof portfolioSchemaVersion;
  trades: Trade[];
};

export type PortfolioStoreState = RawPortfolioSnapshot & {
  addAsset: (asset: Asset) => void;
  addCashEntry: (cashEntry: CashEntry) => void;
  addMonthlySnapshot: (monthlySnapshot: MonthlySnapshot) => void;
  addOpeningPosition: (openingPosition: OpeningPosition) => void;
  addTrade: (trade: Trade) => void;
  clearQuoteCache: () => void;
  historicalQuoteCache: HistoricalQuoteCache;
  quoteCache: QuoteCache;
  removeAsset: (assetId: string) => void;
  removeCashEntry: (cashEntryId: string) => void;
  removeMonthlySnapshot: (monthlySnapshotId: string) => void;
  removeOpeningPosition: (openingPositionId: string) => void;
  removeTrade: (tradeId: string) => void;
  recordFundedBuy: (
    input: LinkedTradeCommandInput,
  ) => LinkedTradeCommandResult;
  recordSaleWithProceeds: (
    input: LinkedTradeCommandInput,
  ) => LinkedTradeCommandResult;
  updateAsset: (asset: Asset) => void;
  updateCashEntry: (cashEntry: CashEntry) => void;
  updateMonthlySnapshot: (monthlySnapshot: MonthlySnapshot) => void;
  updateOpeningPosition: (openingPosition: OpeningPosition) => void;
  updatePreferences: (preferences: Partial<Preferences>) => void;
  updateTrade: (trade: Trade) => void;
  upsertHistoricalQuote: (historicalQuote: HistoricalQuote) => void;
  upsertQuote: (quote: Quote) => void;
};

export type LinkedTradeCommandInput = {
  asset?: Asset;
  cashLabel: string;
  cashNotes?: string;
  trade: Trade;
};

export type LinkedTradeCommandResult =
  | { cashEntry: CashEntry; isValid: true; trade: Trade }
  | {
      availableCash?: number;
      availableUnits?: number;
      isValid: false;
      reason:
        | "duplicateTrade"
        | "insufficientCash"
        | "insufficientUnits"
        | "invalidTrade"
        | "invalidTradeType";
      requiredCash?: number;
      requiredUnits?: number;
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
    monthlySnapshots: [],
    openingPositions: [],
    preferences: createDefaultPreferences(),
    schemaVersion: portfolioSchemaVersion,
    trades: [],
  };
}

type StoredCashEntry = Omit<CashEntry, "purpose"> & {
  purpose?: CashEntryPurpose;
};

type StoredPortfolioSnapshot = Partial<
  Omit<RawPortfolioSnapshot, "cashEntries" | "schemaVersion">
> & {
  cashEntries?: StoredCashEntry[];
  schemaVersion?: number;
};

function normalizeCashEntry(entry: StoredCashEntry): CashEntry {
  return {
    ...entry,
    purpose:
      entry.purpose ??
      (entry.type === "withdrawal" ? "withdrawal" : "legacyUncategorized"),
  };
}

function readPortfolioSnapshot(storage: JsonStorage): RawPortfolioSnapshot {
  const stored = storage.getItem<StoredPortfolioSnapshot & JsonValue>(
    portfolioStorageKey,
  );

  if (
    !stored ||
    ![1, 2, 3, 4, portfolioSchemaVersion].includes(stored.schemaVersion ?? 0)
  ) {
    return createEmptyPortfolioSnapshot();
  }

  return {
    assets: (stored.assets ?? []).map(normalizeAssetMetadata),
    cashEntries: (stored.cashEntries ?? []).map(normalizeCashEntry),
    monthlySnapshots: stored.monthlySnapshots ?? [],
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

function readHistoricalQuoteCache(storage: JsonStorage): HistoricalQuoteCache {
  return (
    storage.getItem<HistoricalQuoteCache & JsonValue>(
      historicalQuoteCacheStorageKey,
    ) ?? {}
  );
}

function selectRawSnapshot(
  state: PortfolioStoreState,
): RawPortfolioSnapshot {
  return {
    assets: state.assets,
    cashEntries: state.cashEntries,
    monthlySnapshots: state.monthlySnapshots,
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

function persistPortfolioTransition(
  storage: JsonStorage,
  state: PortfolioStoreState,
  transition: Partial<RawPortfolioSnapshot>,
) {
  storage.setItem(portfolioStorageKey, {
    ...selectRawSnapshot(state),
    ...transition,
    schemaVersion: portfolioSchemaVersion,
  } as JsonValue);
}

function cashBalance(cashEntries: CashEntry[]) {
  return cashEntries.reduce(
    (balance, entry) =>
      entry.type === "withdrawal"
        ? balance - entry.amount
        : balance + entry.amount,
    0,
  );
}

function linkedCashEntry(
  input: LinkedTradeCommandInput,
  purpose: "purchaseFunding" | "saleProceeds",
): CashEntry {
  return {
    amount: input.trade.totalValue,
    date: input.trade.date,
    id: `cash-${input.trade.id}`,
    label: input.cashLabel,
    linkedTradeId: input.trade.id,
    notes: input.cashNotes,
    purpose,
    type: purpose === "purchaseFunding" ? "withdrawal" : "addition",
  };
}

function validateLinkedTrade(
  state: PortfolioStoreState,
  input: LinkedTradeCommandInput,
  trade: Trade,
  expectedType: Trade["type"],
): LinkedTradeCommandResult | null {
  if (trade.type !== expectedType) {
    return { isValid: false, reason: "invalidTradeType" };
  }

  const fees = trade.fees ?? 0;
  const grossValue = trade.quantity * trade.pricePerUnit;
  const expectedTotal =
    trade.type === "buy" ? grossValue + fees : grossValue - fees;
  const hasMatchingAsset =
    state.assets.some((asset) => asset.id === trade.assetId) ||
    input.asset?.id === trade.assetId;

  if (
    !hasMatchingAsset ||
    input.cashLabel.trim().length === 0 ||
    !Number.isFinite(trade.quantity) ||
    trade.quantity <= 0 ||
    !Number.isFinite(trade.pricePerUnit) ||
    trade.pricePerUnit <= 0 ||
    !Number.isFinite(fees) ||
    fees < 0 ||
    !Number.isFinite(trade.totalValue) ||
    trade.totalValue <= 0 ||
    Math.abs(trade.totalValue - expectedTotal) > 0.01
  ) {
    return { isValid: false, reason: "invalidTrade" };
  }

  if (state.trades.some((currentTrade) => currentTrade.id === trade.id)) {
    return { isValid: false, reason: "duplicateTrade" };
  }

  return null;
}

function persistQuoteCache(storage: JsonStorage, quoteCache: QuoteCache) {
  storage.setItem(quoteCacheStorageKey, quoteCache as JsonValue);
}

function persistHistoricalQuoteCache(
  storage: JsonStorage,
  historicalQuoteCache: HistoricalQuoteCache,
) {
  storage.setItem(
    historicalQuoteCacheStorageKey,
    historicalQuoteCache as JsonValue,
  );
}

export function createPortfolioStore({
  storage = createMmkvJsonStorage(),
}: CreatePortfolioStoreOptions = {}): StoreApi<PortfolioStoreState> {
  const snapshot = readPortfolioSnapshot(storage);
  const quoteCache = readQuoteCache(storage);
  const historicalQuoteCache = readHistoricalQuoteCache(storage);

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
    addMonthlySnapshot: (monthlySnapshot) => {
      set((state) => ({
        monthlySnapshots: [...state.monthlySnapshots, monthlySnapshot],
      }));
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
    historicalQuoteCache,
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
    removeMonthlySnapshot: (monthlySnapshotId) => {
      set((state) => ({
        monthlySnapshots: state.monthlySnapshots.filter(
          (monthlySnapshot) => monthlySnapshot.id !== monthlySnapshotId,
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
    recordFundedBuy: (input) => {
      const state = get();
      const invalidResult = validateLinkedTrade(
        state,
        input,
        input.trade,
        "buy",
      );

      if (invalidResult) {
        return invalidResult;
      }

      const availableCash = cashBalance(state.cashEntries);

      if (input.trade.totalValue > availableCash) {
        return {
          availableCash,
          isValid: false,
          reason: "insufficientCash",
          requiredCash: input.trade.totalValue,
        };
      }

      const cashEntry = linkedCashEntry(input, "purchaseFunding");
      const assets =
        input.asset &&
        !state.assets.some((currentAsset) => currentAsset.id === input.asset?.id)
          ? [...state.assets, normalizeAssetMetadata(input.asset)]
          : state.assets;
      const cashEntries = [...state.cashEntries, cashEntry];
      const trades = [...state.trades, input.trade];

      persistPortfolioTransition(storage, state, { assets, cashEntries, trades });
      set({ assets, cashEntries, trades });

      return { cashEntry, isValid: true, trade: input.trade };
    },
    recordSaleWithProceeds: (input) => {
      const state = get();
      const invalidResult = validateLinkedTrade(
        state,
        input,
        input.trade,
        "sell",
      );

      if (invalidResult) {
        return invalidResult;
      }

      const availableUnits =
        state.openingPositions
          .filter((position) => position.assetId === input.trade.assetId)
          .reduce((total, position) => total + position.quantity, 0) +
        state.trades
          .filter((trade) => trade.assetId === input.trade.assetId)
          .reduce(
            (total, trade) =>
              total + (trade.type === "buy" ? trade.quantity : -trade.quantity),
            0,
          );

      if (input.trade.quantity > availableUnits) {
        return {
          availableUnits,
          isValid: false,
          reason: "insufficientUnits",
          requiredUnits: input.trade.quantity,
        };
      }

      const cashEntry = linkedCashEntry(input, "saleProceeds");
      const cashEntries = [...state.cashEntries, cashEntry];
      const trades = [...state.trades, input.trade];

      persistPortfolioTransition(storage, state, { cashEntries, trades });
      set({ cashEntries, trades });

      return { cashEntry, isValid: true, trade: input.trade };
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
    updateMonthlySnapshot: (monthlySnapshot) => {
      set((state) => ({
        monthlySnapshots: state.monthlySnapshots.map((currentSnapshot) =>
          currentSnapshot.id === monthlySnapshot.id
            ? monthlySnapshot
            : currentSnapshot,
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
    upsertHistoricalQuote: (historicalQuote) => {
      set((state) => ({
        historicalQuoteCache: {
          ...state.historicalQuoteCache,
          [historicalQuoteCacheKey(
            historicalQuote.assetId,
            historicalQuote.asOfMonth,
          )]: historicalQuote,
        },
      }));
      persistHistoricalQuoteCache(storage, get().historicalQuoteCache);
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
