import {
  type EpfCommand,
  previewEpfAccountDeletion,
} from "@/src/domain/epf/persistence";
import type { UsdmFuturesAccount } from "@/src/domain/usdmFutures";
import type { DistributionInput } from "@/src/domain/distributions";
import type { BackupPayload } from "@/src/domain/portfolioBackup";
import {
  portfolioSchemaVersion,
  type RawPortfolioSnapshot,
} from "@/src/domain/portfolioSnapshot";
import type { PpfCsvImportInput } from "@/src/domain/ppfCsvImport";
import type { JsonStorage } from "@/src/services/storage";
import type {
  Asset,
  BuyTrade,
  CashEntry,
  Distribution,
  HistoricalQuote,
  HistoricalQuoteCache,
  MeasurementBasis,
  MeasurementBasisLine,
  MonthlySnapshot,
  OpeningPosition,
  PpfAccount,
  PpfLedgerEntry,
  Preferences,
  Quote,
  QuoteCache,
  SellTrade,
  Trade,
} from "@/src/types";

import type { PersistedParseFailure, PersistedPortfolioSnapshot } from "@/src/domain/persistedSchemas/persistedPortfolioSchema";

export const portfolioStorageKey = "cogvest:v1:portfolio";
/**
 * Display preferences, saved apart from the portfolio so a toggle does not
 * rewrite every record (#665). Absent until the first preference change; the
 * copy inside the portfolio record applies until then.
 */
export const preferencesStorageKey = "cogvest:v1:preferences";
export const preferencesRecordVersion = 1;
export const quoteCacheStorageKey = "cogvest:v1:quote-cache";
export const historicalQuoteCacheStorageKey =
  "cogvest:v1:historical-quote-cache";
export const assetGraphJournalStorageKey =
  "cogvest:v1:asset-graph-journal";
export const storageRecoveryKeyPrefix = "cogvest:recovery";

export { portfolioSchemaVersion, type RawPortfolioSnapshot };



export type PortfolioStoreState = RawPortfolioSnapshot & {
  applyEpfCommand: (command: EpfCommand, expectedRevision: string) => "applied" | "alreadyApplied";
  previewEpfAccountDeletion: (accountId: string) => ReturnType<typeof previewEpfAccountDeletion>;
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
  /** Creates or corrects one payout (D2); a payout to Cash owns its Cash addition. */
  saveDistribution: (input: DistributionInput) => DistributionMutationResult;
  deleteDistribution: (distributionId: string) => DistributionMutationResult;
  /** Ongoing "every payout since this date is recorded" statement (D3); null removes it. */
  setDistributionCoverage: (assetId: string, from: string | null) => DistributionCoverageResult;
  /**
   * Confirms several holdings' payouts as recorded in one save (#619). Writes the
   * same records as setDistributionCoverage; rejects the whole batch if any entry
   * is invalid or names a holding twice.
   */
  confirmDistributionCoverage: (entries: ReadonlyArray<{ assetId: string; from: string }>) => DistributionCoverageResult;
  /** Confirms where whole-portfolio XIRR starts (D9); null removes it. Never changes other records. */
  setMeasurementBasis: (input: MeasurementBasisInput | null) => MeasurementBasisResult;
  /** Marks trades without a Cash leg as paid from (or into) money outside CogVest (D10); null clears it. */
  setTradeFundingSource: (tradeIds: string[], source: "external" | null) => TradeFundingResult;
  saveFuturesAccount: (account: UsdmFuturesAccount) => void;
  saveFuturesCashTransfer: (input: FuturesCashTransferInput) => void;
  deleteFuturesCashTransfer: (accountId: string, eventId: string) => void;
  deleteFuturesAccount: (accountId: string) => void;
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
  deleteTrades: (tradeIds: string[]) => TradeBatchDeletionResult;
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
  previewTradeDeletion: (tradeIds: string[]) => TradeDeletionPreview;
  /** The kept copy of each recovered value, for export from the Recovery screen. */
  readRecoveryCopies: () => StorageRecoveryCopy[];
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
  /** Saves several quotes in one write; one invalid quote saves none. */
  upsertQuotes: (quotes: readonly Quote[]) => void;
};

export type LinkedTradeCommandInput = {
  asset?: Asset;
  cashLabel: string;
  cashNotes?: string;
  trade: BuyTrade | SellTrade;
};

