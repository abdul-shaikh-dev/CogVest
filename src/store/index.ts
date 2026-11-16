import { createStore, type StoreApi } from "zustand/vanilla";
import {
  backupRestoreJournalKey,
  casFolioSaltStorageKey,
  quickSetupStorageKey,
} from "@/src/services/storage/backupKeys";
import { createMmkvJsonStorage } from "@/src/services/storage";
import { withoutOrphanQuotes } from "@/src/domain/quoteCacheIntegrity";
import type { HistoricalQuoteCache, QuoteCache } from "@/src/types";

import { recoverBackupRestore } from "./backupPersistence";
import type { StoreContext } from "./storeContext";
import { createBackupActions } from "./backupActions";
import { createQuoteActions } from "./quoteActions";
import { createEpfActions } from "./epfActions";
import { createFuturesActions } from "./futuresActions";
import { createCashActions } from "./cashActions";
import { createSnapshotActions } from "./snapshotActions";
import { createPpfActions } from "./ppfActions";
import { createAssetActions } from "./assetActions";
import { createTradeActions } from "./tradeActions";
import { createOpeningPositionActions } from "./openingPositionActions";
import { createOpeningPositionBatchActions } from "./openingPositionBatchActions";
import { createTransactionImportActions } from "./transactionImportActions";
import { createReturnActions } from "./returnActions";
import { createPreferenceActions } from "./preferenceActions";
import {
  assetGraphJournalStorageKey,
  type CreatePortfolioStoreOptions,
  portfolioSchemaVersion,
  type PortfolioStoreState,
  type StorageRecoveryIncident,
} from "./storeTypes";
import {
  AssetGraphJournalPendingError,
  createEmptyPortfolioSnapshot,
  migratePortfolioSnapshot,
  pendingAssetGraphIncident,
  persistHistoricalQuoteCache,
  persistQuoteCache,
  readHistoricalQuoteCache,
  readPortfolioSnapshot,
  readPreferences,
  readQuoteCache,
  recoverPendingAssetGraphTransition,
} from "./persistence";

export {
  selectAssetById,
  selectCashBalance,
  selectOpeningPositionsForAsset,
  selectQuoteForAsset,
  selectTradesForAsset,
} from "./selectors";

