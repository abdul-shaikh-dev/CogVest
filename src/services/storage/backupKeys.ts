export const casFolioSaltStorageKey = "cogvest.cas-folio-salt.v1";
export const quickSetupStorageKey = "cogvest:v1:quick-portfolio-setup";
export const backupRestoreJournalKey = "cogvest:backup-restore-journal:v1";

// A restore changes these keys together; never accept arbitrary keys from a file.
export const backupRestoreKeys = [
  "cogvest:v1:portfolio",
  "cogvest:v1:preferences",
  "cogvest:v1:quote-cache",
  "cogvest:v1:historical-quote-cache",
  casFolioSaltStorageKey,
  quickSetupStorageKey,
] as const;

/** Keys a restore journal saved by an earlier version may not list; they did not exist then (#665). */
export const backupRestoreKeysAddedLater: ReadonlySet<string> = new Set(["cogvest:v1:preferences"]);

/**
 * When this phone last exported a backup, for the backup reminder (#759).
 * Device-only: never written to a backup file and never touched by a restore,
 * so a restore cannot count as a backup.
 */
export const backupStatusStorageKey = "cogvest:v1:backup-status";

/**
 * The App lock setting (#761). Device-only like the backup status: a backup
 * never carries it, so restoring onto a phone without a screen lock cannot
 * lock anyone out.
 */
export const appLockStorageKey = "cogvest:v1:app-lock";
