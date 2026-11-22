import { useMemo } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  backupReminder,
  portfolioFingerprint,
  portfolioRecordCount,
  type BackupReminder,
} from "@/src/domain/backupReminder";
import { usePortfolioFields } from "@/src/hooks";
import { useBackupStatus, type BackupStatusState } from "@/src/services/backup/backupStatus";
import { selectRawSnapshot, type PortfolioStoreState } from "@/src/store";

/** The records a backup saves, without preferences or actions. */
const recordFields = [
  "assets", "cashEntries", "distributionCoverage", "distributions", "epf", "futuresAccounts",
  "measurementBasis", "monthlySnapshots", "openingPositions", "ppfAccounts", "ppfLedgerEntries",
  "preferences", "trades",
] as const satisfies readonly (keyof PortfolioStoreState)[];

export function useBackupReminder({
  backupStatusStore,
  minimalMode,
  now,
  store,
}: {
  backupStatusStore: StoreApi<BackupStatusState>;
  minimalMode: boolean;
  now: Date;
  store: StoreApi<PortfolioStoreState>;
}): { reminder: BackupReminder; snooze: () => void } {
  const records = usePortfolioFields(store, recordFields);
  const { status, snooze } = useBackupStatus(backupStatusStore);
  // Hashing walks every record, so it runs only when a record list changes.
  const { fingerprint, recordCount } = useMemo(() => {
    const snapshot = selectRawSnapshot(records as PortfolioStoreState);
    return { fingerprint: portfolioFingerprint(snapshot), recordCount: portfolioRecordCount(snapshot) };
  }, [records]);
  const today = now.toDateString();
  const reminder = useMemo(
    () => backupReminder({ status, now, fingerprint, recordCount, minimalMode }),
    // Re-evaluate daily, not on every render's new Date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, fingerprint, recordCount, minimalMode, today],
  );
  return { reminder, snooze };
}
