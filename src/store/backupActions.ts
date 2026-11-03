import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import {
  backupRestoreJournalKey,
  casFolioSaltStorageKey,
  quickSetupStorageKey,
} from "@/src/services/storage/backupKeys";
import { refreshFuturesCashSnapshotHistory } from "@/src/domain/calculations";

import { BackupRecoveryRequiredError, commitBackupRestore } from "./backupPersistence";
import type { StoreContext } from "./storeContext";
import {
  historicalQuoteCacheStorageKey,
  portfolioStorageKey,
  type PortfolioStoreState,
  quoteCacheStorageKey,
} from "./storeTypes";
import { createEmptyPortfolioSnapshot, selectRawSnapshot } from "./persistence";

type BackupActions = Pick<PortfolioStoreState,
  | "getBackupRevision"
  | "captureBackup"
  | "replaceFromBackup"
  | "resetAffectedStorage">;

export function createBackupActions(context: StoreContext): BackupActions {
  const { assertBackupReady, bindActions, get, now, revision, set, storage } = context;
  return {
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
      const validated = validateBackupPayload(payload);
      const candidate = {
        ...validated,
        portfolio: {
          ...validated.portfolio,
          monthlySnapshots: refreshFuturesCashSnapshotHistory(validated.portfolio),
        },
      };
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
  };
}
