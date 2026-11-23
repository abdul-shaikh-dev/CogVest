import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import { withoutOrphanQuotes } from "@/src/domain/quoteCacheIntegrity";
import {
  backupRestoreJournalKey,
  casFolioSaltStorageKey,
  quickSetupStorageKey,
} from "@/src/services/storage/backupKeys";
import { refreshFuturesCashSnapshotHistory } from "@/src/domain/calculations";
import type { Preferences } from "@/src/types";

import { BackupRecoveryRequiredError, commitBackupRestore } from "./backupPersistence";
import type { StoreContext } from "./storeContext";
import {
  historicalQuoteCacheStorageKey,
  portfolioStorageKey,
  type PortfolioStoreState,
  preferencesStorageKey,
  quoteCacheStorageKey,
} from "./storeTypes";
import { createEmptyPortfolioSnapshot, readLegacyRecoveryCopies, selectRawSnapshot } from "./persistence";

type BackupActions = Pick<PortfolioStoreState,
  | "getBackupRevision"
  | "captureBackup"
  | "replaceFromBackup"
  | "readRecoveryCopies"
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
          // Export only quotes that still belong to a saved asset (#651).
          quoteCache: withoutOrphanQuotes(state.quoteCache, state.assets),
          historicalQuoteCache: withoutOrphanQuotes(state.historicalQuoteCache, state.assets),
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
          preferences: withDevicePrivacy(validated.portfolio.preferences, state.preferences),
        },
      };
      try {
        commitBackupRestore(storage, {
          [portfolioStorageKey]: JSON.stringify(candidate.portfolio),
          // The backup's preferences are inside its portfolio record (#665).
          [preferencesStorageKey]: null,
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
    readRecoveryCopies: () => [
      ...(get().storageRecovery?.incidents ?? []).flatMap((incident) => {
        if (!incident.preserved) return [];
        const rawValue = storage.getRawItem(incident.recoveryKey);
        return rawValue === null ? [] : [{ incident, rawValue }];
      }),
      // Copies from earlier versions, which nothing else can reach (#654).
      ...readLegacyRecoveryCopies(storage),
    ],
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
      // Resetting the portfolio resets its preferences too, as before #665.
      if (resetPortfolio) storage.removeItem(preferencesStorageKey);

      set({
        ...(resetPortfolio ? createEmptyPortfolioSnapshot() : {}),
        ...(resetQuoteCache ? { quoteCache: {} } : {}),
        ...(resetHistoricalQuoteCache ? { historicalQuoteCache: {} } : {}),
        storageRecovery: undefined,
      });
    },
  };
}

/**
 * A restore keeps this device's privacy settings (#718). An older backup, or
 * one made with masking off, must not quietly turn value masking or screenshot
 * blocking off here, nor put the value on this home screen's widget (#786).
 * Other display preferences come from the backup.
 */
function withDevicePrivacy(backup: Preferences, device: Preferences): Preferences {
  const { blockScreenCapture: _backupBlock, showWidgetValue: _backupWidget, ...rest } = backup;
  return {
    ...rest,
    maskWealthValues: device.maskWealthValues,
    ...(device.blockScreenCapture === undefined ? {} : { blockScreenCapture: device.blockScreenCapture }),
    ...(device.showWidgetValue === undefined ? {} : { showWidgetValue: device.showWidgetValue }),
  };
}
