import type { JsonStorage } from "@/src/services/storage";
import { backupRestoreJournalKey, backupRestoreKeys } from "@/src/services/storage/backupKeys";

export type BackupStorageImage = Record<(typeof backupRestoreKeys)[number], string | null>;

export class BackupRecoveryRequiredError extends Error {
  constructor() { super("Restart CogVest to finish local data recovery before continuing."); }
}

export function captureBackupStorage(storage: JsonStorage): BackupStorageImage {
  return Object.fromEntries(backupRestoreKeys.map((key) => [key, storage.getRawItem(key)])) as BackupStorageImage;
}

function writeVerified(storage: JsonStorage, key: string, value: string | null) {
  if (value === null) storage.removeItem(key);
  else storage.setRawItem(key, value);
  if (storage.getRawItem(key) !== value) throw new Error("Local storage did not confirm the write.");
}

function writeImage(storage: JsonStorage, image: BackupStorageImage) {
  for (const key of backupRestoreKeys) writeVerified(storage, key, image[key]);
}

function parseJournal(raw: string): BackupStorageImage {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid restore journal.");
  const journal = value as Record<string, unknown>;
  if (Object.keys(journal).length !== 2 || journal.version !== 1 || !journal.original ||
      typeof journal.original !== "object" || Array.isArray(journal.original)) throw new Error("Invalid restore journal.");
  const original = journal.original as Record<string, unknown>;
  if (Object.keys(original).length !== backupRestoreKeys.length ||
      backupRestoreKeys.some((key) => !Object.hasOwn(original, key) ||
        (original[key] !== null && typeof original[key] !== "string"))) throw new Error("Invalid restore journal.");
  return original as BackupStorageImage;
}

export function recoverBackupRestore(storage: JsonStorage) {
  const raw = storage.getRawItem(backupRestoreJournalKey);
  if (raw === null) return;
  const original = parseJournal(raw);
  writeImage(storage, original);
  writeVerified(storage, backupRestoreJournalKey, null);
}

export function commitBackupRestore(storage: JsonStorage, next: BackupStorageImage) {
  if (storage.getRawItem(backupRestoreJournalKey) !== null) throw new Error("Restart CogVest to recover the interrupted restore first.");
  const original = captureBackupStorage(storage);
  const journal = JSON.stringify({ version: 1, original });
  // Nothing is changed until the rollback image itself is durably readable.
  writeVerified(storage, backupRestoreJournalKey, journal);
  function rollback() {
    try {
      writeImage(storage, original);
      writeVerified(storage, backupRestoreJournalKey, null);
    } catch {
      throw new BackupRecoveryRequiredError();
    }
  }
  try {
    writeImage(storage, next);
  } catch (error) {
    rollback();
    throw error;
  }
  try {
    writeVerified(storage, backupRestoreJournalKey, null);
  } catch (error) {
    // Deletion may have succeeded before its readback failed. Never attempt a
    // multi-key rollback without a durable journal: that could create a mixture.
    let pending: string | null;
    try { pending = storage.getRawItem(backupRestoreJournalKey); }
    catch { throw new BackupRecoveryRequiredError(); }
    if (pending === null) {
      try {
        if (backupRestoreKeys.every((key) => storage.getRawItem(key) === next[key])) return;
      } catch { /* Outcome is unreadable; block writes until restart. */ }
      throw new BackupRecoveryRequiredError();
    }
    rollback();
    throw error;
  }
}
