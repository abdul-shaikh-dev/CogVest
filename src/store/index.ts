import { createStore, type StoreApi } from "zustand/vanilla";
import { positionEvents, splitQuantity } from "@/src/domain/stockSplits";
import { assertCatalogSplits, assertSplitSourceIdentities, splitCanonicalIsin, withVerifiedStockSplits } from "@/src/domain/stockSplitCatalog";
import { validateBackupPayload, type BackupPayload } from "@/src/domain/portfolioBackup";
import { backupRestoreJournalKey, casFolioSaltStorageKey, quickSetupStorageKey } from "@/src/services/storage/backupKeys";
import { BackupRecoveryRequiredError, captureBackupStorage, commitBackupRestore, recoverBackupRestore } from "./backupPersistence";

import { planPpfCsvImport, type PpfCsvImportInput } from "@/src/domain/ppfCsvImport";
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
import {
  getOpeningPositionHistoryDate,
  isTransactionAfterOpeningCutover,
} from "@/src/domain/openingPositions";
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
import {
  calculatePpfConfirmedBalance,
  comparePpfLedgerEntries,
  validatePpfAccount,
  validatePpfLedgerEntryForAccount,
} from "@/src/domain/ppf";
import {
  getTradeQuantityDelta,
  hasAmbiguousSameDayTransactionOrder,
  isManualTrade,
  isTradeAcquisition,
} from "@/src/domain/transactionSemantics";
import {
  matchesOpeningPosition,
  reconcileTransactions,
} from "@/src/domain/transactionReconciliation";
import type { JsonStorage, JsonValue } from "@/src/services/storage";
import { createMmkvJsonStorage } from "@/src/services/storage";
import type {
  Asset,
  BuyTrade,
  CashEntry,
  CashEntryPurpose,
  Currency,
  HistoricalQuote,
  HistoricalQuoteCache,
  ImportedTransactionProvenance,
  MonthlySnapshot,
  OpeningPosition,
  Preferences,
  PpfAccount,
  PpfLedgerEntry,
  Quote,
  QuoteCache,
  SellTrade,
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
export const portfolioSchemaVersion = 12;
export const storageRecoveryKeyPrefix = "cogvest:recovery";

export { historicalQuoteCacheKey };

export type RawPortfolioSnapshot = {
  assets: Asset[];
  cashEntries: CashEntry[];
  monthlySnapshots: MonthlySnapshot[];
  openingPositions: OpeningPosition[];
  ppfAccounts: PpfAccount[];
  ppfLedgerEntries: PpfLedgerEntry[];
  preferences: Preferences;
  schemaVersion: typeof portfolioSchemaVersion;
  trades: Trade[];
};

export type PortfolioStoreState = RawPortfolioSnapshot & {
  restoreEpoch: number;
  captureBackup: () => { payload: BackupPayload; revision: string };
  getBackupRevision: () => string;
  replaceFromBackup: (payload: BackupPayload, expectedRevision: string) => void;
  addAsset: (asset: Asset) => void;
  addCashEntry: (cashEntry: CashEntry) => void;
  addMonthlySnapshot: (monthlySnapshot: MonthlySnapshot) => void;
  addOpeningPosition: (openingPosition: OpeningPosition) => void;
  addPpfAccount: (account: PpfAccount) => PpfAccountMutationResult;
  importPpfCsv: (command: {
    input: PpfCsvImportInput;
    expectedState: string;
    confirmReplacement: boolean;
    confirmDuplicateRows: boolean;
  }) => { status: "applied" | "alreadyApplied" } | { status: "rejected"; reason: string };
  addPpfLedgerEntry: (entry: PpfLedgerEntry) => PpfLedgerMutationResult;
  addTrade: (trade: Trade) => void;
  clearHistoricalQuoteCache: () => void;
  clearQuoteCache: () => void;
  correctAsset: (asset: Asset) => AssetCorrectionResult;
  correctTrade: (trade: TradeCorrectionInput) => TradeCorrectionResult;
  correctOpeningPosition: (
    openingPosition: OpeningPosition,
  ) => OpeningPositionCorrectionResult;
  correctPpfAccount: (account: PpfAccount) => PpfAccountMutationResult;
  correctPpfLedgerEntry: (entry: PpfLedgerEntry) => PpfLedgerMutationResult;
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
  deletePpfAccount: (accountId: string) => PpfAccountDeletionResult;
  deletePpfLedgerEntry: (entryId: string) => PpfLedgerMutationResult;
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
  recordOpeningPositionBatch: (
    input: OpeningPositionBatchCommandInput,
  ) => OpeningPositionBatchCommandResult;
  recordSaleWithProceeds: (
    input: LinkedTradeCommandInput,
  ) => LinkedTradeCommandResult;
  recordTransactionImport: (
    input: TransactionImportCommandInput,
  ) => TransactionImportCommandResult;
  resetAffectedStorage: () => void;
  storageRecovery?: StorageRecoveryState;
  updateAsset: (asset: Asset) => void;
  updateCashEntry: (cashEntry: CashEntry) => void;
  updateMonthlySnapshot: (monthlySnapshot: MonthlySnapshot) => void;
  updateOpeningPosition: (openingPosition: OpeningPosition) => void;
  updatePreferences: (preferences: Partial<Preferences>) => void;
  acknowledgeNudge: (kind: "metadata" | "minimal" | "insights", version: number) => void;
  updateTrade: (trade: Trade) => void;
  upsertHistoricalQuote: (historicalQuote: HistoricalQuote) => void;
  upsertQuote: (quote: Quote) => void;
};

export type LinkedTradeCommandInput = {
  asset?: Asset;
  cashLabel: string;
  cashNotes?: string;
  trade: BuyTrade | SellTrade;
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

export type OpeningPositionBatchCommandInput = {
  commandId: string;
  items: Array<
    OpeningPositionCommandInput & {
      existingPosition: "add" | "replace";
    }
  >;
};

export type OpeningPositionBatchCommandResult = {
  added: number;
  items: OpeningPositionCommandResult[];
  status: "alreadyApplied" | "applied";
  updated: number;
};

export type TransactionImportCommandInput = {
  assets: Asset[];
  commandId: string;
  cutovers: Array<{ measuredAsOf: string; openingPositionId: string }>;
  mode: "fullHistory" | "supplemental";
  replaceOpeningPositionIds: string[];
  sourceCoverage?: {
    externalActivity: "noneConfirmed";
    sourceFormat: string;
  };
  transactions: Trade[];
};

export type TransactionImportCommandResult = {
  added: number;
  removedOpeningPositions: number;
  status: "alreadyApplied" | "applied";
  updatedCutovers: number;
};

export type PpfAccountMutationResult =
  | { account: PpfAccount; status: "alreadyApplied" | "applied" }
  | {
      reason: "invalidAccount" | "invalidTimeline" | "notFound";
      status: "rejected";
    };

export type PpfAccountDeletionResult =
  | { account: PpfAccount; deletedEntries: number; status: "applied" }
  | { reason: "notFound"; status: "rejected" };

export type PpfLedgerMutationResult =
  | { entry: PpfLedgerEntry; status: "alreadyApplied" | "applied" }
  | {
      reason:
        | "accountMismatch"
        | "accountNotFound"
        | "invalidEntry"
        | "invalidTimeline"
        | "notFound";
      status: "rejected";
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

export type TradeCorrectionInput = Omit<BuyTrade | SellTrade, "totalValue">;

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
    displayMode: "standard",
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
    ppfAccounts: [],
    ppfLedgerEntries: [],
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
  validateSplitInventory({ assets, openingPositions: stored.openingPositions ?? [], trades: stored.trades ?? [] });

  return {
    assets,
    cashEntries: (stored.cashEntries ?? []).map(normalizeCashEntry),
    monthlySnapshots: (stored.monthlySnapshots ?? []).map(
      normalizeMonthlySnapshot,
    ),
    openingPositions: (stored.openingPositions ?? []).map((position) =>
      migrateOpeningPosition(position, assets),
    ),
    ppfAccounts: stored.ppfAccounts ?? [],
    ppfLedgerEntries: stored.ppfLedgerEntries ?? [],
    preferences: {
      ...createDefaultPreferences(),
      ...stored.preferences,
    },
    schemaVersion: portfolioSchemaVersion,
    // Migration preserves stored financial values exactly; normalization applies
    // only at write boundaries for new or corrected records.
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
    ppfAccounts: state.ppfAccounts,
    ppfLedgerEntries: state.ppfLedgerEntries,
    preferences: state.preferences,
    schemaVersion: portfolioSchemaVersion,
    trades: state.trades,
  };
}

function persistPortfolio(
  storage: JsonStorage,
  state: PortfolioStoreState,
) {
  validateSplitInventory(state);
  storage.setItem(portfolioStorageKey, selectRawSnapshot(state) as JsonValue);
}

function persistPortfolioTransition(
  storage: JsonStorage,
  state: PortfolioStoreState,
  transition: Partial<RawPortfolioSnapshot>,
) {
  validateSplitInventory({ ...state, ...transition });
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

function sortPpfLedgerEntries(entries: readonly PpfLedgerEntry[]) {
  return [...entries].sort(comparePpfLedgerEntries);
}

function isValidPpfTimeline(
  account: PpfAccount,
  entries: readonly PpfLedgerEntry[],
  currentDate: Date,
) {
  if (!validatePpfAccount(account, currentDate).isValid) return false;

  const ordered = sortPpfLedgerEntries(entries);
  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index];
    if (
      !validatePpfLedgerEntryForAccount(account, entry, currentDate).isValid
    ) {
      return false;
    }

    const balance = calculatePpfConfirmedBalance(
      account,
      ordered.slice(0, index + 1),
      entry.date,
    ).confirmedBalance;
    if (balance < 0) return false;
  }

  return true;
}

function isValidPpfLegacyLink(
  account: PpfAccount,
  state: Pick<PortfolioStoreState, "assets" | "ppfAccounts">,
) {
  if (account.legacyAssetId === undefined) return true;
  return (
    state.assets.some(
      (asset) =>
        asset.id === account.legacyAssetId && asset.instrumentType === "ppf",
    ) &&
    !state.ppfAccounts.some(
      (item) =>
        item.id !== account.id && item.legacyAssetId === account.legacyAssetId,
    )
  );
}

function isValidOpeningPosition(
  openingPosition: OpeningPosition,
  now: Date,
  assetCurrency?: Currency,
) {
  const conviction = openingPosition.conviction;
  const intendedHoldDays = openingPosition.intendedHoldDays;

  return (
    openingPosition.assetId.trim().length > 0 &&
    Number.isFinite(openingPosition.quantity) &&
    openingPosition.quantity > 0 &&
    Number.isFinite(openingPosition.averageCostPrice) &&
    openingPosition.averageCostPrice > 0 &&
    hasValidManualValuation(openingPosition, now, assetCurrency) &&
    hasValidOpeningPositionDateState(openingPosition, now) &&
    (conviction === undefined ||
      (Number.isInteger(conviction) && conviction >= 1 && conviction <= 5)) &&
    (intendedHoldDays === undefined ||
      (Number.isInteger(intendedHoldDays) && intendedHoldDays > 0))
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
  ppfAccounts,
  ppfLedgerEntries,
  state,
  trades,
}: {
  assets?: Asset[];
  cashEntries?: CashEntry[];
  earliestAffectedMonth: string;
  now: Date;
  openingPositions?: OpeningPosition[];
  ppfAccounts?: PpfAccount[];
  ppfLedgerEntries?: PpfLedgerEntry[];
  state: PortfolioStoreState;
  trades?: Trade[];
}) {
  const nextAssets = assets ?? state.assets;
  const nextCashEntries = cashEntries ?? state.cashEntries;
  const nextOpeningPositions = openingPositions ?? state.openingPositions;
  const nextPpfAccounts = ppfAccounts ?? state.ppfAccounts;
  const nextPpfLedgerEntries = ppfLedgerEntries ?? state.ppfLedgerEntries;
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
    ppfAccounts: nextPpfAccounts,
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
      ppfAccounts: nextPpfAccounts,
      ppfLedgerEntries: nextPpfLedgerEntries,
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
  try { assertCatalogSplits(asset); } catch { return false; }

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
  validateSplitInventory(portfolio);
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
  if (
    trade.assetId.trim().length === 0 ||
    trade.id.trim().length === 0 ||
    !Number.isFinite(trade.quantity) ||
    trade.quantity <= 0 ||
    !getCalendarDatePart(trade.date) ||
    isFutureCalendarDate(trade.date, now) ||
    (trade.conviction !== undefined &&
      (!Number.isInteger(trade.conviction) ||
        trade.conviction < 1 ||
        trade.conviction > 5)) ||
    (trade.intendedHoldDays !== undefined &&
      (!Number.isInteger(trade.intendedHoldDays) ||
        trade.intendedHoldDays <= 0))
  ) {
    return false;
  }

  if (trade.type === "transferOut") return true;
  if (trade.type === "transferIn") {
    return (
      trade.acquisitionCostPerUnit === undefined ||
      (Number.isFinite(trade.acquisitionCostPerUnit) &&
        trade.acquisitionCostPerUnit >= 0)
    );
  }

  const fees = trade.fees ?? 0;
  if (
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

  return isWithinQuantum(trade.totalValue, expectedTotal, moneyQuantum);
}

function isValidImportProvenance(
  provenance: ImportedTransactionProvenance,
  commandId: string,
) {
  return (
    provenance.importBatchId === commandId &&
    provenance.importBatchId.trim().length > 0 &&
    provenance.sourceFormat.trim().length > 0 &&
    provenance.sourceVersion.trim().length > 0 &&
    Number.isInteger(provenance.originalRowNumber) &&
    provenance.originalRowNumber > 0 &&
    Boolean(provenance.fingerprint?.trim()) &&
    (provenance.externalId === undefined ||
      provenance.externalId.trim().length > 0) &&
    (provenance.settlementDate === undefined ||
      getCalendarDatePart(provenance.settlementDate) ===
        provenance.settlementDate) &&
    (provenance.sourceExchange === undefined ||
      provenance.sourceExchange.trim().length > 0) &&
    (provenance.sourceExecutedAt === undefined ||
      provenance.sourceExecutedAt.trim().length > 0) &&
    (provenance.sourceFileIndex === undefined ||
      (Number.isInteger(provenance.sourceFileIndex) &&
        provenance.sourceFileIndex >= 0)) &&
    (provenance.sourceFileName === undefined ||
      provenance.sourceFileName.trim().length > 0) &&
    (provenance.sourceOrderId === undefined ||
      provenance.sourceOrderId.trim().length > 0) &&
    (provenance.sourceSegment === undefined ||
      provenance.sourceSegment.trim().length > 0) &&
    (provenance.sourceSymbol === undefined ||
      provenance.sourceSymbol.trim().length > 0) &&
    (provenance.fees === undefined ||
      (Number.isFinite(provenance.fees) && provenance.fees >= 0)) &&
    (provenance.taxes === undefined ||
      (Number.isFinite(provenance.taxes) && provenance.taxes >= 0))
  );
}

function transactionImportIdentity(trade: Trade) {
  return JSON.stringify({
    acquisitionCostPerUnit:
      trade.type === "transferIn" ? trade.acquisitionCostPerUnit ?? null : null,
    account: trade.importProvenance?.account?.trim().toUpperCase() ?? null,
    assetId: trade.assetId,
    date: trade.date,
    externalId:
      trade.importProvenance?.externalId?.trim().toUpperCase() ?? null,
    fingerprint: trade.importProvenance?.fingerprint ?? null,
    fees: trade.importProvenance?.fees ?? null,
    notes: trade.notes ?? null,
    originalDescription:
      trade.importProvenance?.originalDescription ?? null,
    pricePerUnit:
      trade.type === "buy" || trade.type === "sell"
        ? trade.pricePerUnit
        : null,
    quantity: trade.quantity,
    settlementDate: trade.importProvenance?.settlementDate ?? null,
    sourceExchange: trade.importProvenance?.sourceExchange ?? null,
    sourceExecutedAt: trade.importProvenance?.sourceExecutedAt ?? null,
    sourceFileIndex: trade.importProvenance?.sourceFileIndex ?? null,
    sourceFileName: trade.importProvenance?.sourceFileName ?? null,
    sourceFormat: trade.importProvenance?.sourceFormat ?? null,
    sourceOrderId: trade.importProvenance?.sourceOrderId ?? null,
    sourceSegment: trade.importProvenance?.sourceSegment ?? null,
    sourceSymbol: trade.importProvenance?.sourceSymbol ?? null,
    sourceVersion: trade.importProvenance?.sourceVersion ?? null,
    taxes: trade.importProvenance?.taxes ?? null,
    type: trade.type,
  });
}

function deriveTrade(input: TradeCorrectionInput): BuyTrade | SellTrade {
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

type QuantityEvent = {
  split?: import("@/src/types").StockSplitEvent;
  date: string;
  delta: number;
  id: string;
  importBatchId?: string;
  originalRowNumber?: number;
  priority: number;
};

function validateSplitInventory(portfolio: Pick<RawPortfolioSnapshot, "assets" | "openingPositions" | "trades">) {
  for (const asset of portfolio.assets) {
    assertCatalogSplits(asset);
    assertSplitSourceIdentities(asset, portfolio.trades);
    if (asset.stockSplits?.length && wouldOversellAsset(asset.id, portfolio.openingPositions, portfolio.trades, asset.stockSplits)) {
      throw new Error("Stock-split inventory does not reconcile.");
    }
  }
}

function assetQuantityEvents(
  assetId: string,
  openingPositions: OpeningPosition[],
  trades: Trade[],
  stockSplits: import("@/src/types").StockSplitEvent[] = [],
) {
  const assetOpenings = openingPositions.filter(
    (item) => item.assetId === assetId,
  );
  const events: QuantityEvent[] = [
    ...positionEvents({ openingPositions: assetOpenings, trades: trades.filter((trade) => trade.assetId === assetId), stockSplits })
      .flatMap((event) => event.type === "split"
        ? [{ date: event.date, delta: 0, id: event.split.id, priority: -1, split: event.split }] : []),
    ...assetOpenings
      .map((position) => ({
        date: getOpeningPositionHistoryDate(position) ?? "",
        delta: position.quantity,
        id: position.id,
        importBatchId: undefined as string | undefined,
        originalRowNumber: undefined as number | undefined,
        priority: 0,
      })),
    ...trades
      .filter(
        (item) =>
          item.assetId === assetId &&
          isTransactionAfterOpeningCutover(item.date, assetOpenings),
      )
      .map((trade) => ({
        date: getCalendarDatePart(trade.date) ?? "",
        delta: getTradeQuantityDelta(trade),
        id: trade.id,
        importBatchId: trade.importProvenance?.importBatchId,
        originalRowNumber: trade.importProvenance?.originalRowNumber,
        priority: isTradeAcquisition(trade) ? 1 : 2,
      })),
  ].filter((event) => event.date);

  events.sort(
    (left, right) => {
      const dateOrder = left.date.localeCompare(right.date);
      if (dateOrder !== 0) return dateOrder;
      if (left.split && right.split) return (left.split.sequence ?? 0) - (right.split.sequence ?? 0);
      if (
        left.importBatchId &&
        left.importBatchId === right.importBatchId &&
        left.originalRowNumber !== undefined &&
        right.originalRowNumber !== undefined
      ) {
        return left.originalRowNumber - right.originalRowNumber;
      }
      return left.priority - right.priority || left.id.localeCompare(right.id);
    },
  );

  return events;
}

/** Checks the complete dated inventory timeline, including measured cutovers. */
export function wouldOversellAsset(
  assetId: string,
  openingPositions: OpeningPosition[],
  trades: Trade[],
  stockSplits: import("@/src/types").StockSplitEvent[] = [],
) {
  const events = assetQuantityEvents(assetId, openingPositions, trades, stockSplits);
  let units = decimal(0);
  for (const event of events) {
    units = event.split ? splitQuantity(units, event.split) : units.plus(event.delta);
    if (isAtOrBeyondNegativeQuantum(units, quantityQuantum)) return true;
  }

  return false;
}

function availableUnitsBeforeTrade(
  assetId: string,
  openingPositions: OpeningPosition[],
  trades: Trade[],
  tradeId: string,
  stockSplits: import("@/src/types").StockSplitEvent[] = [],
) {
  let units = decimal(0);
  for (const event of assetQuantityEvents(assetId, openingPositions, trades, stockSplits)) {
    if (event.id === tradeId) return normalizeQuantity(units);
    units = event.split ? splitQuantity(units, event.split) : units.plus(event.delta);
  }
  return normalizeQuantity(units);
}

function linkedCashEntriesForTrade(state: PortfolioStoreState, tradeId: string) {
  return state.cashEntries.filter((entry) => entry.linkedTradeId === tradeId);
}

function isConsistentTradeCashLink(trade: Trade, entry: CashEntry) {
  if (!isManualTrade(trade)) return false;
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
  expectedType: "buy" | "sell",
  currentDate: Date,
): LinkedTradeCommandResult | null {
  if (!isManualTrade(trade) || trade.type !== expectedType) {
    return { isValid: false, reason: "invalidTradeType" };
  }

  const fees = trade.fees ?? 0;
  if (
    !isValidTradeRecord(trade, currentDate) ||
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
  const assetOpenings = state.openingPositions.filter(
    (position) => position.assetId === trade.assetId,
  );

  if (
    !hasMatchingAsset ||
    !tradeAsset ||
    !isTransactionAfterOpeningCutover(trade.date, assetOpenings) ||
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
  let restoreRecoveryIncident: StorageRecoveryIncident | undefined;
  try {
    recoverBackupRestore(storage);
  } catch {
    restoreRecoveryIncident = {
      detectedAt: now().toISOString(),
      displayName: "Interrupted portfolio restore - restart CogVest after freeing device storage",
      metadataKey: backupRestoreJournalKey,
      preserved: false,
      reason: "migration-failed",
      recoveryKey: backupRestoreJournalKey,
      sourceKey: backupRestoreJournalKey,
    };
  }
  const assetGraphRecoveryIncident = restoreRecoveryIncident ? undefined : recoverPendingAssetGraphTransition(
    storage,
    now,
  );
  const snapshotResult = restoreRecoveryIncident ? { data: createEmptyPortfolioSnapshot() } : readPortfolioSnapshot(storage, now, migrate);
  const quoteCacheResult = restoreRecoveryIncident ? { data: {} as QuoteCache } : readQuoteCache(storage, now);
  const historicalQuoteCacheResult = restoreRecoveryIncident ? { data: {} as HistoricalQuoteCache } : readHistoricalQuoteCache(storage, now);
  const incidents = [
    restoreRecoveryIncident,
    assetGraphRecoveryIncident,
    snapshotResult.incident,
    quoteCacheResult.incident,
    historicalQuoteCacheResult.incident,
  ].filter((incident): incident is StorageRecoveryIncident => Boolean(incident));
  const snapshot = snapshotResult.data;
  const quoteCache = quoteCacheResult.data;
  const historicalQuoteCache = historicalQuoteCacheResult.data;

  function revision(state: PortfolioStoreState) {
    return JSON.stringify({
      raw: captureBackupStorage(storage),
      portfolio: selectRawSnapshot(state),
      quoteCache: state.quoteCache,
      historicalQuoteCache: state.historicalQuoteCache,
      epoch: state.restoreEpoch,
    });
  }

  function assertBackupReady(state: PortfolioStoreState) {
    if (state.storageRecovery || storage.getRawItem(backupRestoreJournalKey) !== null ||
        storage.getRawItem(assetGraphJournalStorageKey) !== null) {
      throw new Error("Restart CogVest and resolve local data recovery before using backups.");
    }
  }

  const store = createStore<PortfolioStoreState>((set, get) => ({
    ...snapshot,
    restoreEpoch: 0,
    getBackupRevision: () => {
      const state = get();
      assertBackupReady(state);
      return revision(state);
    },
    captureBackup: () => {
      const state = get();
      assertBackupReady(state);
      return {
        payload: validateBackupPayload({
          portfolio: selectRawSnapshot(state),
          quoteCache: state.quoteCache,
          historicalQuoteCache: state.historicalQuoteCache,
          casFolioSalt: storage.getRawItem(casFolioSaltStorageKey),
        }),
        revision: revision(state),
      };
    },
    replaceFromBackup: (payload, expectedRevision) => {
      const state = get();
      assertBackupReady(state);
      if (revision(state) !== expectedRevision) {
        throw new Error("Your portfolio changed. Select the backup again to review the latest replacement details.");
      }
      const candidate = validateBackupPayload(payload);
      try {
        commitBackupRestore(storage, {
          [portfolioStorageKey]: JSON.stringify(candidate.portfolio),
          [quoteCacheStorageKey]: JSON.stringify(candidate.quoteCache),
          [historicalQuoteCacheStorageKey]: JSON.stringify(candidate.historicalQuoteCache),
          [casFolioSaltStorageKey]: candidate.casFolioSalt,
          [quickSetupStorageKey]: null,
        });
      } catch (error) {
        let needsRecovery = error instanceof BackupRecoveryRequiredError;
        try { needsRecovery ||= storage.getRawItem(backupRestoreJournalKey) !== null; } catch { needsRecovery = true; }
        if (needsRecovery) {
          set({ storageRecovery: { incidents: [{
            detectedAt: now().toISOString(),
            displayName: "Interrupted portfolio restore - restart CogVest after freeing device storage",
            metadataKey: backupRestoreJournalKey,
            preserved: false,
            reason: "migration-failed",
            recoveryKey: backupRestoreJournalKey,
            sourceKey: backupRestoreJournalKey,
          }] } });
        }
        throw error;
      }
      const restoreEpoch = state.restoreEpoch + 1;
      set({
        ...candidate.portfolio,
        quoteCache: candidate.quoteCache,
        historicalQuoteCache: candidate.historicalQuoteCache,
        restoreEpoch,
        ...bindActions(restoreEpoch),
      });
    },
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
    importPpfCsv: ({ input, expectedState, confirmReplacement, confirmDuplicateRows }) => {
      const state = get();
      const currentDate = now();
      const plan = planPpfCsvImport(input, state.ppfAccounts, state.ppfLedgerEntries, currentDate);
      if (plan.errors.length || !plan.account) return { status: "rejected", reason: "Correct the import errors before saving." };
      if (plan.alreadyApplied) return { status: "alreadyApplied" };
      if (expectedState !== plan.expectedState) return { status: "rejected", reason: "This account changed. Generate a fresh preview before saving." };
      if (plan.requiresReplacement && confirmReplacement !== true) return { status: "rejected", reason: "Confirm replacement of this account's checkpoint and history." };
      if (plan.duplicateRows > 0 && confirmDuplicateRows !== true) return { status: "rejected", reason: "Confirm that the repeated rows represent separate transactions." };
      const previous = state.ppfAccounts.find((account) => account.id === input.accountId)!;
      const ppfAccounts = state.ppfAccounts.map((account) => account.id === input.accountId ? plan.account! : account);
      const ppfLedgerEntries = [...state.ppfLedgerEntries.filter((entry) => entry.accountId !== input.accountId), ...plan.entries];
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: [previous.balanceAsOf, plan.account.balanceAsOf].sort()[0].slice(0, 7),
        now: currentDate, state, ppfAccounts, ppfLedgerEntries,
      });
      persistPortfolioTransition(storage, state, { ppfAccounts, ppfLedgerEntries, monthlySnapshots });
      set({ ppfAccounts, ppfLedgerEntries, monthlySnapshots });
      return { status: "applied" };
    },
    addPpfAccount: (account) => {
      const state = get();
      const currentDate = now();
      const existing = state.ppfAccounts.find((item) => item.id === account.id);
      if (existing) return { account: existing, status: "alreadyApplied" };
      if (
        !isValidPpfTimeline(account, [], currentDate) ||
        !isValidPpfLegacyLink(account, state)
      ) {
        return { reason: "invalidAccount", status: "rejected" };
      }

      const ppfAccounts = [...state.ppfAccounts, account];
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: account.balanceAsOf.slice(0, 7),
        now: currentDate,
        ppfAccounts,
        state,
      });
      persistPortfolioTransition(storage, state, { monthlySnapshots, ppfAccounts });
      set({ monthlySnapshots, ppfAccounts });
      return { account, status: "applied" };
    },
    addPpfLedgerEntry: (entry) => {
      const state = get();
      const currentDate = now();
      const existing = state.ppfLedgerEntries.find((item) => item.id === entry.id);
      if (existing) return { entry: existing, status: "alreadyApplied" };

      const account = state.ppfAccounts.find((item) => item.id === entry.accountId);
      if (!account) return { reason: "accountNotFound", status: "rejected" };

      const accountEntries = [
        ...state.ppfLedgerEntries.filter((item) => item.accountId === account.id),
        entry,
      ];
      if (!isValidPpfTimeline(account, accountEntries, currentDate)) {
        return {
          reason: validatePpfLedgerEntryForAccount(account, entry, currentDate).isValid
            ? "invalidTimeline"
            : "invalidEntry",
          status: "rejected",
        };
      }

      const ppfLedgerEntries = [...state.ppfLedgerEntries, entry];
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: entry.date.slice(0, 7),
        now: currentDate,
        ppfLedgerEntries,
        state,
      });
      persistPortfolioTransition(storage, state, {
        monthlySnapshots,
        ppfLedgerEntries,
      });
      set({ monthlySnapshots, ppfLedgerEntries });
      return { entry, status: "applied" };
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
    correctPpfAccount: (account) => {
      const state = get();
      const currentDate = now();
      const existing = state.ppfAccounts.find((item) => item.id === account.id);
      if (!existing) {
        return { reason: "notFound", status: "rejected" };
      }
      const entries = state.ppfLedgerEntries.filter(
        (entry) => entry.accountId === account.id,
      );
      if (
        !validatePpfAccount(account, currentDate).isValid ||
        !isValidPpfLegacyLink(account, state)
      ) {
        return { reason: "invalidAccount", status: "rejected" };
      }
      if (!isValidPpfTimeline(account, entries, currentDate)) {
        return { reason: "invalidTimeline", status: "rejected" };
      }

      const ppfAccounts = state.ppfAccounts.map((item) =>
        item.id === account.id ? account : item,
      );
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: [existing.balanceAsOf, account.balanceAsOf]
          .sort()[0]
          .slice(0, 7),
        now: currentDate,
        ppfAccounts,
        state,
      });
      persistPortfolioTransition(storage, state, { monthlySnapshots, ppfAccounts });
      set({ monthlySnapshots, ppfAccounts });
      return { account, status: "applied" };
    },
    correctPpfLedgerEntry: (entry) => {
      const state = get();
      const currentDate = now();
      const existing = state.ppfLedgerEntries.find((item) => item.id === entry.id);
      if (!existing) return { reason: "notFound", status: "rejected" };
      if (existing.accountId !== entry.accountId) {
        return { reason: "accountMismatch", status: "rejected" };
      }
      const account = state.ppfAccounts.find((item) => item.id === entry.accountId);
      if (!account) return { reason: "accountNotFound", status: "rejected" };

      const candidateEntries = state.ppfLedgerEntries
        .filter((item) => item.accountId === account.id)
        .map((item) => (item.id === entry.id ? entry : item));
      if (!validatePpfLedgerEntryForAccount(account, entry, currentDate).isValid) {
        return { reason: "invalidEntry", status: "rejected" };
      }
      if (!isValidPpfTimeline(account, candidateEntries, currentDate)) {
        return { reason: "invalidTimeline", status: "rejected" };
      }

      const ppfLedgerEntries = state.ppfLedgerEntries.map((item) =>
        item.id === entry.id ? entry : item,
      );
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: [existing.date, entry.date]
          .sort()[0]
          .slice(0, 7),
        now: currentDate,
        ppfLedgerEntries,
        state,
      });
      persistPortfolioTransition(storage, state, {
        monthlySnapshots,
        ppfLedgerEntries,
      });
      set({ monthlySnapshots, ppfLedgerEntries });
      return { entry, status: "applied" };
    },
    deletePpfAccount: (accountId) => {
      const state = get();
      const currentDate = now();
      const account = state.ppfAccounts.find((item) => item.id === accountId);
      if (!account) return { reason: "notFound", status: "rejected" };

      const deletedEntries = state.ppfLedgerEntries.filter(
        (entry) => entry.accountId === accountId,
      ).length;
      const ppfAccounts = state.ppfAccounts.filter((item) => item.id !== accountId);
      const ppfLedgerEntries = state.ppfLedgerEntries.filter(
        (entry) => entry.accountId !== accountId,
      );
      const earliestDate = [
        account.balanceAsOf,
        ...state.ppfLedgerEntries
          .filter((entry) => entry.accountId === accountId)
          .map((entry) => entry.date),
      ].sort()[0];
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: earliestDate.slice(0, 7),
        now: currentDate,
        ppfAccounts,
        ppfLedgerEntries,
        state,
      });
      persistPortfolioTransition(storage, state, {
        monthlySnapshots,
        ppfAccounts,
        ppfLedgerEntries,
      });
      set({ monthlySnapshots, ppfAccounts, ppfLedgerEntries });
      return { account, deletedEntries, status: "applied" };
    },
    deletePpfLedgerEntry: (entryId) => {
      const state = get();
      const currentDate = now();
      const entry = state.ppfLedgerEntries.find((item) => item.id === entryId);
      if (!entry) return { reason: "notFound", status: "rejected" };
      const account = state.ppfAccounts.find((item) => item.id === entry.accountId);
      if (!account) return { reason: "accountNotFound", status: "rejected" };

      const candidateEntries = state.ppfLedgerEntries.filter(
        (item) => item.accountId === account.id && item.id !== entry.id,
      );
      if (!isValidPpfTimeline(account, candidateEntries, currentDate)) {
        return { reason: "invalidTimeline", status: "rejected" };
      }

      const ppfLedgerEntries = state.ppfLedgerEntries.filter(
        (item) => item.id !== entry.id,
      );
      const { monthlySnapshots } = rebuildPortfolioSnapshots({
        earliestAffectedMonth: entry.date.slice(0, 7),
        now: currentDate,
        ppfLedgerEntries,
        state,
      });
      persistPortfolioTransition(storage, state, {
        monthlySnapshots,
        ppfLedgerEntries,
      });
      set({ monthlySnapshots, ppfLedgerEntries });
      return { entry, status: "applied" };
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

      const asset = normalizeAssetMetadata({ ...input, ...(existingAsset.stockSplits ? { stockSplits: existingAsset.stockSplits } : {}) });
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
      if (!isManualTrade(existingTrade)) {
        return { reason: "typeMismatch", status: "rejected" };
      }
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
      if (wouldOversellAsset(trade.assetId, state.openingPositions, trades, state.assets.find((asset) => asset.id === trade.assetId)?.stockSplits)) {
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
      if (wouldOversellAsset(trade.assetId, state.openingPositions, trades, state.assets.find((asset) => asset.id === trade.assetId)?.stockSplits)) {
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
      const currentDate = now();
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
        currentDate,
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
        currentDate,
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
    recordOpeningPositionBatch: (input) => {
      const state = get();
      const currentDate = now();

      if (input.commandId.trim().length === 0 || input.items.length === 0) {
        throw new Error("Opening position batch command is required.");
      }

      const itemIds = input.items.map((item) => item.openingPosition.id);
      if (
        new Set(itemIds).size !== itemIds.length ||
        input.items.some(
          (item) =>
            item.commandId.trim().length === 0 ||
            item.commandId !== item.openingPosition.id,
        )
      ) {
        throw new Error("Opening position batch item IDs must be unique.");
      }

      const appliedItems = input.items.map((item) => {
        const existing = state.openingPositions.find(
          (position) => position.id === item.openingPosition.id,
        );
        if (!existing) return false;
        if (item.existingPosition === "add") return true;

        const canonicalAsset =
          findCanonicalAsset(state.assets, normalizeAssetMetadata(item.asset)) ??
          normalizeAssetMetadata(item.asset);
        const desired = normalizeOpeningPosition(
          prepareOpeningPositionForWrite(
            { ...item.openingPosition, assetId: canonicalAsset.id },
            currentDate,
            existing,
          ),
        );
        return JSON.stringify(existing) === JSON.stringify(desired);
      });
      const alreadyApplied = appliedItems.every(Boolean);
      if (alreadyApplied) {
        return {
          added: 0,
          items: input.items.map((item) => {
            const openingPosition = state.openingPositions.find(
              (position) => position.id === item.openingPosition.id,
            )!;
            const asset = state.assets.find(
              (candidate) => candidate.id === openingPosition.assetId,
            ) ?? item.asset;
            const quote = state.quoteCache[asset.id];
            return {
              asset,
              openingPosition,
              quote,
              quoteCacheStatus: quote ? "cached" : "notRequested",
              status: "alreadyApplied",
            };
          }),
          status: "alreadyApplied",
          updated: 0,
        };
      }

      if (appliedItems.some(Boolean)) {
        throw new Error("Opening position batch is only partially applied.");
      }

      let assets = [...state.assets];
      let openingPositions = [...state.openingPositions];
      let quoteCache = { ...state.quoteCache };
      const affectedPositionMonths: string[] = [];
      const seenAssetIds = new Set<string>();
      const results: OpeningPositionCommandResult[] = [];
      let added = 0;
      let updated = 0;

      for (const item of input.items) {
        const normalizedCandidate = normalizeAssetMetadata(item.asset);
        const canonicalMatch = findCanonicalAsset(assets, normalizedCandidate);
        const canonicalAsset = canonicalMatch ?? normalizedCandidate;

        if (
          canonicalAsset.instrumentType === "ppf" ||
          canonicalAsset.assetClass === "cash"
        ) {
          throw new Error("Account-balance instruments cannot be imported as holdings.");
        }
        if (hasCanonicalAssetConflict(assets, canonicalAsset)) {
          throw new Error("Asset identity already exists.");
        }
        if (seenAssetIds.has(canonicalAsset.id)) {
          throw new Error("Opening position batch contains the same asset twice.");
        }
        seenAssetIds.add(canonicalAsset.id);

        const currencyIssue = getV1AssetCurrencyIssue(canonicalAsset);
        if (currencyIssue) throw new Error(currencyIssue);

        const preparedPosition = prepareOpeningPositionForWrite(
          {
            ...item.openingPosition,
            assetId: canonicalAsset.id,
          },
          currentDate,
          item.existingPosition === "replace"
            ? openingPositions.find(
                (position) => position.id === item.openingPosition.id,
              )
            : undefined,
        );
        const openingPosition = normalizeOpeningPosition(preparedPosition);
        if (
          !isValidOpeningPosition(
            openingPosition,
            currentDate,
            canonicalAsset.currency,
          ) ||
          !hasSupportedOpeningPositionPrecision(openingPosition)
        ) {
          throw new Error("Opening position contains invalid financial values.");
        }

        const quote = item.quote
          ? {
              ...normalizeQuote(item.quote),
              assetId: canonicalAsset.id,
            }
          : undefined;
        if (
          quote &&
          (quote.price <= 0 || getV1QuoteCurrencyIssue(canonicalAsset, quote))
        ) {
          throw new Error("Opening position quote contains invalid financial values.");
        }

        const existingForAsset = openingPositions.filter(
          (position) => position.assetId === canonicalAsset.id,
        );
        const hasTransactions = state.trades.some(
          (trade) => trade.assetId === canonicalAsset.id,
        );

        if (item.existingPosition === "replace") {
          if (
            existingForAsset.length !== 1 ||
            existingForAsset[0].id !== openingPosition.id ||
            hasTransactions
          ) {
            throw new Error("Existing holding cannot be replaced safely.");
          }
          const previousMonth = openingPositionMonth(existingForAsset[0]);
          if (previousMonth) affectedPositionMonths.push(previousMonth);
          openingPositions = openingPositions.map((position) =>
            position.id === openingPosition.id ? openingPosition : position,
          );
          updated += 1;
        } else {
          if (existingForAsset.length > 0 || hasTransactions) {
            throw new Error("Existing holding requires an explicit safe update.");
          }
          openingPositions.push(openingPosition);
          added += 1;
        }
        const nextMonth = openingPositionMonth(openingPosition);
        if (nextMonth) affectedPositionMonths.push(nextMonth);

        if (!canonicalMatch) assets.push(canonicalAsset);
        if (quote) quoteCache[canonicalAsset.id] = quote;
        results.push({
          asset: canonicalAsset,
          openingPosition,
          quote,
          quoteCacheStatus: quote ? "cached" : "notRequested",
          status: "applied",
        });
      }

      const earliestAffectedMonth = affectedPositionMonths.sort()[0];
      const monthlySnapshots = earliestAffectedMonth
        ? rebuildPortfolioSnapshots({
            assets,
            earliestAffectedMonth,
            now: currentDate,
            openingPositions,
            state: { ...state, quoteCache },
          }).monthlySnapshots
        : state.monthlySnapshots;
      const portfolio = {
        ...selectRawSnapshot(state),
        assets,
        monthlySnapshots,
        openingPositions,
      };
      persistAssetGraphTransition({
        historicalQuoteCache: state.historicalQuoteCache,
        portfolio,
        quoteCache,
        storage,
      });
      set({ assets, monthlySnapshots, openingPositions, quoteCache });

      return { added, items: results, status: "applied", updated };
    },
    recordTransactionImport: (input) => {
      const state = get();
      const currentDate = now();
      if (!input.commandId.trim()) {
        throw new Error("Transaction import command is empty.");
      }
      if (input.mode !== "fullHistory" && input.mode !== "supplemental") {
        throw new Error("Transaction import mode is invalid.");
      }
      // Event-only commands preserve executions, balances, and unrelated metadata.
      if (input.transactions.length === 0) {
        if (!input.assets.length || input.cutovers.length || input.replaceOpeningPositionIds.length) {
          throw new Error("Event-only imports require existing holdings and cannot change opening balances.");
        }
        const seen = new Set<string>();
        const updates = new Map<string, Asset>();
        const affectedMonths: string[] = [];
        for (const proposed of input.assets) {
          const existing = state.assets.find((asset) => asset.id === proposed.id);
          if (!existing || seen.has(proposed.id) || !proposed.stockSplits?.length ||
              !existing.isin || splitCanonicalIsin(existing.isin) !== proposed.isin ||
              existing.currency !== proposed.currency || existing.assetClass !== proposed.assetClass) {
            throw new Error("Event-only import holding identity is stale or invalid.");
          }
          seen.add(proposed.id);
          assertCatalogSplits(proposed);
          assertCatalogSplits(existing);
          const verified = withVerifiedStockSplits(existing);
          if (verified.stockSplits?.length !== proposed.stockSplits.length ||
              verified.stockSplits.some((event) => !proposed.stockSplits!.some((item) => item.id === event.id))) {
            throw new Error("Event-only import differs from the verified event chain.");
          }
          const updated = { ...existing, isin: verified.isin, stockSplits: verified.stockSplits };
          const openings = state.openingPositions.filter((position) => position.assetId === existing.id);
          if (openings.length > 1) throw new Error("Event-only import has multiple opening balances.");
          const baseline = openings[0];
          const reconciliation = reconcileTransactions({
            openingPosition: baseline,
            openingMeasuredAsOf: baseline?.measuredAsOf,
            stockSplits: updated.stockSplits,
            through: formatLocalCalendarDate(currentDate),
            transactions: state.trades.filter((trade) => trade.assetId === existing.id &&
              isTransactionAfterOpeningCutover(trade.date, openings)),
          });
          if (!reconciliation.isExact) throw new Error(reconciliation.adjustmentError ?? "Event-only import inventory no longer reconciles.");
          const addedEvents = verified.stockSplits!.filter((event) => !existing.stockSplits?.some((prior) => prior.id === event.id));
          if (addedEvents.length) {
            updates.set(existing.id, updated);
            const firstRecord = assetRecordMonth(state, existing.id);
            if (firstRecord) affectedMonths.push(firstRecord);
            affectedMonths.push(...addedEvents.map((event) => event.effectiveDate.slice(0, 7)));
          }
        }
        const assets = state.assets.map((asset) => updates.get(asset.id) ?? asset);
        validateSplitInventory({ ...state, assets });
        if (!updates.size) return { added: 0, removedOpeningPositions: 0, status: "alreadyApplied" as const, updatedCutovers: 0 };
        const monthlySnapshots = rebuildPortfolioSnapshots({
          assets, earliestAffectedMonth: affectedMonths.sort()[0], now: currentDate, state,
        }).monthlySnapshots;
        persistAssetGraphTransition({
          historicalQuoteCache: state.historicalQuoteCache,
          portfolio: { ...selectRawSnapshot(state), assets, monthlySnapshots },
          quoteCache: state.quoteCache, storage,
        });
        set({ assets, monthlySnapshots });
        return { added: 0, removedOpeningPositions: 0, status: "applied" as const, updatedCutovers: 0 };
      }
      const includesZerodha = input.transactions.some(
        (transaction) =>
          transaction.importProvenance?.sourceFormat === "zerodha-tradebook",
      );
      if (
        input.mode === "fullHistory" &&
        includesZerodha &&
        (input.sourceCoverage?.sourceFormat !== "zerodha-tradebook" ||
          input.sourceCoverage.externalActivity !== "noneConfirmed")
      ) {
        throw new Error(
          "Zerodha full-history import requires external-activity coverage confirmation.",
        );
      }

      const existingBatch = state.trades.filter(
        (trade) =>
          trade.importProvenance?.importBatchId === input.commandId,
      );
      if (existingBatch.length > 0) {
        const expectedById = new Map(
          input.transactions.map((trade) => [trade.id, normalizeTrade(trade)]),
        );
        if (
          existingBatch.length === input.transactions.length &&
          existingBatch.every((trade) => {
            const expected = expectedById.get(trade.id);
            return (
              expected !== undefined &&
              transactionImportIdentity(trade) ===
                transactionImportIdentity(expected)
            );
          })
        ) {
          return {
            added: 0,
            removedOpeningPositions: 0,
            status: "alreadyApplied" as const,
            updatedCutovers: 0,
          };
        }
        throw new Error("A partial transaction import batch already exists.");
      }

      const inputIds = new Set<string>();
      const normalizedTransactions = input.transactions.map((transaction) => {
        if (inputIds.has(transaction.id)) {
          throw new Error("Transaction import contains duplicate record IDs.");
        }
        inputIds.add(transaction.id);
        const normalized = normalizeTrade(transaction);
        const provenance = normalized.importProvenance;
        if (
          !provenance ||
          !isValidImportProvenance(provenance, input.commandId) ||
          !isValidTradeRecord(normalized, currentDate) ||
          (normalized.type === "transferIn" &&
            normalized.acquisitionCostPerUnit === undefined)
        ) {
          throw new Error("Transaction import contains an invalid record.");
        }
        return normalized;
      });
      if (
        normalizedTransactions.some((transaction) =>
          state.trades.some((existing) => existing.id === transaction.id),
        )
      ) {
        throw new Error("Transaction import record ID already exists.");
      }

      const identityKeys = new Map<string, string>();
      for (const transaction of [...state.trades, ...normalizedTransactions]) {
        const provenance = transaction.importProvenance;
        if (!provenance) continue;
        const keys = provenance.externalId
          ? [
              [
                  "external",
                  provenance.sourceFormat,
                  provenance.account?.trim().toUpperCase() ?? "",
                  provenance.externalId.trim().toUpperCase(),
              ].join("|"),
            ]
          : provenance.fingerprint
            ? [
                [
                    "fingerprint",
                    provenance.sourceFormat,
                    provenance.account?.trim().toUpperCase() ?? "",
                    provenance.fingerprint,
                ].join("|"),
              ]
            : [];
        for (const key of keys) {
          const priorId = identityKeys.get(key);
          if (priorId && priorId !== transaction.id) {
            throw new Error("Transaction import identity conflicts with existing data.");
          }
          identityKeys.set(key, transaction.id);
        }
      }

      let assets = [...state.assets];
      for (const rawAsset of input.assets) {
        const candidate = withVerifiedStockSplits(normalizeAssetMetadata(rawAsset));
        const existingById = assets.find((asset) => asset.id === candidate.id);
        if (candidate.stockSplits?.length && !normalizedTransactions.some((trade) => trade.assetId === candidate.id)) {
          if (!existingById?.isin || !rawAsset.stockSplits?.length ||
              splitCanonicalIsin(existingById.isin) !== candidate.isin ||
              existingById.currency !== candidate.currency || existingById.assetClass !== candidate.assetClass) {
            throw new Error("Event-only import holding identity is stale or invalid.");
          }
          assertCatalogSplits(existingById);
          const openings = state.openingPositions.filter((position) => position.assetId === candidate.id);
          if (openings.length > 1 || openings.some((position) =>
            input.cutovers.some((cutover) => cutover.openingPositionId === position.id) ||
            input.replaceOpeningPositionIds.includes(position.id))) {
            throw new Error("Event-only imports cannot change opening balances.");
          }
          const baseline = openings[0];
          const reconciliation = reconcileTransactions({
            openingPosition: baseline,
            openingMeasuredAsOf: baseline?.measuredAsOf,
            stockSplits: candidate.stockSplits,
            through: formatLocalCalendarDate(currentDate),
            transactions: state.trades.filter((trade) => trade.assetId === candidate.id &&
              isTransactionAfterOpeningCutover(trade.date, openings)),
          });
          if (!reconciliation.isExact) throw new Error(reconciliation.adjustmentError ?? "Event-only import inventory no longer reconciles.");
        }
        if (existingById) {
          if (
            candidate.isin &&
            existingById.isin &&
            splitCanonicalIsin(candidate.isin) !== splitCanonicalIsin(existingById.isin)
          ) {
            throw new Error("Transaction import asset identity conflicts with existing data.");
          }
          if (candidate.isin && !existingById.isin) {
            assets = assets.map((asset) =>
              asset.id === candidate.id ? { ...asset, isin: candidate.isin } : asset,
            );
          }
          if (candidate.stockSplits?.length) {
            assertCatalogSplits(existingById);
            assets = assets.map((asset) => asset.id === candidate.id
              ? { ...asset, isin: candidate.isin, stockSplits: candidate.stockSplits } : asset);
          }
          continue;
        }
        if (
          getV1AssetCurrencyIssue(candidate) ||
          hasDuplicateAssetIdentity(assets, candidate)
        ) {
          throw new Error("Transaction import asset identity is invalid.");
        }
        assets.push(candidate);
      }
      if (
        normalizedTransactions.some(
          (transaction) => !assets.some((asset) => asset.id === transaction.assetId),
        )
      ) {
        throw new Error("Transaction import references an unknown asset.");
      }

      const cutoverIds = new Set<string>();
      let openingPositions = state.openingPositions.map((position) => {
        const update = input.cutovers.find(
          (cutover) => cutover.openingPositionId === position.id,
        );
        if (!update) return position;
        if (
          cutoverIds.has(update.openingPositionId) ||
          !getCalendarDatePart(update.measuredAsOf) ||
          isFutureCalendarDate(update.measuredAsOf, currentDate)
        ) {
          throw new Error("Transaction import cutover is invalid.");
        }
        cutoverIds.add(update.openingPositionId);
        return { ...position, measuredAsOf: update.measuredAsOf };
      });
      if (cutoverIds.size !== input.cutovers.length) {
        throw new Error("Transaction import cutover references an unknown holding.");
      }

      if (input.mode === "supplemental") {
        for (const transaction of normalizedTransactions) {
          const baselines = openingPositions.filter(
            (position) => position.assetId === transaction.assetId,
          );
          if (
            baselines.length > 0 &&
            !isTransactionAfterOpeningCutover(transaction.date, baselines)
          ) {
            throw new Error(
              "Supplemental transactions must be after the confirmed holdings cutoff.",
            );
          }
        }
      }

      const replacementIds = new Set(input.replaceOpeningPositionIds);
      if (replacementIds.size !== input.replaceOpeningPositionIds.length) {
        throw new Error("Transaction import contains duplicate replacements.");
      }
      if (input.mode === "supplemental" && replacementIds.size > 0) {
        throw new Error("Supplemental imports cannot replace opening positions.");
      }
      const affectedAssetIds = new Set(
        normalizedTransactions.map((transaction) => transaction.assetId),
      );
      if (
        input.mode === "fullHistory" &&
        openingPositions.some(
          (position) =>
            affectedAssetIds.has(position.assetId) &&
            !replacementIds.has(position.id),
        )
      ) {
        throw new Error(
          "Full-history imports must exactly replace every affected opening position.",
        );
      }
      if (
        [...replacementIds].some((openingPositionId) => {
          const position = openingPositions.find(
            (item) => item.id === openingPositionId,
          );
          return !position || !affectedAssetIds.has(position.assetId);
        })
      ) {
        throw new Error(
          "Transaction import replacement does not match an affected holding.",
        );
      }
      if (hasAmbiguousSameDayTransactionOrder(state.trades, normalizedTransactions)) {
        throw new Error(
          "Transaction import has ambiguous same-day ordering with existing data.",
        );
      }
      const nextTrades = [...state.trades, ...normalizedTransactions];
      for (const openingPositionId of replacementIds) {
        const openingPosition = openingPositions.find(
          (position) => position.id === openingPositionId,
        );
        if (!openingPosition?.measuredAsOf) {
          throw new Error("Full-history replacement requires a confirmed cutover.");
        }
        const reconciliation = reconcileTransactions({
          stockSplits: assets.find((asset) => asset.id === openingPosition.assetId)?.stockSplits,
          through: openingPosition.measuredAsOf,
          transactions: nextTrades.filter(
            (trade) =>
              trade.assetId === openingPosition.assetId &&
              (getCalendarDatePart(trade.date) ?? trade.date) <=
                openingPosition.measuredAsOf!,
          ),
        });
        if (!matchesOpeningPosition(reconciliation, openingPosition)) {
          throw new Error("Full-history replacement no longer matches its baseline.");
        }
      }
      openingPositions = openingPositions.filter(
        (position) => !replacementIds.has(position.id),
      );

      if (
        [...affectedAssetIds].some((assetId) =>
          wouldOversellAsset(assetId, openingPositions, nextTrades, assets.find((asset) => asset.id === assetId)?.stockSplits),
        )
      ) {
        throw new Error("Transaction import would oversell a holding.");
      }

      const affectedMonths = [
        ...assets.flatMap((asset) => {
          const previous = state.assets.find((item) => item.id === asset.id);
          const newlyAttached = asset.stockSplits?.filter((event) => !previous?.stockSplits?.some((prior) => prior.id === event.id)) ?? [];
          return newlyAttached.length ? [assetRecordMonth(state, asset.id), ...newlyAttached.map((event) => event.effectiveDate.slice(0, 7))] : [];
        }),
        ...normalizedTransactions.map(tradeMonth),
        ...state.openingPositions
          .filter((position) => replacementIds.has(position.id))
          .map(openingPositionMonth),
        ...input.cutovers.flatMap((cutover) => {
          const previous = state.openingPositions.find(
            (position) => position.id === cutover.openingPositionId,
          );
          return [
            previous ? openingPositionMonth(previous) : null,
            cutover.measuredAsOf.slice(0, 7),
          ];
        }),
      ].filter((month): month is string => Boolean(month));
      const earliestAffectedMonth = affectedMonths.sort()[0];
      const monthlySnapshots = earliestAffectedMonth
        ? rebuildPortfolioSnapshots({
            assets,
            earliestAffectedMonth,
            now: currentDate,
            openingPositions,
            state,
            trades: nextTrades,
          }).monthlySnapshots
        : state.monthlySnapshots;
      const portfolio = {
        ...selectRawSnapshot(state),
        assets,
        monthlySnapshots,
        openingPositions,
        trades: nextTrades,
      };
      persistAssetGraphTransition({
        historicalQuoteCache: state.historicalQuoteCache,
        portfolio,
        quoteCache: state.quoteCache,
        storage,
      });
      set({ assets, monthlySnapshots, openingPositions, trades: nextTrades });

      return {
        added: normalizedTransactions.length,
        removedOpeningPositions: replacementIds.size,
        status: "applied" as const,
        updatedCutovers: input.cutovers.length,
      };
    },
    recordSaleWithProceeds: (input) => {
      const state = get();
      const currentDate = now();
      const invalidResult = validateLinkedTrade(
        state,
        input,
        input.trade,
        "sell",
        currentDate,
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
        currentDate,
      );
      if (normalizedInvalidResult) {
        return normalizedInvalidResult;
      }

      const trades = [...state.trades, normalizedInput.trade];
      if (wouldOversellAsset(
        normalizedInput.trade.assetId,
        state.openingPositions,
        trades,
        state.assets.find((asset) => asset.id === normalizedInput.trade.assetId)?.stockSplits,
      )) {
        return {
          availableUnits: availableUnitsBeforeTrade(
            normalizedInput.trade.assetId,
            state.openingPositions,
            trades,
            normalizedInput.trade.id,
            state.assets.find((asset) => asset.id === normalizedInput.trade.assetId)?.stockSplits,
          ),
          isValid: false,
          reason: "insufficientUnits",
          requiredUnits: normalizedInput.trade.quantity,
        };
      }

      const cashEntry = linkedCashEntry(normalizedInput, "saleProceeds");
      const cashEntries = [...state.cashEntries, cashEntry];

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
    acknowledgeNudge: (kind, version) => {
      if (!Number.isInteger(version) || version < 1) return;
      const state = get();
      if (state.storageRecovery) throw new Error("Resolve storage recovery before saving preferences.");
      if ((state.preferences.nudgeVersions?.[kind] ?? 0) >= version) return;
      const preferences = {
        ...state.preferences,
        nudgeVersions: { ...state.preferences.nudgeVersions, [kind]: version },
      };
      // Do not claim dismissal is saved if local storage rejected the write.
      persistPortfolio(storage, { ...state, preferences });
      set({ preferences });
    },
    updateTrade: (trade) => {
      if (!isManualTrade(trade)) return;
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
  const actions = Object.entries(store.getState()).filter(([, value]) => typeof value === "function");
  function bindActions(epoch: number): Partial<PortfolioStoreState> {
    return Object.fromEntries(actions.map(([key, value]) => [key, (...args: unknown[]) => {
      if (store.getState().restoreEpoch !== epoch) {
        throw new Error("The portfolio was restored. Reopen this screen before saving.");
      }
      if (key !== "resetAffectedStorage" && store.getState().storageRecovery) {
        throw new Error("Resolve local data recovery before changing the portfolio.");
      }
      return (value as (...input: unknown[]) => unknown)(...args);
    }])) as Partial<PortfolioStoreState>;
  }
  store.setState(bindActions(0));
  return store;
}

let runtimePortfolioStore: StoreApi<PortfolioStoreState> | undefined;

export function getPortfolioStore() {
  runtimePortfolioStore ??= createPortfolioStore();

  return runtimePortfolioStore;
}
