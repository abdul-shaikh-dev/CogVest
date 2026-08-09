import { createStore, type StoreApi } from "zustand/vanilla";

import {
  findCanonicalAsset,
  hasCanonicalAssetConflict,
  isInstrumentType,
  isSectorType,
  normalizeAssetMetadata,
} from "@/src/domain/assets";
import {
  normalizeCashEntry as normalizeCashRecord,
  normalizeMonthlySnapshot as normalizeSnapshotRecord,
  normalizeOpeningPosition,
  normalizeQuote,
  normalizeTrade,
} from "@/src/domain/financialRecords";
import {
  buildGeneratedMonthEndSnapshot,
  getMissingCompletedSnapshotMonths,
  getMonthlySnapshotPriceConfidence,
} from "@/src/domain/calculations";
import {
  formatLocalCalendarDate,
  getCalendarDatePart,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import { getOpeningPositionHistoryDate } from "@/src/domain/openingPositions";
import {
  getV1AssetCurrencyIssue,
  getV1QuoteCurrencyIssue,
} from "@/src/domain/portfolioCurrency";
import {
  decimal,
  isAtOrBeyondNegativeQuantum,
  isWithinQuantum,
  moneyQuantum,
  normalizeMoney,
  normalizeQuantity,
  quantityQuantum,
  sumFinancialValues,
} from "@/src/domain/precision";
import type { JsonStorage, JsonValue } from "@/src/services/storage";
import { createMmkvJsonStorage } from "@/src/services/storage";
import type {
  Asset,
  CashEntry,
  CashEntryPurpose,
  Currency,
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
export const assetGraphJournalStorageKey =
  "cogvest:v1:asset-graph-journal";
export const portfolioSchemaVersion = 7;
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
  clearHistoricalQuoteCache: () => void;
  clearQuoteCache: () => void;
  correctAsset: (asset: Asset) => AssetCorrectionResult;
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
  deleteAsset: (assetId: string) => AssetDeletionResult;
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

type AssetHistoryResult = {
  pendingMonths: string[];
  provisionalMonths: string[];
  refreshedMonths: string[];
};

export type AssetCorrectionResult =
  | (AssetHistoryResult & {
      asset: Asset;
      quoteCacheInvalidated: boolean;
      status: "applied";
    })
  | {
      reason: "duplicateIdentity" | "invalidAsset" | "notFound";
      status: "rejected";
    };

export type AssetDeletionImpact = {
  automaticSnapshots: number;
  historicalQuotes: number;
  linkedCashEntries: number;
  openingPositions: number;
  quotes: number;
  trades: number;
};

export type AssetDeletionResult =
  | (AssetHistoryResult & {
      asset: Asset;
      impact: AssetDeletionImpact;
      status: "applied";
    })
  | { reason: "insufficientCash" | "notFound"; status: "rejected" };

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

type StoredOpeningPosition = OpeningPosition & {
  currentPrice?: number;
};

type StoredPortfolioSnapshot = Partial<
  Omit<
    RawPortfolioSnapshot,
    "cashEntries" | "openingPositions" | "schemaVersion"
  >
> & {
  cashEntries?: StoredCashEntry[];
  openingPositions?: StoredOpeningPosition[];
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

function normalizeMonthlySnapshot(snapshot: MonthlySnapshot): MonthlySnapshot {
  if (snapshot.generated?.source !== "auto" || snapshot.salary !== 0) {
    return snapshot;
  }

  const { salary: _legacyUnknownSalary, ...normalized } = snapshot;
  return normalized;
}

function migrateOpeningPosition(
  position: StoredOpeningPosition,
  assets: Asset[],
): OpeningPosition {
  const { currentPrice, ...current } = position;

  if (current.manualValuation || currentPrice === undefined) {
    return current;
  }

  const asset = assets.find((item) => item.id === position.assetId);

  return {
    ...current,
    manualValuation: {
      asOf: null,
      currency: asset?.currency ?? "INR",
      price: currentPrice,
      provenance: "legacy",
      source: "manual",
    },
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
  const assets = (stored.assets ?? []).map(normalizeAssetMetadata);

  return {
    assets,
    cashEntries: (stored.cashEntries ?? []).map(normalizeCashEntry),
    monthlySnapshots: (stored.monthlySnapshots ?? []).map(
      normalizeMonthlySnapshot,
    ),
    openingPositions: (stored.openingPositions ?? []).map((position) =>
      migrateOpeningPosition(position, assets),
    ),
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
  const balance = cashEntries
    .reduce(
    (balance, entry) =>
      entry.type === "withdrawal"
          ? balance.minus(entry.amount)
          : balance.plus(entry.amount),
      decimal(0),
    );

  return normalizeMoney(balance);
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
  assetCurrency?: Currency,
) {
  const conviction = openingPosition.conviction;

  return (
    openingPosition.assetId.trim().length > 0 &&
    Number.isFinite(openingPosition.quantity) &&
    openingPosition.quantity > 0 &&
    Number.isFinite(openingPosition.averageCostPrice) &&
    openingPosition.averageCostPrice > 0 &&
    hasValidManualValuation(openingPosition, now, assetCurrency) &&
    hasValidOpeningPositionDateState(openingPosition, now) &&
    (conviction === undefined ||
      (Number.isInteger(conviction) && conviction >= 1 && conviction <= 5))
  );
}

function hasValidManualValuation(
  openingPosition: OpeningPosition,
  now: Date,
  assetCurrency?: Currency,
) {
  const valuation = openingPosition.manualValuation;

  if (valuation && openingPosition.currentPrice !== undefined) {
    return false;
  }

  if (!valuation) {
    return (
      openingPosition.currentPrice === undefined ||
      (Number.isFinite(openingPosition.currentPrice) &&
        openingPosition.currentPrice > 0)
    );
  }

  const asOf = valuation.asOf === null ? null : new Date(valuation.asOf);
  const hasValidAsOf =
    valuation.provenance === "legacy"
      ? valuation.asOf === null
      : asOf !== null &&
        Number.isFinite(asOf.getTime()) &&
        asOf.getTime() <= now.getTime();

  return (
    valuation.source === "manual" &&
    (valuation.currency === "INR" || valuation.currency === "USD") &&
    (assetCurrency === undefined || valuation.currency === assetCurrency) &&
    Number.isFinite(valuation.price) &&
    valuation.price > 0 &&
    hasValidAsOf
  );
}

function hasValidOpeningPositionDateState(
  openingPosition: OpeningPosition,
  now: Date,
) {
  const acquisitionDate =
    openingPosition.date === null
      ? null
      : getCalendarDatePart(openingPosition.date);
  const recordedAt = new Date(openingPosition.recordedAt ?? "");
  const hasValidRecordedAt =
    Number.isFinite(recordedAt.getTime()) &&
    recordedAt.getTime() <= now.getTime();
  const recordedOn = getCalendarDatePart(openingPosition.recordedOn ?? "");
  const hasValidRecordedOn =
    recordedOn !== null &&
    recordedOn === openingPosition.recordedOn &&
    !isFutureCalendarDate(recordedOn, now);
  const hasValidDateState =
    openingPosition.date === null
      ? hasValidRecordedAt && hasValidRecordedOn
      : acquisitionDate !== null &&
        !isFutureCalendarDate(openingPosition.date, now);

  return hasValidDateState;
}

function hasSupportedOpeningPositionPrecision(
  openingPosition: OpeningPosition,
) {
  const manualPrice = openingPosition.manualValuation?.price;
  const legacyPrice = openingPosition.currentPrice;

  return (
    Number.isFinite(openingPosition.quantity) &&
    openingPosition.quantity > 0 &&
    Number.isFinite(openingPosition.averageCostPrice) &&
    openingPosition.averageCostPrice > 0 &&
    (manualPrice === undefined ||
      (Number.isFinite(manualPrice) && manualPrice > 0)) &&
    (legacyPrice === undefined ||
      (Number.isFinite(legacyPrice) && legacyPrice > 0))
  );
}

function openingPositionMonth(openingPosition: OpeningPosition) {
  return getOpeningPositionHistoryDate(openingPosition)?.slice(0, 7) ?? null;
}

function prepareOpeningPositionForWrite(
  openingPosition: OpeningPosition,
  currentDate: Date,
  existingPosition?: OpeningPosition,
) {
  if (openingPosition.date !== null) {
    const {
      recordedAt: _recordedAt,
      recordedOn: _recordedOn,
      ...knownDatePosition
    } = openingPosition;
    return knownDatePosition;
  }

  if (existingPosition?.date === null) {
    return {
      ...openingPosition,
      recordedAt: existingPosition.recordedAt,
      recordedOn:
        existingPosition.recordedOn ??
        getOpeningPositionHistoryDate(existingPosition) ??
        formatLocalCalendarDate(currentDate),
    };
  }

  return {
    ...openingPosition,
    recordedAt: currentDate.toISOString(),
    recordedOn: formatLocalCalendarDate(currentDate),
  };
}

function rebuildPortfolioSnapshots({
  assets,
  cashEntries,
  earliestAffectedMonth,
  now,
  openingPositions,
  state,
  trades,
}: {
  assets?: Asset[];
  cashEntries?: CashEntry[];
  earliestAffectedMonth: string;
  now: Date;
  openingPositions?: OpeningPosition[];
  state: PortfolioStoreState;
  trades?: Trade[];
}) {
  const nextAssets = assets ?? state.assets;
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
      assets: nextAssets,
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

function assetRecordMonth(state: PortfolioStoreState, assetId: string) {
  return [
    ...state.openingPositions
      .filter((position) => position.assetId === assetId)
      .map(openingPositionMonth),
    ...state.trades
      .filter((trade) => trade.assetId === assetId)
      .map(tradeMonth),
  ]
    .filter((month): month is string => Boolean(month))
    .sort()[0];
}

function normalizedIdentity(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

function hasDuplicateAssetIdentity(assets: Asset[], candidate: Asset) {
  return hasCanonicalAssetConflict(assets, candidate);
}

const validAssetClasses: Asset["assetClass"][] = [
  "cash",
  "crypto",
  "debt",
  "etf",
  "stock",
];
const validExchanges = ["BSE", "CRYPTO", "NSE"];

function hasValidAssetIdentity(asset: Asset) {

  return (
    asset.id.trim().length > 0 &&
    asset.name.trim().length > 0 &&
    asset.symbol.trim().length > 0 &&
    asset.ticker.trim().length > 0 &&
    validAssetClasses.includes(asset.assetClass) &&
    (asset.exchange === undefined || validExchanges.includes(asset.exchange)) &&
    asset.instrumentType !== undefined &&
    isInstrumentType(asset.instrumentType) &&
    asset.sectorType !== undefined &&
    isSectorType(asset.sectorType) &&
    (asset.isTaxEligible === undefined ||
      typeof asset.isTaxEligible === "boolean") &&
    getV1AssetCurrencyIssue(asset) === undefined
  );
}

function quoteIdentityChanged(previous: Asset, next: Asset) {
  return (
    normalizedIdentity(previous.quoteSourceId) !==
      normalizedIdentity(next.quoteSourceId) ||
    normalizedIdentity(previous.ticker) !== normalizedIdentity(next.ticker) ||
    normalizedIdentity(previous.exchange) !==
      normalizedIdentity(next.exchange) ||
    previous.currency !== next.currency
  );
}

function withoutAssetQuotes<T extends QuoteCache | HistoricalQuoteCache>(
  cache: T,
  assetId: string,
): T {
  return Object.fromEntries(
    Object.entries(cache).filter(([, quote]) => quote.assetId !== assetId),
  ) as T;
}

function restoreRawStorageValue(
  storage: JsonStorage,
  key: string,
  rawValue: string | null,
) {
  if (rawValue === null) storage.removeItem(key);
  else storage.setRawItem(key, rawValue);
}

type AssetGraphJournal = {
  historical: string | null;
  portfolio: string | null;
  quotes: string | null;
};

type AssetGraphJournalParseResult =
  | { journal: AssetGraphJournal }
  | { reason: "invalid-json" | "invalid-shape" };

function parseAssetGraphJournal(
  rawValue: string,
): AssetGraphJournalParseResult {
  let value: JsonValue;

  try {
    value = JSON.parse(rawValue) as JsonValue;
  } catch {
    return { reason: "invalid-json" as const };
  }

  if (!value || Array.isArray(value) || typeof value !== "object") {
    return { reason: "invalid-shape" as const };
  }

  const candidate = value as Record<string, JsonValue>;
  const validRaw = (raw: JsonValue | undefined) =>
    raw === null || typeof raw === "string";

  return validRaw(candidate.historical) &&
    validRaw(candidate.portfolio) &&
    validRaw(candidate.quotes)
    ? { journal: candidate as AssetGraphJournal }
    : { reason: "invalid-shape" as const };
}

function restoreAssetGraphJournal(
  storage: JsonStorage,
  journal: AssetGraphJournal,
) {
  restoreRawStorageValue(storage, quoteCacheStorageKey, journal.quotes);
  restoreRawStorageValue(
    storage,
    historicalQuoteCacheStorageKey,
    journal.historical,
  );
  restoreRawStorageValue(storage, portfolioStorageKey, journal.portfolio);
}

function recoverPendingAssetGraphTransition(
  storage: JsonStorage,
  now: () => Date,
): StorageRecoveryIncident | undefined {
  const rawValue = storage.getRawItem(assetGraphJournalStorageKey);
  if (rawValue === null) return undefined;

  const parsed = parseAssetGraphJournal(rawValue);
  if ("reason" in parsed) {
    return {
      ...quarantineRawValue(
        storage,
        assetGraphJournalStorageKey,
        "Interrupted asset change",
        rawValue,
        parsed.reason,
        now,
      ),
      preserved: false,
    };
  }

  try {
    restoreAssetGraphJournal(storage, parsed.journal);
    storage.removeItem(assetGraphJournalStorageKey);
    return undefined;
  } catch {
    return {
      ...quarantineRawValue(
        storage,
        assetGraphJournalStorageKey,
        "Interrupted asset change",
        rawValue,
        "migration-failed",
        now,
      ),
      preserved: false,
    };
  }
}

function persistAssetGraphTransition({
  historicalQuoteCache,
  portfolio,
  quoteCache,
  storage,
}: {
  historicalQuoteCache: HistoricalQuoteCache;
  portfolio: RawPortfolioSnapshot;
  quoteCache: QuoteCache;
  storage: JsonStorage;
}) {
  const previous = {
    historical: storage.getRawItem(historicalQuoteCacheStorageKey),
    portfolio: storage.getRawItem(portfolioStorageKey),
    quotes: storage.getRawItem(quoteCacheStorageKey),
  };

  storage.setItem(assetGraphJournalStorageKey, previous as JsonValue);

  try {
    persistQuoteCache(storage, quoteCache);
    persistHistoricalQuoteCache(storage, historicalQuoteCache);
    storage.setItem(portfolioStorageKey, portfolio as JsonValue);
    storage.removeItem(assetGraphJournalStorageKey);
  } catch (error) {
    try {
      restoreAssetGraphJournal(storage, previous);
      storage.removeItem(assetGraphJournalStorageKey);
    } catch {
      // The journal remains durable and is replayed before the next read.
    }
    throw error;
  }
}

function tradeMonth(trade: Trade) {
  return getCalendarDatePart(trade.date)?.slice(0, 7) ?? null;
}

function isValidTradeRecord(trade: Trade, now: Date) {
  const fees = trade.fees ?? 0;
  if (
    !Number.isFinite(trade.quantity) ||
    trade.quantity <= 0 ||
    !Number.isFinite(trade.pricePerUnit) ||
    trade.pricePerUnit <= 0 ||
    !Number.isFinite(fees) ||
    fees < 0 ||
    !Number.isFinite(trade.totalValue) ||
    trade.totalValue <= 0
  ) {
    return false;
  }

  const grossValue = decimal(trade.quantity).times(trade.pricePerUnit);
  const expectedTotal =
    trade.type === "buy" ? grossValue.plus(fees) : grossValue.minus(fees);

  return (
    trade.assetId.trim().length > 0 &&
    (trade.type === "buy" || trade.type === "sell") &&
    isWithinQuantum(trade.totalValue, expectedTotal, moneyQuantum) &&
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
  return normalizeTrade({
    ...input,
    totalValue: 0,
  });
}

function hasNonnegativeCashTimeline(cashEntries: CashEntry[]) {
  const orderedEntries = [...cashEntries].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder !== 0) return dateOrder;
    if (left.type !== right.type) return left.type === "addition" ? -1 : 1;
    return left.id.localeCompare(right.id);
  });
  let balance = decimal(0);

  for (const entry of orderedEntries) {
    balance =
      entry.type === "addition"
        ? balance.plus(entry.amount)
        : balance.minus(entry.amount);
    if (isAtOrBeyondNegativeQuantum(balance, moneyQuantum)) return false;
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
        date: getOpeningPositionHistoryDate(position) ?? "",
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

  let units = decimal(0);
  for (const event of events) {
    units = units.plus(event.delta);
    if (isAtOrBeyondNegativeQuantum(units, quantityQuantum)) return true;
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
  if (
    !Number.isFinite(trade.quantity) ||
    trade.quantity <= 0 ||
    !Number.isFinite(trade.pricePerUnit) ||
    trade.pricePerUnit <= 0 ||
    !Number.isFinite(fees) ||
    fees < 0 ||
    !Number.isFinite(trade.totalValue) ||
    trade.totalValue <= 0
  ) {
    return { isValid: false, reason: "invalidTrade" };
  }

  const grossValue = decimal(trade.quantity).times(trade.pricePerUnit);
  const expectedTotal =
    trade.type === "buy" ? grossValue.plus(fees) : grossValue.minus(fees);
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
    !isWithinQuantum(trade.totalValue, expectedTotal, moneyQuantum)
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
  const assetGraphRecoveryIncident = recoverPendingAssetGraphTransition(
    storage,
    now,
  );
  const snapshotResult = readPortfolioSnapshot(storage, now, migrate);
  const quoteCacheResult = readQuoteCache(storage, now);
  const historicalQuoteCacheResult = readHistoricalQuoteCache(storage, now);
  const incidents = [
    assetGraphRecoveryIncident,
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

      const normalizedAsset = normalizeAssetMetadata(asset);

      if (hasDuplicateAssetIdentity(state.assets, normalizedAsset)) {
        throw new Error("Asset identity already exists.");
      }

      const assets = [...state.assets, normalizedAsset];

      persistPortfolioTransition(storage, state, { assets });
      set({ assets });
    },
    addCashEntry: (cashEntry) => {
      const state = get();

      if (state.cashEntries.some((entry) => entry.id === cashEntry.id)) {
        return;
      }

      const normalizedCashEntry = normalizeCashRecord(cashEntry);
      if (
        !Number.isFinite(normalizedCashEntry.amount) ||
        normalizedCashEntry.amount <= 0
      ) {
        throw new Error("Cash entry amount is below supported precision.");
      }
      const cashEntries = [...state.cashEntries, normalizedCashEntry];

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
        normalizeSnapshotRecord(monthlySnapshot),
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

      const currentDate = now();
      const assetCurrency = state.assets.find(
        (asset) => asset.id === openingPosition.assetId,
      )?.currency;
      const preparedPosition = prepareOpeningPositionForWrite(
        openingPosition,
        currentDate,
      );
      if (!isValidOpeningPosition(preparedPosition, currentDate, assetCurrency)) {
        throw new Error("Opening position contains invalid financial values.");
      }
      const normalizedPosition = normalizeOpeningPosition(preparedPosition);
      if (!isValidOpeningPosition(normalizedPosition, currentDate, assetCurrency)) {
        throw new Error("Opening position contains invalid financial values.");
      }
      const openingPositions = [...state.openingPositions, normalizedPosition];

      persistPortfolioTransition(storage, state, { openingPositions });
      set({ openingPositions });
    },
    addTrade: (trade) => {
      const state = get();

      if (state.trades.some((currentTrade) => currentTrade.id === trade.id)) {
        return;
      }

      const normalizedTrade = normalizeTrade(trade);
      if (!isValidTradeRecord(normalizedTrade, now())) {
        throw new Error("Trade contains invalid financial values.");
      }
      const trades = [...state.trades, normalizedTrade];

      persistPortfolioTransition(storage, state, { trades });
      set({ trades });
    },
    clearQuoteCache: () => {
      set({ quoteCache: {} });
      storage.removeItem(quoteCacheStorageKey);
    },
    clearHistoricalQuoteCache: () => {
      set({ historicalQuoteCache: {} });
      storage.removeItem(historicalQuoteCacheStorageKey);
    },
    correctAsset: (input) => {
      const state = get();
      const existingAsset = state.assets.find((asset) => asset.id === input.id);

      if (!existingAsset) return { reason: "notFound", status: "rejected" };
      if (
        typeof input.name !== "string" ||
        typeof input.symbol !== "string" ||
        typeof input.ticker !== "string" ||
        (input.quoteSourceId !== undefined &&
          typeof input.quoteSourceId !== "string") ||
        !validAssetClasses.includes(input.assetClass)
      ) {
        return { reason: "invalidAsset", status: "rejected" };
      }

      const asset = normalizeAssetMetadata(input);
      if (!hasValidAssetIdentity(asset)) {
        return { reason: "invalidAsset", status: "rejected" };
      }
      if (hasDuplicateAssetIdentity(state.assets, asset)) {
        return { reason: "duplicateIdentity", status: "rejected" };
      }

      const assets = state.assets.map((currentAsset) =>
        currentAsset.id === asset.id ? asset : currentAsset,
      );
      const invalidatesQuotes = quoteIdentityChanged(existingAsset, asset);
      const quoteCache = invalidatesQuotes
        ? withoutAssetQuotes(state.quoteCache, asset.id)
        : state.quoteCache;
      const historicalQuoteCache = invalidatesQuotes
        ? withoutAssetQuotes(state.historicalQuoteCache, asset.id)
        : state.historicalQuoteCache;
      const earliestAffectedMonth = assetRecordMonth(state, asset.id);
      const history = earliestAffectedMonth
        ? rebuildPortfolioSnapshots({
            assets,
            earliestAffectedMonth,
            now: now(),
            state: {
              ...state,
              historicalQuoteCache,
              quoteCache,
            },
          })
        : {
            monthlySnapshots: state.monthlySnapshots,
            pendingMonths: [],
            provisionalMonths: [],
            refreshedMonths: [],
          };
      const portfolio = {
        ...selectRawSnapshot(state),
        assets,
        monthlySnapshots: history.monthlySnapshots,
      };

      persistAssetGraphTransition({
        historicalQuoteCache,
        portfolio,
        quoteCache,
        storage,
      });
      set({
        assets,
        historicalQuoteCache,
        monthlySnapshots: history.monthlySnapshots,
        quoteCache,
      });

      return {
        asset,
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        quoteCacheInvalidated: invalidatesQuotes,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
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
      if (
        !Number.isFinite(input.quantity) ||
        !Number.isFinite(input.pricePerUnit) ||
        (input.fees !== undefined && !Number.isFinite(input.fees))
      ) {
        return { reason: "invalidEntry", status: "rejected" };
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
      const assetCurrency = state.assets.find(
        (asset) => asset.id === openingPosition.assetId,
      )?.currency;

      const preparedPosition = prepareOpeningPositionForWrite(
        openingPosition,
        currentDate,
        existingPosition,
      );
      if (!isValidOpeningPosition(preparedPosition, currentDate, assetCurrency)) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      const normalizedPosition = normalizeOpeningPosition(preparedPosition);
      if (!isValidOpeningPosition(normalizedPosition, currentDate, assetCurrency)) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const earliestAffectedMonth = [
        openingPositionMonth(existingPosition),
        openingPositionMonth(normalizedPosition),
      ]
        .filter((month): month is string => Boolean(month))
        .sort()[0];

      if (!earliestAffectedMonth) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const openingPositions = state.openingPositions.map((position) =>
        position.id === normalizedPosition.id ? normalizedPosition : position,
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
        openingPosition: normalizedPosition,
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
      const normalizedEntry = normalizeCashRecord(cashEntry);
      if (!isValidManualCashEntry(normalizedEntry, now())) {
        return { reason: "invalidEntry", status: "rejected" };
      }

      const cashEntries = state.cashEntries.map((entry) =>
        entry.id === normalizedEntry.id ? normalizedEntry : entry,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });

      return { entry: normalizedEntry, status: "applied" };
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
    deleteAsset: (assetId) => {
      const state = get();
      const asset = state.assets.find((item) => item.id === assetId);
      if (!asset) return { reason: "notFound", status: "rejected" };

      const removedTrades = state.trades.filter(
        (trade) => trade.assetId === assetId,
      );
      const removedTradeIds = new Set(removedTrades.map((trade) => trade.id));
      const linkedCashEntries = state.cashEntries.filter(
        (entry) =>
          Boolean(entry.linkedTradeId) &&
          removedTradeIds.has(entry.linkedTradeId ?? ""),
      );
      const assets = state.assets.filter((item) => item.id !== assetId);
      const openingPositions = state.openingPositions.filter(
        (position) => position.assetId !== assetId,
      );
      const trades = state.trades.filter((trade) => trade.assetId !== assetId);
      const cashEntries = state.cashEntries.filter(
        (entry) => !removedTradeIds.has(entry.linkedTradeId ?? ""),
      );
      if (!hasNonnegativeCashTimeline(cashEntries)) {
        return { reason: "insufficientCash", status: "rejected" };
      }
      const quoteCache = withoutAssetQuotes(state.quoteCache, assetId);
      const historicalQuoteCache = withoutAssetQuotes(
        state.historicalQuoteCache,
        assetId,
      );
      const earliestAffectedMonth = assetRecordMonth(state, assetId);
      const affectedAutomaticSnapshots = earliestAffectedMonth
        ? state.monthlySnapshots.filter(
            (snapshot) =>
              snapshot.month >= earliestAffectedMonth &&
              snapshot.generated?.source === "auto",
          ).length
        : 0;
      const history = earliestAffectedMonth
        ? rebuildPortfolioSnapshots({
            assets,
            cashEntries,
            earliestAffectedMonth,
            now: now(),
            openingPositions,
            state: {
              ...state,
              historicalQuoteCache,
              quoteCache,
            },
            trades,
          })
        : {
            monthlySnapshots: state.monthlySnapshots,
            pendingMonths: [],
            provisionalMonths: [],
            refreshedMonths: [],
          };
      const portfolio = {
        ...selectRawSnapshot(state),
        assets,
        cashEntries,
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
        trades,
      };

      persistAssetGraphTransition({
        historicalQuoteCache,
        portfolio,
        quoteCache,
        storage,
      });
      set({
        assets,
        cashEntries,
        historicalQuoteCache,
        monthlySnapshots: history.monthlySnapshots,
        openingPositions,
        quoteCache,
        trades,
      });

      return {
        asset,
        impact: {
          automaticSnapshots: affectedAutomaticSnapshots,
          historicalQuotes:
            Object.keys(state.historicalQuoteCache).length -
            Object.keys(historicalQuoteCache).length,
          linkedCashEntries: linkedCashEntries.length,
          openingPositions:
            state.openingPositions.length - openingPositions.length,
          quotes:
            Object.keys(state.quoteCache).length - Object.keys(quoteCache).length,
          trades: removedTrades.length,
        },
        pendingMonths: history.pendingMonths,
        provisionalMonths: history.provisionalMonths,
        refreshedMonths: history.refreshedMonths,
        status: "applied",
      };
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
      get().deleteAsset(assetId);
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
      let commandInput = input;

      if (input.asset) {
        const normalizedCandidate = normalizeAssetMetadata(input.asset);
        const canonicalMatch = findCanonicalAsset(
          state.assets,
          normalizedCandidate,
        );
        const candidateWithCanonicalId = canonicalMatch
          ? { ...normalizedCandidate, id: canonicalMatch.id }
          : normalizedCandidate;

        if (
          hasCanonicalAssetConflict(state.assets, candidateWithCanonicalId)
        ) {
          return { isValid: false, reason: "invalidTrade" };
        }

        const asset = canonicalMatch ?? normalizedCandidate;
        commandInput = {
          ...input,
          asset,
          trade: {
            ...input.trade,
            assetId: asset.id,
          },
        };
      }

      const invalidResult = validateLinkedTrade(
        state,
        commandInput,
        commandInput.trade,
        "buy",
      );

      if (invalidResult) {
        return invalidResult;
      }

      commandInput = {
        ...commandInput,
        trade: normalizeTrade(commandInput.trade),
      };
      const normalizedInvalidResult = validateLinkedTrade(
        state,
        commandInput,
        commandInput.trade,
        "buy",
      );
      if (normalizedInvalidResult) {
        return normalizedInvalidResult;
      }

      const availableCash = cashBalance(state.cashEntries);

      if (
        decimal(commandInput.trade.totalValue)
          .minus(availableCash)
          .greaterThan(0)
      ) {
        return {
          availableCash,
          isValid: false,
          reason: "insufficientCash",
          requiredCash: commandInput.trade.totalValue,
        };
      }

      const cashEntry = linkedCashEntry(commandInput, "purchaseFunding");
      const assets =
        commandInput.asset &&
        !state.assets.some(
          (currentAsset) => currentAsset.id === commandInput.asset?.id,
        )
          ? [...state.assets, commandInput.asset]
          : state.assets;
      const cashEntries = [...state.cashEntries, cashEntry];
      const trades = [...state.trades, commandInput.trade];

      persistPortfolioTransition(storage, state, { assets, cashEntries, trades });
      set({ assets, cashEntries, trades });

      return { cashEntry, isValid: true, trade: commandInput.trade };
    },
    recordOpeningPosition: (input) => {
      const state = get();
      const currentDate = now();

      if (
        input.commandId.trim().length === 0 ||
        input.commandId !== input.openingPosition.id
      ) {
        throw new Error("Opening position command ID is required.");
      }

      const existingPosition = state.openingPositions.find(
        (position) => position.id === input.openingPosition.id,
      );

      if (existingPosition) {
        const existingAsset = state.assets.find(
          (asset) => asset.id === existingPosition.assetId,
        );

        return {
          asset: existingAsset ?? input.asset,
          openingPosition: existingPosition,
          quote: state.quoteCache[existingPosition.assetId] ?? input.quote,
          quoteCacheStatus: state.quoteCache[existingPosition.assetId]
            ? "cached"
            : input.quote
              ? "unavailable"
              : "notRequested",
          status: "alreadyApplied",
        };
      }

      if (
        input.quote &&
        (!Number.isFinite(input.quote.price) ||
          (input.quote.dayChangeAbs !== undefined &&
            !Number.isFinite(input.quote.dayChangeAbs)) ||
          (input.quote.dayChangePct !== undefined &&
            !Number.isFinite(input.quote.dayChangePct)))
      ) {
        throw new Error("Opening position quote contains invalid financial values.");
      }

      const preparedInputPosition = prepareOpeningPositionForWrite(
        input.openingPosition,
        currentDate,
      );
      if (
        !isValidOpeningPosition(
          preparedInputPosition,
          currentDate,
          input.asset.currency,
        )
      ) {
        throw new Error("Opening position contains invalid financial values.");
      }
      const normalizedInputPosition = normalizeOpeningPosition(
        preparedInputPosition,
      );
      const normalizedInputQuote = input.quote
        ? normalizeQuote(input.quote)
        : undefined;

      if (
        !isValidOpeningPosition(
          normalizedInputPosition,
          currentDate,
          input.asset.currency,
        )
      ) {
        throw new Error("Opening position is below supported precision.");
      }
      if (normalizedInputQuote && normalizedInputQuote.price <= 0) {
        throw new Error("Opening position quote is below supported precision.");
      }

      if (normalizedInputPosition.assetId !== input.asset.id) {
        throw new Error("Opening position must reference the command asset.");
      }

      if (
        normalizedInputQuote &&
        normalizedInputQuote.assetId !== input.asset.id
      ) {
        throw new Error("Opening position quote must reference the command asset.");
      }

      const normalizedCandidate = normalizeAssetMetadata(input.asset);
      const canonicalMatch = findCanonicalAsset(
        state.assets,
        normalizedCandidate,
      );
      const canonicalAsset = canonicalMatch
        ? { ...normalizedCandidate, id: canonicalMatch.id }
        : normalizedCandidate;

      if (hasCanonicalAssetConflict(state.assets, canonicalAsset)) {
        throw new Error("Asset identity already exists.");
      }

      const openingPosition = {
        ...normalizedInputPosition,
        assetId: canonicalAsset.id,
      };
      const quote = normalizedInputQuote
        ? { ...normalizedInputQuote, assetId: canonicalAsset.id }
        : undefined;
      const currencyIssue = getV1AssetCurrencyIssue(canonicalAsset);
      const quoteCurrencyIssue = quote
        ? getV1QuoteCurrencyIssue(canonicalAsset, quote)
        : undefined;

      if (currencyIssue || quoteCurrencyIssue) {
        throw new Error(currencyIssue ?? quoteCurrencyIssue);
      }

      const assets = canonicalMatch
        ? state.assets.map((asset) =>
            asset.id === canonicalAsset.id ? canonicalAsset : asset,
          )
        : [...state.assets, canonicalAsset];
      const openingPositions = [
        ...state.openingPositions,
        openingPosition,
      ];
      const invalidatesQuotes =
        canonicalMatch !== undefined &&
        quoteIdentityChanged(canonicalMatch, canonicalAsset);
      const baseQuoteCache = invalidatesQuotes
        ? withoutAssetQuotes(state.quoteCache, canonicalAsset.id)
        : state.quoteCache;
      const historicalQuoteCache = invalidatesQuotes
        ? withoutAssetQuotes(
            state.historicalQuoteCache,
            canonicalAsset.id,
          )
        : state.historicalQuoteCache;

      if (invalidatesQuotes) {
        const earliestAffectedMonth = assetRecordMonth(
          state,
          canonicalAsset.id,
        );
        const history = earliestAffectedMonth
          ? rebuildPortfolioSnapshots({
              assets,
              earliestAffectedMonth,
              now: now(),
              state: {
                ...state,
                historicalQuoteCache,
                openingPositions,
                quoteCache: baseQuoteCache,
              },
            })
          : {
              monthlySnapshots: state.monthlySnapshots,
            };
        const portfolio = {
          ...selectRawSnapshot(state),
          assets,
          monthlySnapshots: history.monthlySnapshots,
          openingPositions,
        };

        persistAssetGraphTransition({
          historicalQuoteCache,
          portfolio,
          quoteCache: baseQuoteCache,
          storage,
        });
        set({
          assets,
          historicalQuoteCache,
          monthlySnapshots: history.monthlySnapshots,
          openingPositions,
          quoteCache: baseQuoteCache,
        });
      } else {
        persistPortfolioTransition(storage, state, {
          assets,
          openingPositions,
        });
        set({ assets, openingPositions });
      }

      let cachedQuote: Quote | undefined;

      if (quote) {
        const quoteCache = {
          ...baseQuoteCache,
          [canonicalAsset.id]: quote,
        };

        try {
          persistQuoteCache(storage, quoteCache);
          set({ quoteCache });
          cachedQuote = quote;
        } catch {
          // Current price is durable on the opening position; quote cache can refresh later.
        }
      }

      return {
        asset: canonicalAsset,
        openingPosition,
        quote: cachedQuote,
        quoteCacheStatus: quote
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

      const normalizedInput = {
        ...input,
        trade: normalizeTrade(input.trade),
      };
      const normalizedInvalidResult = validateLinkedTrade(
        state,
        normalizedInput,
        normalizedInput.trade,
        "sell",
      );
      if (normalizedInvalidResult) {
        return normalizedInvalidResult;
      }

      const availableUnits = normalizeQuantity(
        sumFinancialValues([
          ...state.openingPositions
            .filter((position) => position.assetId === input.trade.assetId)
            .map((position) => position.quantity),
          ...state.trades
            .filter((trade) => trade.assetId === input.trade.assetId)
            .map((trade) =>
              trade.type === "buy" ? trade.quantity : -trade.quantity,
            ),
        ]),
      );

      if (
        decimal(normalizedInput.trade.quantity)
          .minus(availableUnits)
          .greaterThan(0)
      ) {
        return {
          availableUnits,
          isValid: false,
          reason: "insufficientUnits",
          requiredUnits: normalizedInput.trade.quantity,
        };
      }

      const cashEntry = linkedCashEntry(normalizedInput, "saleProceeds");
      const cashEntries = [...state.cashEntries, cashEntry];
      const trades = [...state.trades, normalizedInput.trade];

      persistPortfolioTransition(storage, state, { cashEntries, trades });
      set({ cashEntries, trades });

      return { cashEntry, isValid: true, trade: normalizedInput.trade };
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
      const result = get().correctAsset(asset);
      if (result.status === "rejected") {
        throw new Error(`Asset update rejected: ${result.reason}.`);
      }
    },
    updateCashEntry: (cashEntry) => {
      const state = get();
      const normalizedEntry = normalizeCashRecord(cashEntry);
      if (
        !Number.isFinite(normalizedEntry.amount) ||
        normalizedEntry.amount <= 0
      ) {
        throw new Error("Cash entry amount is below supported precision.");
      }
      const existingEntry = state.cashEntries.find(
        (currentEntry) => currentEntry.id === cashEntry.id,
      );

      if (
        (existingEntry && isLinkedCashEntry(existingEntry)) ||
        isLinkedCashEntry(normalizedEntry)
      ) {
        throw new Error(
          "Linked cash entries must be changed with their investment transaction.",
        );
      }

      const cashEntries = state.cashEntries.map((currentEntry) =>
        currentEntry.id === normalizedEntry.id ? normalizedEntry : currentEntry,
      );

      persistPortfolioTransition(storage, state, { cashEntries });
      set({ cashEntries });
    },
    updateMonthlySnapshot: (monthlySnapshot) => {
      const normalizedSnapshot = normalizeSnapshotRecord(monthlySnapshot);
      set((state) => ({
        monthlySnapshots: state.monthlySnapshots.map((currentSnapshot) =>
          currentSnapshot.id === normalizedSnapshot.id
            ? normalizedSnapshot
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
  }));
}

let runtimePortfolioStore: StoreApi<PortfolioStoreState> | undefined;

export function getPortfolioStore() {
  runtimePortfolioStore ??= createPortfolioStore();

  return runtimePortfolioStore;
}