export { historicalQuoteCacheKey } from "@/src/types";
export {
  assetGraphJournalStorageKey,
  historicalQuoteCacheStorageKey,
  portfolioSchemaVersion,
  portfolioStorageKey,
  preferencesStorageKey,
  quoteCacheStorageKey,
  storageRecoveryKeyPrefix,
  type AssetCorrectionResult,
  type AssetDeletionImpact,
  type AssetDeletionResult,
  type DistributionCoverageResult,
  type DistributionMutationResult,
  type FuturesCashTransferInput,
  type LinkedTradeCommandInput,
  type LinkedTradeCommandResult,
  type ManualCashCorrectionResult,
  type ManualCashDeletionResult,
  type MeasurementBasisInput,
  type MeasurementBasisResult,
  type OpeningPositionBatchCommandInput,
  type OpeningPositionBatchCommandResult,
  type OpeningPositionCommandInput,
  type OpeningPositionCommandResult,
  type OpeningPositionCorrectionResult,
  type OpeningPositionDeletionResult,
  type PortfolioStoreState,
  type PpfAccountDeletionResult,
  type PpfAccountMutationResult,
  type PpfLedgerMutationResult,
  type RawPortfolioSnapshot,
  type StorageRecoveryIncident,
  type StorageRecoveryState,
  type TradeBatchDeletionResult,
  type TradeCorrectionInput,
  type TradeCorrectionResult,
  type TradeDeletionImpact,
  type TradeDeletionPreview,
  type TradeDeletionResult,
  type TradeFundingResult,
  type TransactionImportCommandInput,
  type TransactionImportCommandResult,
} from "./storeTypes";
export { createDefaultPreferences, createEmptyPortfolioSnapshot } from "./persistence";
export { wouldOversellAsset } from "./tradeRules";

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
  const preferencesResult = restoreRecoveryIncident ? { data: undefined } : readPreferences(storage, now);
  const incidents = [
    restoreRecoveryIncident,
    assetGraphRecoveryIncident,
    snapshotResult.incident,
    quoteCacheResult.incident,
    historicalQuoteCacheResult.incident,
    preferencesResult.incident,
  ].filter((incident): incident is StorageRecoveryIncident => Boolean(incident));
  // Separately saved preferences replace the portfolio record's copy (#665).
  const snapshot = preferencesResult.data
    ? { ...snapshotResult.data, preferences: preferencesResult.data }
    : snapshotResult.data;
  let quoteCache = quoteCacheResult.data;
  let historicalQuoteCache = historicalQuoteCacheResult.data;
  if (incidents.length === 0) {
    // Drop quotes whose holding is gone, which earlier versions could save
    // when a refresh finished after a delete; they block backup export (#651).
    const keptQuotes = withoutOrphanQuotes(quoteCache, snapshot.assets);
    const keptHistoricalQuotes = withoutOrphanQuotes(historicalQuoteCache, snapshot.assets);
    if (keptQuotes !== quoteCache) persistQuoteCache(storage, keptQuotes);
    if (keptHistoricalQuotes !== historicalQuoteCache) {
      persistHistoricalQuoteCache(storage, keptHistoricalQuotes);
    }
    quoteCache = keptQuotes;
    historicalQuoteCache = keptHistoricalQuotes;
  }

  // Counts store changes, so a revision is cheap to take (#665). Every
  // portfolio, quote and preference write goes through the store; the two
  // keys written outside it are small and read directly.
  let changeCount = 0;
  function revision(state: PortfolioStoreState) {
    return JSON.stringify({
      casFolioSalt: storage.getRawItem(casFolioSaltStorageKey),
      changes: changeCount,
      epoch: state.restoreEpoch,
      quickSetup: storage.getRawItem(quickSetupStorageKey),
    });
  }

  function assertBackupReady(state: PortfolioStoreState) {
    if (state.storageRecovery || storage.getRawItem(backupRestoreJournalKey) !== null ||
        storage.getRawItem(assetGraphJournalStorageKey) !== null) {
      throw new Error("Restart CogVest and resolve local data recovery before using backups.");
    }
  }

  const store = createStore<PortfolioStoreState>((set, get) => {
    const context: StoreContext = {
      assertBackupReady, bindActions, get, now, revision, set, storage,
    };
    return {
      ...snapshot,
      restoreEpoch: 0,
      ...createBackupActions(context),
      ...createQuoteActions(context),
      ...createEpfActions(context),
      ...createFuturesActions(context),
      ...createCashActions(context),
      ...createSnapshotActions(context),
      ...createPpfActions(context),
      ...createAssetActions(context),
      ...createTradeActions(context),
      ...createOpeningPositionActions(context),
      ...createOpeningPositionBatchActions(context),
      ...createTransactionImportActions(context),
      ...createReturnActions(context),
      ...createPreferenceActions(context),
      historicalQuoteCache,
      quoteCache,
      schemaVersion: portfolioSchemaVersion,
      storageRecovery: incidents.length > 0 ? { incidents } : undefined,
    };
  });
  const actions = Object.entries(store.getState()).filter(([, value]) => typeof value === "function");
  const recoveryActions = new Set(["resetAffectedStorage", "readRecoveryCopies"]);
  // A change whose rollback also failed leaves its journal for the next start
  // to replay. Nothing more may be saved until then, or the replay would undo it (#654).
  function stopForPendingJournal(error: unknown): never {
    if (error instanceof AssetGraphJournalPendingError && !store.getState().storageRecovery) {
      store.setState({ storageRecovery: { incidents: [pendingAssetGraphIncident(now)] } });
    }
    throw error;
  }
  function bindActions(epoch: number): Partial<PortfolioStoreState> {
    return Object.fromEntries(actions.map(([key, value]) => [key, (...args: unknown[]) => {
      if (store.getState().restoreEpoch !== epoch) {
        throw new Error("The portfolio was restored. Reopen this screen before saving.");
      }
      if (!recoveryActions.has(key) && store.getState().storageRecovery) {
        throw new Error("Resolve local data recovery before changing the portfolio.");
      }
      let result: unknown;
      try {
        result = (value as (...input: unknown[]) => unknown)(...args);
      } catch (error) {
        stopForPendingJournal(error);
      }
      return result instanceof Promise ? result.catch(stopForPendingJournal) : result;
    }])) as Partial<PortfolioStoreState>;
  }
  store.setState(bindActions(0));
  store.subscribe(() => {
    changeCount += 1;
  });
  return store;
}

let runtimePortfolioStore: StoreApi<PortfolioStoreState> | undefined;

export function getPortfolioStore() {
  runtimePortfolioStore ??= createPortfolioStore();

  return runtimePortfolioStore;
}
