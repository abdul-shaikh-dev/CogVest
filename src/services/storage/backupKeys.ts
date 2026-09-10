export const casFolioSaltStorageKey = "cogvest.cas-folio-salt.v1";
export const quickSetupStorageKey = "cogvest:v1:quick-portfolio-setup";
export const backupRestoreJournalKey = "cogvest:backup-restore-journal:v1";

// A restore changes these keys together; never accept arbitrary keys from a file.
export const backupRestoreKeys = [
  "cogvest:v1:portfolio",
  "cogvest:v1:quote-cache",
  "cogvest:v1:historical-quote-cache",
  casFolioSaltStorageKey,
  quickSetupStorageKey,
] as const;
