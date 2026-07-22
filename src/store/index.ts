import { createStore, type StoreApi } from "zustand/vanilla";

import { normalizeAssetMetadata } from "@/src/domain/assets";
import {
  buildGeneratedMonthEndSnapshot,
  getMissingCompletedSnapshotMonths,
  getMonthlySnapshotPriceConfidence,
} from "@/src/domain/calculations";
import {
  getCalendarDatePart,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import {
  getV1AssetCurrencyIssue,
  getV1QuoteCurrencyIssue,
} from "@/src/domain/portfolioCurrency";
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

import {
  parsePersistedHistoricalQuoteCache,
  parsePersistedPortfolio,
  parsePersistedQuoteCache,
  type PersistedParseFailure,
  type PersistedPortfolioSnapshot,
} from "./persistedPortfolioSchema";

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
export const storageRecoveryKeyPrefix = "cogvest:recovery";

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
  correctTrade: (trade: TradeCorrectionInput) => TradeCorrectionResult;
  correctOpeningPosition: (
    openingPosition: OpeningPosition,
  ) => OpeningPositionCorrectionResult;
  correctManualCashEntry: (
    cashEntry: CashEntry,
  ) => ManualCashCorrectionResult;
  deleteManualCashEntry: (
    cashEntryId: string,
  ) => ManualCashDeletionResult;
  deleteOpeningPosition: (
    openingPositionId: string,
  ) => OpeningPositionDeletionResult;
  deleteTrade: (tradeId: string) => TradeDeletionResult;
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
  recordOpeningPosition: (
    input: OpeningPositionCommandInput,
  ) => OpeningPositionCommandResult;
  recordSaleWithProceeds: (
    input: LinkedTradeCommandInput,
  ) => LinkedTradeCommandResult;
  resetAffectedStorage: () => void;
  storageRecovery?: StorageRecoveryState;
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

export type OpeningPositionCommandInput = {
  asset: Asset;
  commandId: string;
  openingPosition: OpeningPosition;
  quote?: Quote;
};

export type ManualCashCorrectionResult =
  | { entry: CashEntry; status: "applied" }
  | {
      reason: "invalidEntry" | "linkedEntry" | "notFound";
      status: "rejected";
    };

export type ManualCashDeletionResult =
  | { entry: CashEntry; status: "applied" }
  | {
      reason: "linkedEntry" | "notFound";
      status: "rejected";
    };

export type OpeningPositionCommandResult = {
  asset: Asset;
  openingPosition: OpeningPosition;
  quote?: Quote;
  quoteCacheStatus: "cached" | "notRequested" | "unavailable";
  status: "alreadyApplied" | "applied";
};

export type OpeningPositionCorrectionResult =
  | {
      openingPosition: OpeningPosition;
      pendingMonths: string[];
      provisionalMonths: string[];
      refreshedMonths: string[];
      status: "applied";
    }
  | {
      reason: "assetMismatch" | "invalidEntry" | "notFound";
      status: "rejected";
    };

export type OpeningPositionDeletionResult =
  | {
      openingPosition: OpeningPosition;
      pendingMonths: string[];
      provisionalMonths: string[];
      refreshedMonths: string[];
      status: "applied";
    }
  | { reason: "notFound"; status: "rejected" };

type TradeMutationRejectionReason =
  | "assetMismatch"
  | "inconsistentLink"
  | "insufficientCash"
  | "invalidEntry"
  | "notFound"
  | "oversold"
  | "typeMismatch";

export type TradeCorrectionInput = Omit<Trade, "totalValue">;

type TradeHistoryResult = {
  pendingMonths: string[];
  provisionalMonths: string[];
  refreshedMonths: string[];
};

export type TradeCorrectionResult =
  | (TradeHistoryResult & {
      cashEntry?: CashEntry;
      status: "applied";
      trade: Trade;
    })
  | { reason: TradeMutationRejectionReason; status: "rejected" };

export type TradeDeletionResult =
  | (TradeHistoryResult & {
      cashEntry?: CashEntry;
      status: "applied";
      trade: Trade;
    })
  | {
      reason: "inconsistentLink" | "insufficientCash" | "notFound" | "oversold";
      status: "rejected";
    };

type CreatePortfolioStoreOptions = {
  migratePortfolioSnapshot?: (
    stored: PersistedPortfolioSnapshot,
  ) => RawPortfolioSnapshot;
  now?: () => Date;
  storage?: JsonStorage;
};

type StorageRecoveryReason =
  | PersistedParseFailure["reason"]
  | "migration-failed";

export type StorageRecoveryIncident = {
  detectedAt: string;
  displayName: string;
  metadataKey: string;
  preserved: boolean;
  reason: StorageRecoveryReason;
  recoveryKey: string;
  sourceKey: string;
};

export type StorageRecoveryState = {
  incidents: StorageRecoveryIncident[];
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

type PersistedReadResult<T> = {
  data: T;
  incident?: StorageRecoveryIncident;
};

function quarantineRawValue(
  storage: JsonStorage,
  sourceKey: string,
  displayName: string,
  rawValue: string,
  reason: StorageRecoveryReason,
  now: () => Date,
): StorageRecoveryIncident {
  const recoveryKey = `${storageRecoveryKeyPrefix}:${sourceKey}`;
  const metadataKey = `${recoveryKey}:metadata`;
  const detectedAt = now().toISOString();
  let preserved = false;

  try {
    storage.setRawItem(recoveryKey, rawValue);
    storage.setItem(metadataKey, {
      detectedAt,
      reason,
      sourceKey,
    });
    preserved = true;
  } catch {
    // Recovery remains blocking when the storage device cannot preserve a copy.
  }

  return {
    detectedAt,
    displayName,
    metadataKey,
    preserved,
    reason,
    recoveryKey,
    sourceKey,
  };
}

function migratePortfolioSnapshot(
  parsedSnapshot: PersistedPortfolioSnapshot,
): RawPortfolioSnapshot {
  const stored = parsedSnapshot as StoredPortfolioSnapshot &
    PersistedPortfolioSnapshot;

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

function readPortfolioSnapshot(
  storage: JsonStorage,
  now: () => Date,
  migrate: (stored: PersistedPortfolioSnapshot) => RawPortfolioSnapshot,
): PersistedReadResult<RawPortfolioSnapshot> {
  const rawValue = storage.getRawItem(portfolioStorageKey);

  if (rawValue === null) {
    return { data: createEmptyPortfolioSnapshot() };
  }

  const parsed = parsePersistedPortfolio(rawValue);

  if (!parsed.success) {
    return {
      data: createEmptyPortfolioSnapshot(),
      incident: quarantineRawValue(
        storage,
        portfolioStorageKey,
        "Portfolio records",
        rawValue,
        parsed.reason,
        now,
      ),
    };
  }

  try {
    return { data: migrate(parsed.data) };
  } catch {
    return {
      data: createEmptyPortfolioSnapshot(),
      incident: quarantineRawValue(
        storage,
        portfolioStorageKey,
        "Portfolio records",
        rawValue,
        "migration-failed",
        now,
      ),
    };
  }

}

function readQuoteCache(
  storage: JsonStorage,
  now: () => Date,
): PersistedReadResult<QuoteCache> {
  const rawValue = storage.getRawItem(quoteCacheStorageKey);

  if (rawValue === null) {
    return { data: {} };
  }

  const parsed = parsePersistedQuoteCache(rawValue);

  return parsed.success
    ? { data: parsed.data }
    : {
        data: {},
        incident: quarantineRawValue(
          storage,
          quoteCacheStorageKey,
          "Current quote cache",
          rawValue,
          parsed.reason,
          now,
        ),
      };
}

function readHistoricalQuoteCache(
  storage: JsonStorage,
  now: () => Date,
): PersistedReadResult<HistoricalQuoteCache> {
  const rawValue = storage.getRawItem(historicalQuoteCacheStorageKey);

  if (rawValue === null) {
    return { data: {} };
  }

  const parsed = parsePersistedHistoricalQuoteCache(rawValue);

  return parsed.success
    ? { data: parsed.data }
    : {
        data: {},
        incident: quarantineRawValue(
          storage,
          historicalQuoteCacheStorageKey,
          "Historical quote cache",
          rawValue,
          parsed.reason,
          now,
        ),
      };
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

function isLinkedCashEntry(entry: CashEntry) {
  return (
    Boolean(entry.linkedTradeId) ||
    entry.purpose === "purchaseFunding" ||
    entry.purpose === "saleProceeds"
  );
}

function isValidManualCashEntry(entry: CashEntry, now = new Date()) {
  const hasValidType = entry.type === "addition" || entry.type === "withdrawal";
  const hasValidPurpose =
    entry.type === "withdrawal"
      ? entry.purpose === "withdrawal"
      : ["capitalContribution", "income", "legacyUncategorized"].includes(
          entry.purpose,
        );

  return (
    !isLinkedCashEntry(entry) &&
    hasValidType &&
    Number.isFinite(entry.amount) &&
    entry.amount > 0 &&
    Boolean(getCalendarDatePart(entry.date)) &&
    !isFutureCalendarDate(entry.date, now) &&
    entry.label.trim().length > 0 &&
    hasValidPurpose
  );
}

function isValidOpeningPosition(
  openingPosition: OpeningPosition,
  now: Date,
) {
  const conviction = openingPosition.conviction;

  return (
    openingPosition.assetId.trim().length > 0 &&
    Number.isFinite(openingPosition.quantity) &&
    openingPosition.quantity > 0 &&
    Number.isFinite(openingPosition.averageCostPrice) &&
    openingPosition.averageCostPrice > 0 &&
    openingPosition.currentPrice !== undefined &&
    Number.isFinite(openingPosition.currentPrice) &&
    openingPosition.currentPrice > 0 &&
    Boolean(getCalendarDatePart(openingPosition.date)) &&
    !isFutureCalendarDate(openingPosition.date, now) &&
    (conviction === undefined ||
      (Number.isInteger(conviction) && conviction >= 1 && conviction <= 5))
  );
}

function openingPositionMonth(openingPosition: OpeningPosition) {
  return getCalendarDatePart(openingPosition.date)?.slice(0, 7) ?? null;
}

function rebuildPortfolioSnapshots({
  cashEntries,
  earliestAffectedMonth,
  now,
  openingPositions,
  state,
  trades,
}: {
  cashEntries?: CashEntry[];
  earliestAffectedMonth: string;
  now: Date;
  openingPositions?: OpeningPosition[];
  state: PortfolioStoreState;
  trades?: Trade[];
}) {
  const nextCashEntries = cashEntries ?? state.cashEntries;
  const nextOpeningPositions = openingPositions ?? state.openingPositions;
  const nextTrades = trades ?? state.trades;
  const affectedAutoSnapshots = new Map(
    state.monthlySnapshots
      .filter(
        (snapshot) =>
          snapshot.month >= earliestAffectedMonth &&
          snapshot.generated?.source === "auto",
      )
      .map((snapshot) => [snapshot.month, snapshot]),
  );
  let monthlySnapshots = state.monthlySnapshots.filter(
    (snapshot) =>
      snapshot.month < earliestAffectedMonth ||
      snapshot.generated?.source !== "auto",
  );
  const targetMonths = getMissingCompletedSnapshotMonths({
    cashEntries: nextCashEntries,
    existingSnapshots: monthlySnapshots,
    now,
    openingPositions: nextOpeningPositions,
    trades: nextTrades,
  }).filter((month) => month >= earliestAffectedMonth);
  const pendingMonths: string[] = [];
  const refreshedMonths: string[] = [];

  for (const targetMonth of targetMonths) {
    const result = buildGeneratedMonthEndSnapshot({
      assets: state.assets,
      cashEntries: nextCashEntries,
      existingSnapshots: monthlySnapshots,
      historicalQuotes: state.historicalQuoteCache,
      now,
      openingPositions: nextOpeningPositions,
      quoteCache: state.quoteCache,
      targetMonth,
      trades: nextTrades,
    });

    if (result.status === "created" && result.snapshot) {
      const previousSnapshot = affectedAutoSnapshots.get(targetMonth);
      monthlySnapshots = [
        ...monthlySnapshots,
        {
          ...result.snapshot,
          id: previousSnapshot?.id ?? result.snapshot.id,
        },
      ];
      refreshedMonths.push(targetMonth);
    } else {
      pendingMonths.push(targetMonth);
    }
  }

  monthlySnapshots.sort((left, right) => left.month.localeCompare(right.month));

  return {
    monthlySnapshots,
    pendingMonths,
    provisionalMonths: monthlySnapshots
      .filter(
        (snapshot) =>
          refreshedMonths.includes(snapshot.month) &&
          getMonthlySnapshotPriceConfidence(snapshot) === "provisional",
      )
      .map((snapshot) => snapshot.month),
    refreshedMonths,
  };
}

function tradeMonth(trade: Trade) {
  return getCalendarDatePart(trade.date)?.slice(0, 7) ?? null;
}

function isValidTradeRecord(trade: Trade, now: Date) {
  const fees = trade.fees ?? 0;
  const grossValue = trade.quantity * trade.pricePerUnit;
  const expectedTotal =
    trade.type === "buy" ? grossValue + fees : grossValue - fees;

  return (
    trade.assetId.trim().length > 0 &&
    (trade.type === "buy" || trade.type === "sell") &&
    Number.isFinite(trade.quantity) &&
    trade.quantity > 0 &&
    Number.isFinite(trade.pricePerUnit) &&
    trade.pricePerUnit > 0 &&
    Number.isFinite(fees) &&
    fees >= 0 &&
    Number.isFinite(trade.totalValue) &&
    trade.totalValue > 0 &&
    Math.abs(trade.totalValue - expectedTotal) <= 0.01 &&
    Boolean(getCalendarDatePart(trade.date)) &&
    !isFutureCalendarDate(trade.date, now) &&
    (trade.conviction === undefined ||
      (Number.isInteger(trade.conviction) &&
        trade.conviction >= 1 &&
        trade.conviction <= 5)) &&
    (trade.intendedHoldDays === undefined ||
      (Number.isInteger(trade.intendedHoldDays) && trade.intendedHoldDays > 0))
  );
}

function deriveTrade(input: TradeCorrectionInput): Trade {
  const fees = input.fees ?? 0;
  const grossValue = input.quantity * input.pricePerUnit;

  return {
    ...input,
    totalValue: input.type === "buy" ? grossValue + fees : grossValue - fees,
  };
}

function hasNonnegativeCashTimeline(cashEntries: CashEntry[]) {
  const orderedEntries = [...cashEntries].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder !== 0) return dateOrder;
    if (left.type !== right.type) return left.type === "addition" ? -1 : 1;
    return left.id.localeCompare(right.id);
  });
  let balance = 0;

  for (const entry of orderedEntries) {
    balance += entry.type === "addition" ? entry.amount : -entry.amount;
    if (balance < -0.00000001) return false;
  }

  return true;
}

function wouldOversellAsset(
  assetId: string,
  openingPositions: OpeningPosition[],
  trades: Trade[],
) {
  const events = [
    ...openingPositions
      .filter((item) => item.assetId === assetId)
      .map((position) => ({
        date: getCalendarDatePart(position.date) ?? "",
        delta: position.quantity,
        id: position.id,
        priority: 0,
      })),
    ...trades
      .filter((item) => item.assetId === assetId)
      .map((trade) => ({
        date: getCalendarDatePart(trade.date) ?? "",
        delta: trade.type === "buy" ? trade.quantity : -trade.quantity,
        id: trade.id,
        priority: trade.type === "buy" ? 1 : 2,
      })),
  ].filter((event) => event.date);

  // V1 stores calendar dates, not intraday timestamps. Acquisitions therefore
  // become effective before disposals on the same date, with IDs as a stable tie-break.
  events.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.priority - right.priority ||
      left.id.localeCompare(right.id),
  );

  let units = 0;
  for (const event of events) {
    units += event.delta;
    if (units < -0.00000001) return true;
  }

  return false;
}