export type FuturesCashTransferInput = {
  accountId: string;
  cashEntryId: string;
  eventId: string;
  at: string;
  amountUsdt: string;
  cashAmountInr: number;
  conversionFeeInr: string;
  inrPerUsdt: string;
  rateObservedAt: string;
  rateSource: string;
  notes?: string;
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
  | { reason: "notFound" | "insufficientCash"; status: "rejected" };

export type MeasurementBasisInput = Pick<MeasurementBasis, "startDate" | "kind"> & { openingBreakdown: MeasurementBasisLine[] };
export type MeasurementBasisResult =
  | { status: "applied"; basis: MeasurementBasis | null }
  | { status: "rejected"; reason: "invalidEntry"; problems: string[] };
export type TradeFundingResult =
  | { status: "applied" }
  | { status: "rejected"; reason: "notFound" | "linkedCash" | "invalidEntry" };

export type PpfLedgerMutationResult =
  | { entry: PpfLedgerEntry; status: "alreadyApplied" | "applied" }
  | {
      reason:
        | "accountMismatch"
        | "accountNotFound"
        | "insufficientCash"
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

export type AssetHistoryResult = {
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
      reason: "duplicateIdentity" | "invalidAsset" | "linkedEpf" | "linkedPayout" | "linkedPpf" | "notFound";
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
  | { reason: "insufficientCash" | "notFound" | "linkedDemerger" | "linkedEpf" | "linkedPayout" | "linkedPpf"; status: "rejected" };

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
    }
  | InventoryRejection;

/** A change that would oversell the holding or hide counted trades (#713). */
export type InventoryRejection = {
  dependentTradeIds: string[];
  reason: "hidesTrades" | "oversold";
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
  | { reason: "notFound"; status: "rejected" }
  | InventoryRejection;

export type DistributionMutationResult =
  | { status: "applied"; distribution?: Distribution }
  | { status: "rejected"; reason: "notFound" | "invalidEntry" | "insufficientCash" };

export type DistributionCoverageResult =
  | { status: "applied" }
  | { status: "rejected"; reason: "notFound" | "invalidEntry" };

export type TradeMutationRejectionReason =
  | "assetMismatch"
  | "linkedPayout"
  | "inconsistentLink"
  | "insufficientCash"
  | "invalidEntry"
  | "notFound"
  | "oversold"
  | "typeMismatch";

export type TradeCorrectionInput = Omit<BuyTrade | SellTrade, "totalValue">;

export type TradeHistoryResult = {
  pendingMonths: string[];
  provisionalMonths: string[];
  refreshedMonths: string[];
};

export type TradeDeletionImpact = {
  affectedHoldings: {
    assetId: string;
    corporateActionRecalculated: boolean;
    linkedCashEntries: number;
    name: string;
    transactions: number;
  }[];
  automaticSnapshots: number;
  detachedDemergers: number;
  earliestAffectedMonth: string;
  importedTransactions: number;
  linkedCashEntries: number;
  transactions: number;
};

export type TradeDeletionRejectionReason =
  | "corporateActionDependency"
  | "linkedPayout"
  | "emptySelection"
  | "inconsistentLink"
  | "insufficientCash"
  | "notFound"
  | "oversold";

export type TradeDeletionPreview =
  | { impact: TradeDeletionImpact; status: "ready" }
  | {
      blockingAssetIds?: string[];
      reason: TradeDeletionRejectionReason;
      status: "rejected";
    };

export type TradeBatchDeletionResult =
  | (TradeHistoryResult & {
      impact: TradeDeletionImpact;
      status: "applied";
    })
  | {
      blockingAssetIds?: string[];
      reason: TradeDeletionRejectionReason;
      status: "rejected";
    };

export type TradeCorrectionResult =
  | (TradeHistoryResult & {
      cashEntry?: CashEntry;
      status: "applied";
      trade: Trade;
    })
  | { reason: Exclude<TradeMutationRejectionReason, "oversold">; status: "rejected" }
  | InventoryRejection;

export type TradeDeletionResult =
  | (TradeHistoryResult & {
      cashEntry?: CashEntry;
      status: "applied";
      trade: Trade;
    })
  | {
      reason: TradeDeletionRejectionReason;
      status: "rejected";
    };

export type CreatePortfolioStoreOptions = {
  migratePortfolioSnapshot?: (
    stored: PersistedPortfolioSnapshot,
  ) => RawPortfolioSnapshot;
  now?: () => Date;
  storage?: JsonStorage;
};

export type StorageRecoveryReason =
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

/** A kept copy; `legacy` marks one saved by a version before #654 under its fixed key. */
export type StorageRecoveryCopy = { incident: StorageRecoveryIncident; rawValue: string; legacy?: true };

export type StorageRecoveryState = {
  incidents: StorageRecoveryIncident[];
};
