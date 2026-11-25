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
import type { PpfMergeInput } from "@/src/domain/ppfCsvMerge";
import type { savingsGoalProblems } from "@/src/domain/savingsGoals";
import type { sipTemplateProblems } from "@/src/domain/sipTemplates";
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
  AllocationTargets,
  Preferences,
  Quote,
  QuoteCache,
  SavingsGoal,
  SipTemplate,
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
  /**
   * Adds a reviewed CogVest PPF CSV to an account's existing entries (#748):
   * new rows are added, chosen corrections applied, nothing else changes.
   */
  mergePpfCsv: (command: {
    input: PpfMergeInput;
    expectedState: string;
    confirmDuplicateRows: boolean;
  }) => { status: "applied"; added: number; corrected: number } | { status: "alreadyApplied" } | { status: "rejected"; reason: string };
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
  /** Creates or edits one savings goal (#767). Never changes another record. */
  saveSavingsGoal: (input: SavingsGoalInput) => SavingsGoalResult;
  deleteSavingsGoal: (goalId: string) => SavingsGoalDeletionResult;
  /** Creates or edits one SIP template (#766). Never records a purchase. */
  saveSipTemplate: (input: SipTemplateInput) => SipTemplateResult;
  /** Deletes a SIP template. Purchases it confirmed stay. */
  deleteSipTemplate: (templateId: string) => SipTemplateChangeResult;
  setSipTemplatePaused: (templateId: string, paused: boolean) => SipTemplateChangeResult;
  /** Marks a due instalment as skipped. Records nothing else. */
  skipSipInstalment: (templateId: string, month: string) => SipTemplateChangeResult;
  /**
   * Confirms a due instalment as one purchase, through the same checks as
   * Record Purchase, and marks the month confirmed in the same save.
   */
  confirmSipInstalment: (input: SipConfirmationInput) => SipConfirmationResult;
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
  /**
   * Replaces several saved months in one write, each keeping its ID and month
   * (#751). One invalid or unknown month saves none.
   */
  replaceMonthlySnapshots: (monthlySnapshots: readonly MonthlySnapshot[]) => void;
  updateOpeningPosition: (openingPosition: OpeningPosition) => void;
  updatePreferences: (preferences: Partial<Preferences>) => void;
  /**
   * Saves a target mix, or clears it with null (#764). Targets that are out of
   * range or do not add up to 100% are not saved.
   */
  saveAllocationTargets: (targets: AllocationTargets | null) => AllocationTargetsResult;
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
      /** First date the dated Cash balance would go below zero (#715). */
      shortfallDate?: string;
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

export type SavingsGoalInput = Omit<SavingsGoal, "createdAt" | "updatedAt">;
export type SavingsGoalResult =
  | { status: "applied"; goal: SavingsGoal }
  | { status: "rejected"; reason: "limit" }
  | { status: "rejected"; reason: "invalidEntry"; problems: ReturnType<typeof savingsGoalProblems> };
export type AllocationTargetsResult = { status: "applied" } | { status: "rejected"; problems: string[] };
export type SipTemplateInput = Pick<SipTemplate, "amountInr" | "assetId" | "dayOfMonth" | "funding" | "id" | "startMonth">;
export type SipTemplateResult =
  | { status: "applied"; template: SipTemplate }
  | { status: "rejected"; reason: "limit" | "unknownHolding" }
  | { status: "rejected"; reason: "invalidEntry"; problems: ReturnType<typeof sipTemplateProblems> };
export type SipTemplateChangeResult = { status: "applied" } | { status: "rejected"; reason: "notFound" | "notDue" };
export type SipConfirmationInput = { cashLabel: string; cashNotes?: string; month: string; templateId: string; trade: BuyTrade };
export type SipConfirmationResult =
  | { status: "applied"; cashEntry: CashEntry; depositEntry: CashEntry | null; trade: Trade }
  | { status: "rejected"; reason: "notFound" | "notDue" | "wrongHolding" }
  | { status: "rejected"; reason: "purchase"; purchase: Extract<LinkedTradeCommandResult, { isValid: false }> };
export type SavingsGoalDeletionResult = { status: "applied" } | { status: "rejected"; reason: "notFound" };

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
    }
  | CashShortfallRejection;

/** A manual Cash change refused because the dated balance would go below zero (#715). */
export type CashShortfallRejection = {
  reason: "insufficientCash";
  shortfallDate: string;
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
    }
  | CashShortfallRejection;

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
  /** Fees typed on an imported trade whose charges the import already holds (#716). */
  | "importedCharges"
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