function linkedCashEntriesForTrade(state: PortfolioStoreState, tradeId: string) {
  return state.cashEntries.filter((entry) => entry.linkedTradeId === tradeId);
}

function isConsistentTradeCashLink(trade: Trade, entry: CashEntry) {
  return trade.type === "buy"
    ? entry.type === "withdrawal" && entry.purpose === "purchaseFunding"
    : entry.type === "addition" && entry.purpose === "saleProceeds";
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
  const tradeAsset =
    state.assets.find((asset) => asset.id === trade.assetId) ?? input.asset;

  if (
    !hasMatchingAsset ||
    !tradeAsset ||
    getV1AssetCurrencyIssue(tradeAsset) !== undefined ||
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
  migratePortfolioSnapshot: migrate = migratePortfolioSnapshot,
  now = () => new Date(),
  storage = createMmkvJsonStorage(),
}: CreatePortfolioStoreOptions = {}): StoreApi<PortfolioStoreState> {
  const snapshotResult = readPortfolioSnapshot(storage, now, migrate);
  const quoteCacheResult = readQuoteCache(storage, now);
  const historicalQuoteCacheResult = readHistoricalQuoteCache(storage, now);
  const incidents = [
    snapshotResult.incident,
    quoteCacheResult.incident,
    historicalQuoteCacheResult.incident,
  ].filter((incident): incident is StorageRecoveryIncident => Boolean(incident));
  const snapshot = snapshotResult.data;
  const quoteCache = quoteCacheResult.data;
  const historicalQuoteCache = historicalQuoteCacheResult.data;

  return createStore<PortfolioStoreState>((set, get) => ({
    ...snapshot,
    addAsset: (asset) => {
      const state = get();

      if (state.assets.some((currentAsset) => currentAsset.id === asset.id)) {
        return;
      }

      const currencyIssue = getV1AssetCurrencyIssue(asset);

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

      const assets = [...state.assets, normalizeAssetMetadata(asset)];

      persistPortfolioTransition(storage, state, { assets });
      set({ assets });
    },
    addCashEntry: (cashEntry) => {
      const state = get();

      if (state.cashEntries.some((entry) => entry.id === cashEntry.id)) {
        return;
      }

      const cashEntries = [...state.cashEntries, cashEntry];

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });
    },
    addMonthlySnapshot: (monthlySnapshot) => {
      const state = get();

      if (
        state.monthlySnapshots.some(
          (snapshot) => snapshot.id === monthlySnapshot.id,
        )
      ) {
        return;
      }

      const monthlySnapshots = [
        ...state.monthlySnapshots,
        monthlySnapshot,
      ];

      persistPortfolioTransition(storage, state, { monthlySnapshots });
      set({ monthlySnapshots });
    },
    addOpeningPosition: (openingPosition) => {
      const state = get();

      if (
        state.openingPositions.some(
          (position) => position.id === openingPosition.id,
        )
      ) {
        return;
      }

      const openingPositions = [...state.openingPositions, openingPosition];

      persistPortfolioTransition(storage, state, { openingPositions });
      set({ openingPositions });
    },
    addTrade: (trade) => {
      const state = get();

      if (state.trades.some((currentTrade) => currentTrade.id === trade.id)) {
        return;
      }

      const trades = [...state.trades, trade];

      persistPortfolioTransition(storage, state, { trades });
      set({ trades });
    },
    clearQuoteCache: () => {
      set({ quoteCache: {} });
      storage.removeItem(quoteCacheStorageKey);
    },
    correctTrade: (input) => {
      const state = get();
      const existingTrade = state.trades.find((item) => item.id === input.id);

      if (!existingTrade) return { reason: "notFound", status: "rejected" };
      if (existingTrade.assetId !== input.assetId) {
        return { reason: "assetMismatch", status: "rejected" };
      }
      if (existingTrade.type !== input.type) {
        return { reason: "typeMismatch", status: "rejected" };
      }
      const currentDate = now();
      const trade = deriveTrade(input);
      if (!isValidTradeRecord(trade, currentDate)) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const linkedEntries = linkedCashEntriesForTrade(state, trade.id);
      if (
        linkedEntries.length > 1 ||
        (linkedEntries[0] &&
          !isConsistentTradeCashLink(existingTrade, linkedEntries[0]))
      ) {
        return { reason: "inconsistentLink", status: "rejected" };
      }

      const trades = state.trades.map((item) =>
        item.id === trade.id ? trade : item,
      );
      if (wouldOversellAsset(trade.assetId, state.openingPositions, trades)) {
        return { reason: "oversold", status: "rejected" };
      }

      const linkedEntry = linkedEntries[0];
      const correctedCashEntry = linkedEntry
        ? {
            ...linkedEntry,
            amount: trade.totalValue,
            date: trade.date,
            notes: trade.notes,
          }
        : undefined;
      const cashEntries = correctedCashEntry
        ? state.cashEntries.map((entry) =>
            entry.id === correctedCashEntry.id ? correctedCashEntry : entry,
          )
        : state.cashEntries;
      if (correctedCashEntry && !hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const earliestAffectedMonth = [
        tradeMonth(existingTrade),
        tradeMonth(trade),
        linkedEntry ? getCalendarDatePart(linkedEntry.date)?.slice(0, 7) : null,
      ]
        .filter((month): month is string => Boolean(month))
        .sort()[0];

      if (!earliestAffectedMonth) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const history = rebuildPortfolioSnapshots({
        cashEntries,
        earliestAffectedMonth,
        now: currentDate,
        state,
        trades,
      });
      persistPortfolioTransition(storage, state, {
        cashEntries,
        monthlySnapshots: history.monthlySnapshots,
        trades,
      });
      set({ cashEntries, monthlySnapshots: history.monthlySnapshots, trades });

      return {
        cashEntry: correctedCashEntry,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
        trade,
      };
    },
    correctOpeningPosition: (openingPosition) => {
      const state = get();
      const existingPosition = state.openingPositions.find(
        (position) => position.id === openingPosition.id,
      );

      if (!existingPosition) {
        return { reason: "notFound", status: "rejected" };
      }

      if (existingPosition.assetId !== openingPosition.assetId) {
        return { reason: "assetMismatch", status: "rejected" };
      }

      const currentDate = now();

      if (!isValidOpeningPosition(openingPosition, currentDate)) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const earliestAffectedMonth = [
        openingPositionMonth(existingPosition),
        openingPositionMonth(openingPosition),
      ]
        .filter((month): month is string => Boolean(month))
        .sort()[0];

      if (!earliestAffectedMonth) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const openingPositions = state.openingPositions.map((position) =>
        position.id === openingPosition.id ? openingPosition : position,
      );
      const history = rebuildPortfolioSnapshots({
        earliestAffectedMonth,
        now: currentDate,
        openingPositions,
        state,
      });

      persistPortfolioTransition(storage, state, {
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
      });
      set({
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
      });

      return {
        openingPosition,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
    },
    correctManualCashEntry: (cashEntry) => {
      const state = get();
      const existingEntry = state.cashEntries.find(
        (entry) => entry.id === cashEntry.id,
      );

      if (!existingEntry) {
        return { reason: "notFound", status: "rejected" };
      }

      if (isLinkedCashEntry(existingEntry) || isLinkedCashEntry(cashEntry)) {
        return { reason: "linkedEntry", status: "rejected" };
      }

      if (!isValidManualCashEntry(cashEntry, now())) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const cashEntries = state.cashEntries.map((entry) =>
        entry.id === cashEntry.id ? cashEntry : entry,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });

      return { entry: cashEntry, status: "applied" };
    },
    deleteManualCashEntry: (cashEntryId) => {
      const state = get();
      const existingEntry = state.cashEntries.find(
        (entry) => entry.id === cashEntryId,
      );

      if (!existingEntry) {
        return { reason: "notFound", status: "rejected" };
      }

      if (isLinkedCashEntry(existingEntry)) {
        return { reason: "linkedEntry", status: "rejected" };
      }

      const cashEntries = state.cashEntries.filter(
        (entry) => entry.id !== cashEntryId,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });

      return { entry: existingEntry, status: "applied" };
    },
    deleteOpeningPosition: (openingPositionId) => {
      const state = get();
      const existingPosition = state.openingPositions.find(
        (position) => position.id === openingPositionId,
      );

      if (!existingPosition) {
        return { reason: "notFound", status: "rejected" };
      }

      const earliestAffectedMonth = openingPositionMonth(existingPosition);

      if (!earliestAffectedMonth) {
        return { reason: "notFound", status: "rejected" };
      }

      const openingPositions = state.openingPositions.filter(
        (position) => position.id !== openingPositionId,
      );
      const history = rebuildPortfolioSnapshots({
        earliestAffectedMonth,
        now: now(),
        openingPositions,
        state,
      });

      persistPortfolioTransition(storage, state, {
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
      });
      set({
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
      });

      return {
        openingPosition: existingPosition,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
    },
    deleteTrade: (tradeId) => {
      const state = get();
      const trade = state.trades.find((item) => item.id === tradeId);
      if (!trade) return { reason: "notFound", status: "rejected" };

      const linkedEntries = linkedCashEntriesForTrade(state, tradeId);
      if (
        linkedEntries.length > 1 ||
        (linkedEntries[0] && !isConsistentTradeCashLink(trade, linkedEntries[0]))
      ) {
        return { reason: "inconsistentLink", status: "rejected" };
      }

      const trades = state.trades.filter((item) => item.id !== tradeId);
      if (wouldOversellAsset(trade.assetId, state.openingPositions, trades)) {
        return { reason: "oversold", status: "rejected" };
      }

      const linkedEntry = linkedEntries[0];
      const cashEntries = linkedEntry
        ? state.cashEntries.filter((entry) => entry.id !== linkedEntry.id)
        : state.cashEntries;
      if (linkedEntry && !hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const earliestAffectedMonth = [
        tradeMonth(trade),
        linkedEntry ? getCalendarDatePart(linkedEntry.date)?.slice(0, 7) : null,
      ]
        .filter((month): month is string => Boolean(month))
        .sort()[0];

      if (!earliestAffectedMonth) {
        return { reason: "notFound", status: "rejected" };
      }

      const history = rebuildPortfolioSnapshots({
        cashEntries,
        earliestAffectedMonth,
        now: now(),
        state,
        trades,
      });
      persistPortfolioTransition(storage, state, {
        cashEntries,
        monthlySnapshots: history.monthlySnapshots,
        trades,
      });
      set({ cashEntries, monthlySnapshots: history.monthlySnapshots, trades });

      return {
        cashEntry: linkedEntry,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
        trade,
      };
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
      const state = get();
      const existingEntry = state.cashEntries.find(
        (cashEntry) => cashEntry.id === cashEntryId,
      );

      if (existingEntry && isLinkedCashEntry(existingEntry)) {
        throw new Error(
          "Linked cash entries must be changed with their investment transaction.",
        );
      }

      const cashEntries = state.cashEntries.filter(
        (cashEntry) => cashEntry.id !== cashEntryId,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });
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
      get().deleteOpeningPosition(openingPositionId);
    },
    removeTrade: (tradeId) => {
      get().deleteTrade(tradeId);
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
    recordOpeningPosition: (input) => {
      const state = get();

      if (
        input.commandId.trim().length === 0 ||
        input.commandId !== input.openingPosition.id
      ) {
        throw new Error("Opening position command ID is required.");
      }

      const existingPosition = state.openingPositions.find(
        (position) => position.id === input.openingPosition.id,
      );

      if (
        existingPosition
      ) {
        return {
          asset:
            state.assets.find((asset) => asset.id === input.asset.id) ??
            input.asset,
          openingPosition: existingPosition ?? input.openingPosition,
          quote: state.quoteCache[input.asset.id] ?? input.quote,
          quoteCacheStatus: state.quoteCache[input.asset.id]
            ? "cached"
            : input.quote
              ? "unavailable"
              : "notRequested",
          status: "alreadyApplied",
        };
      }

      if (input.openingPosition.assetId !== input.asset.id) {
        throw new Error("Opening position must reference the command asset.");
      }

      if (input.quote && input.quote.assetId !== input.asset.id) {
        throw new Error("Opening position quote must reference the command asset.");
      }

      const normalizedAsset = normalizeAssetMetadata(input.asset);
      const currencyIssue = getV1AssetCurrencyIssue(normalizedAsset);
      const quoteCurrencyIssue = input.quote
        ? getV1QuoteCurrencyIssue(normalizedAsset, input.quote)
        : undefined;

      if (currencyIssue || quoteCurrencyIssue) {
        throw new Error(currencyIssue ?? quoteCurrencyIssue);
      }

      const assets = state.assets.some(
        (asset) => asset.id === normalizedAsset.id,
      )
        ? state.assets
        : [...state.assets, normalizedAsset];
      const openingPositions = [
        ...state.openingPositions,
        input.openingPosition,
      ];
      persistPortfolioTransition(storage, state, {
        assets,
        openingPositions,
      });
      set({ assets, openingPositions });

      let cachedQuote: Quote | undefined;

      if (input.quote) {
        const quoteCache = {
          ...state.quoteCache,
          [input.asset.id]: input.quote,
        };

        try {
          persistQuoteCache(storage, quoteCache);
          set({ quoteCache });
          cachedQuote = input.quote;
        } catch {
          // Current price is durable on the opening position; quote cache can refresh later.
        }
      }

      return {
        asset: normalizedAsset,
        openingPosition: input.openingPosition,
        quote: cachedQuote,
        quoteCacheStatus: input.quote
          ? cachedQuote
            ? "cached"
            : "unavailable"
          : "notRequested",
        status: "applied",
      };
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
    resetAffectedStorage: () => {
      const recoveryIncidents = get().storageRecovery?.incidents ?? [];

      if (recoveryIncidents.some((incident) => !incident.preserved)) {
        return;
      }

      const resetPortfolio = recoveryIncidents.some(
        (incident) => incident.sourceKey === portfolioStorageKey,
      );
      const resetQuoteCache = recoveryIncidents.some(
        (incident) => incident.sourceKey === quoteCacheStorageKey,
      );
      const resetHistoricalQuoteCache = recoveryIncidents.some(
        (incident) => incident.sourceKey === historicalQuoteCacheStorageKey,
      );

      for (const incident of recoveryIncidents) {
        storage.removeItem(incident.sourceKey);
      }

      set({
        ...(resetPortfolio ? createEmptyPortfolioSnapshot() : {}),
        ...(resetQuoteCache ? { quoteCache: {} } : {}),
        ...(resetHistoricalQuoteCache ? { historicalQuoteCache: {} } : {}),
        storageRecovery: undefined,
      });
    },
    schemaVersion: portfolioSchemaVersion,
    storageRecovery: incidents.length > 0 ? { incidents } : undefined,
    updateAsset: (asset) => {
      const currencyIssue = getV1AssetCurrencyIssue(asset);

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

      const normalizedAsset = normalizeAssetMetadata(asset);

      set((state) => ({
        assets: state.assets.map((currentAsset) =>
          currentAsset.id === asset.id ? normalizedAsset : currentAsset,
        ),
      }));
      persistPortfolio(storage, get());
    },
    updateCashEntry: (cashEntry) => {
      const state = get();
      const existingEntry = state.cashEntries.find(
        (currentEntry) => currentEntry.id === cashEntry.id,
      );

      if (
        (existingEntry && isLinkedCashEntry(existingEntry)) ||
        isLinkedCashEntry(cashEntry)
      ) {
        throw new Error(
          "Linked cash entries must be changed with their investment transaction.",
        );
      }

      const cashEntries = state.cashEntries.map((currentEntry) =>
        currentEntry.id === cashEntry.id ? cashEntry : currentEntry,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });
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
      get().correctOpeningPosition(openingPosition);
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
      const { totalValue: _totalValue, ...input } = trade;
      get().correctTrade(input);
    },
    upsertHistoricalQuote: (historicalQuote) => {
      const asset = get().assets.find(
        (currentAsset) => currentAsset.id === historicalQuote.assetId,
      );
      const currencyIssue = asset
        ? getV1QuoteCurrencyIssue(asset, historicalQuote)
        : historicalQuote.currency === "INR"
          ? undefined
          : "Cannot save a non-INR historical quote without a supported asset.";

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

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
      const asset = get().assets.find(
        (currentAsset) => currentAsset.id === quote.assetId,
      );
      const currencyIssue = asset
        ? getV1QuoteCurrencyIssue(asset, quote)
        : quote.currency === "INR"
          ? undefined
          : "Cannot save a non-INR quote without a supported asset.";

      if (currencyIssue) {
        throw new Error(currencyIssue);
      }

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
