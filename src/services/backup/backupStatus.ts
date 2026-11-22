import { useSyncExternalStore } from "react";
import { z } from "zod";
import { createStore, type StoreApi } from "zustand/vanilla";

import {
  backupReminderDayOptions,
  defaultBackupReminderDays,
  recordBackupExport,
  snoozeBackupReminder,
  type BackupReminderDays,
  type BackupStatus,
} from "@/src/domain/backupReminder";
import type { RawPortfolioSnapshot } from "@/src/domain/portfolioSnapshot";
import { createMmkvJsonStorage, type JsonStorage } from "@/src/services/storage";
import { backupRestoreJournalKey, backupStatusStorageKey } from "@/src/services/storage/backupKeys";

export const backupStatusRecordVersion = 1;

const reminderDaysSchema = z.union(
  backupReminderDayOptions.map((days) => z.literal(days)) as unknown as [
    z.ZodLiteral<BackupReminderDays>, z.ZodLiteral<BackupReminderDays>, ...z.ZodLiteral<BackupReminderDays>[],
  ],
);

const backupStatusRecordSchema = z.object({
  version: z.literal(backupStatusRecordVersion),
  trackingSince: z.string().datetime(),
  reminderDays: reminderDaysSchema,
  lastBackupAt: z.string().datetime().optional(),
  fingerprintAtBackup: z.string().min(1).max(32).optional(),
  recordCountAtBackup: z.number().int().nonnegative().optional(),
  snoozedUntil: z.string().datetime().optional(),
}).strict();

export type BackupStatusState = {
  status: BackupStatus;
  /** Records a finished export of `snapshot`. */
  recordExport: (snapshot: RawPortfolioSnapshot) => void;
  snooze: () => void;
  setReminderDays: (days: BackupReminderDays) => void;
};

type Options = { now?: () => Date; storage?: JsonStorage };

/**
 * Reads the saved record. A missing or unreadable record starts a new one: it
 * holds only reminder bookkeeping, so the worst a reset does is show the
 * reminder again; it never blocks the portfolio from loading.
 */
function readStatus(storage: JsonStorage, now: () => Date): { status: BackupStatus; fresh: boolean } {
  const raw = storage.getRawItem(backupStatusStorageKey);
  if (raw !== null) {
    try {
      const parsed = backupStatusRecordSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        const { version: _version, ...status } = parsed.data;
        return { status, fresh: false };
      }
    } catch {
      // Fall through to a new record.
    }
  }
  return {
    status: { trackingSince: now().toISOString(), reminderDays: defaultBackupReminderDays },
    fresh: true,
  };
}

export function createBackupStatusStore({
  now = () => new Date(),
  storage = createMmkvJsonStorage(),
}: Options = {}): StoreApi<BackupStatusState> {
  function persist(status: BackupStatus) {
    if (storage.getRawItem(backupRestoreJournalKey) !== null) {
      throw new Error("Restart CogVest to finish local data recovery first.");
    }
    storage.setItem(backupStatusStorageKey, { version: backupStatusRecordVersion, ...status });
  }

  const initial = readStatus(storage, now);
  if (initial.fresh) {
    // Start the clock now so a first-day user is not reminded at once.
    try { persist(initial.status); } catch { /* Retried on the next change. */ }
  }

  return createStore<BackupStatusState>((set, get) => {
    // The state changes only after the write succeeds.
    const update = (status: BackupStatus) => {
      persist(status);
      set({ status });
    };
    return {
      status: initial.status,
      recordExport: (snapshot) => update(recordBackupExport(get().status, snapshot, now())),
      snooze: () => update(snoozeBackupReminder(get().status, now())),
      setReminderDays: (reminderDays) => {
        const { snoozedUntil: _snoozedUntil, ...rest } = get().status;
        update({ ...rest, reminderDays });
      },
    };
  });
}

let runtimeStore: StoreApi<BackupStatusState> | undefined;

export function getBackupStatusStore() {
  runtimeStore ??= createBackupStatusStore();
  return runtimeStore;
}

export function useBackupStatus(store = getBackupStatusStore()) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
