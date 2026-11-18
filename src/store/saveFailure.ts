import { StorageWriteError } from "@/src/services/storage";

import { BackupRecoveryRequiredError } from "./backupPersistence";
import { AssetGraphJournalPendingError, UnloadablePortfolioError } from "./persistence";

/** The store refused a change because the portfolio was restored or needs recovery. */
export class StoreWriteBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreWriteBlockedError";
  }
}

export const storageFullMessage =
  "Device storage is full or unavailable, so nothing was saved. Free device storage and try again.";

/**
 * Turns a failed save into the message the person should see (#666): the
 * store's own instruction when it blocked the write, a storage message only
 * when storage actually failed, and the screen's fallback otherwise.
 */
export function describeSaveFailure(error: unknown, fallback: string): string {
  if (
    error instanceof StoreWriteBlockedError ||
    error instanceof AssetGraphJournalPendingError ||
    error instanceof UnloadablePortfolioError ||
    error instanceof BackupRecoveryRequiredError
  ) {
    return error.message;
  }
  if (error instanceof StorageWriteError) return storageFullMessage;
  return fallback;
}
