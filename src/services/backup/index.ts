import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { Directory, File } from "expo-file-system";
import type { StoreApi } from "zustand/vanilla";

import {
  checkEncryptedBackupEnvelope,
  decryptBackupText,
  decryptBackupTextWithKey,
  encryptBackupText,
  encryptedBackupMaxBytes,
  EncryptedBackupError,
  isEncryptedBackupText,
  type EncryptedBackupDeps,
} from "@/src/domain/encryptedBackup";
import { createPortfolioBackup, parsePortfolioBackup, type BackupPayload } from "@/src/domain/portfolioBackup";
import type { RawPortfolioSnapshot } from "@/src/domain/portfolioSnapshot";
import { getPortfolioStore, selectRawSnapshot, type PortfolioStoreState } from "@/src/store";
import { getBackupStatusStore } from "./backupStatus";
import { readBoundedBackupFile } from "./boundedRead";
import { expoEncryptedBackupDeps } from "./encryption";

export type BackupReview = {
  createdAt: string;
  appVersion: string;
  counts: Array<{ label: string; current: number; backup: number }>;
};
export type PreparedRestore = { review: BackupReview };
/** A passphrase-protected backup that was picked and needs its passphrase (#760). */
export type LockedRestore = { locked: true };
export type ExportOptions = { passphrase?: string };

type WritableBackupFile = { write: (text: string) => Promise<void>; text: () => Promise<string>; delete: () => void };
type BackupRuntime = {
  store: StoreApi<PortfolioStoreState>;
  digest: (text: string) => Promise<string>;
  now: () => Date;
  appVersion: string;
  uniqueId: () => string;
  /** The picked file's text must be bounded to `encryptedBackupMaxBytes`. */
  selectFile: () => Promise<{ size: number; text: () => Promise<string> } | undefined>;
  selectDirectory: () => Promise<{ createFile: (name: string, mime: string) => WritableBackupFile } | undefined>;
  /** Passphrase protection; without it, protected exports and restores are unavailable. */
  encryption?: EncryptedBackupDeps;
  /** Called with the saved portfolio after an export is written and verified (#759). */
  onExported?: (portfolio: RawPortfolioSnapshot) => void;
  /** Called after a successful restore. The quick setup session resets itself on the restore (#666). */
  onRestored?: () => void;
};

const wrongPassphraseMessage = "The passphrase is wrong, or the file has been changed. Your portfolio has not changed.";

const invalidBackupPrefix = "Invalid CogVest backup:";
const countCollections = [
  ["assets", "Assets"], ["openingPositions", "Opening positions"],
  ["trades", "Investment records"], ["cashEntries", "Cash entries"],
  ["futuresAccounts", "Futures accounts"],
  ["monthlySnapshots", "Monthly snapshots"], ["ppfAccounts", "PPF accounts"],
  ["ppfLedgerEntries", "PPF entries"],
] as const;

function isCancellation(error: unknown) {
  return error instanceof Error && /cancelled|canceled/iu.test(error.message);
}

export function createBackupService(runtime: BackupRuntime) {
  const prepared = new WeakMap<PreparedRestore, { payload: BackupPayload; revision: string; epoch: number }>();
  const locked = new WeakMap<LockedRestore, { text: string; epoch: number }>();

  function assertActive(signal: AbortSignal | undefined, epoch: number) {
    if (signal?.aborted) throw new Error("Backup operation canceled.");
    if (runtime.store.getState().restoreEpoch !== epoch) throw new Error("Your portfolio changed. Please start again.");
  }

  async function exportPortfolioBackup(signal?: AbortSignal, options: ExportOptions = {}) {
    const epoch = runtime.store.getState().restoreEpoch;
    const { passphrase } = options;
    let file: WritableBackupFile | undefined;
    let writeCompleted = false;
    try {
      if (passphrase !== undefined && !runtime.encryption) throw new Error("Passphrase protection is not available.");
      assertActive(signal, epoch);
      runtime.store.getState().captureBackup();
      const directory = await runtime.selectDirectory();
      assertActive(signal, epoch);
      if (!directory) return undefined;
      const snapshot = runtime.store.getState().captureBackup();
      const now = runtime.now();
      const plainContents = await createPortfolioBackup(snapshot.payload, {
        createdAt: now.toISOString(), appVersion: runtime.appVersion,
      }, runtime.digest);
      let contents = plainContents;
      if (passphrase !== undefined && runtime.encryption) {
        const encrypted = await encryptBackupText(plainContents, passphrase, runtime.encryption);
        // Check the sealed text opens to the same backup before anything is written.
        if (await decryptBackupTextWithKey(encrypted.text, encrypted.key, runtime.encryption) !== plainContents) {
          throw new Error("Backup file verification failed.");
        }
        contents = encrypted.text;
      }
      assertActive(signal, epoch);
      // A changed portfolio during hashing must not be silently backed up as current.
      if (runtime.store.getState().captureBackup().revision !== snapshot.revision) {
        throw new Error("Your portfolio changed. Please back it up again.");
      }
      // The live records this file saves, as the reminder compares them later (#759).
      const exportedPortfolio = selectRawSnapshot(runtime.store.getState());
      const protectedSuffix = passphrase !== undefined ? "-protected" : "";
      const filename = `CogVest-backup-${now.toISOString().slice(0, 10)}-${runtime.uniqueId()}${protectedSuffix}.json`;
      file = directory.createFile(filename, "application/json");
      // SDK 58 writes asynchronously; verify and report only after the write settles.
      await file.write(contents);
      if (await file.text() !== contents) throw new Error("Backup file verification failed.");
      assertActive(signal, epoch);
      writeCompleted = true;
      // Reminder bookkeeping must never turn a saved backup into a failure.
      try { runtime.onExported?.(exportedPortfolio); } catch { /* The file is saved. */ }
      return filename;
    } catch (error) {
      if (file && !writeCompleted) {
        try { file.delete(); }
        catch { throw new Error("Backup was not completed. Remove the incomplete new backup file from the selected folder."); }
      }
      if (isCancellation(error)) return undefined;
      if (error instanceof Error && error.message.startsWith(invalidBackupPrefix)) {
        // Name the failing rule; a generic message leaves no way to find the record.
        const reason = error.message.slice(invalidBackupPrefix.length).trim().replace(/[.\s]+$/u, "");
        throw new Error(`CogVest can't create a restorable backup yet: ${reason}. Your data is unchanged.`);
      }
      throw new Error(error instanceof Error && /portfolio changed|back it up|recovery/iu.test(error.message)
        ? error.message : "Backup could not be saved. Check folder access and free space, then try again.");
    }
  }

  async function prepareRestore(text: string, signal: AbortSignal | undefined, epoch: number): Promise<PreparedRestore> {
    const decoded = await parsePortfolioBackup(text, runtime.digest);
    assertActive(signal, epoch);
    const current = runtime.store.getState();
    const revision = current.getBackupRevision();
    const result: PreparedRestore = {
      review: {
        createdAt: decoded.createdAt,
        appVersion: decoded.appVersion,
        counts: [...countCollections.map(([key, label]) => ({
          label, current: current[key].length,
          backup: decoded.payload.portfolio[key].length,
        })), ...([ ["accounts", "EPF accounts"], ["events", "EPF entries"],
          ["cashLinks", "EPF Cash links"], ["audit", "EPF edit history"] ] as const)
          .filter(([key]) => current.epf[key].length || decoded.payload.portfolio.epf[key].length)
          .map(([key, label]) => ({ label, current: current.epf[key].length, backup: decoded.payload.portfolio.epf[key].length })),
        ...([["distributions", "Dividends and payouts"], ["distributionCoverage", "Payout confirmations"]] as const)
          .filter(([key]) => current[key].length || decoded.payload.portfolio[key].length)
          .map(([key, label]) => ({ label, current: current[key].length, backup: decoded.payload.portfolio[key].length }))],
      },
    };
    prepared.set(result, { payload: decoded.payload, revision, epoch: current.restoreEpoch });
    return result;
  }

  // Never surface provider URIs or financial record fragments in error messages.
  const unreadableBackupMessage = "This backup could not be read or validated. Choose an intact, supported CogVest backup. Your portfolio has not changed.";

  async function selectPortfolioBackup(signal?: AbortSignal): Promise<PreparedRestore | LockedRestore | undefined> {
    const epoch = runtime.store.getState().restoreEpoch;
    try {
      assertActive(signal, epoch);
      runtime.store.getState().getBackupRevision();
      const file = await runtime.selectFile();
      assertActive(signal, epoch);
      if (!file) return undefined;
      if (!Number.isFinite(file.size) || file.size <= 0 || file.size > encryptedBackupMaxBytes) {
        throw new Error("This file is empty, unreadable, or exceeds the backup size limit.");
      }
      const text = await file.text();
      assertActive(signal, epoch);
      if (isEncryptedBackupText(text)) {
        if (!runtime.encryption) throw new Error("Passphrase protection is not available.");
        // Report a damaged or unsupported file before asking for its passphrase.
        checkEncryptedBackupEnvelope(text);
        const result: LockedRestore = { locked: true };
        locked.set(result, { text, epoch });
        return result;
      }
      return await prepareRestore(text, signal, epoch);
    } catch (error) {
      if (isCancellation(error)) return undefined;
      throw new Error(unreadableBackupMessage);
    }
  }

  /** Opens a protected backup with its passphrase and prepares the same review as an ordinary one. */
  async function unlockPortfolioBackup(handle: LockedRestore, passphrase: string, signal?: AbortSignal): Promise<PreparedRestore> {
    const candidate = locked.get(handle);
    if (!candidate || !runtime.encryption) throw new Error("Select the backup again before restoring.");
    let text: string;
    try {
      assertActive(signal, candidate.epoch);
      text = await decryptBackupText(candidate.text, passphrase, runtime.encryption);
      assertActive(signal, candidate.epoch);
    } catch (error) {
      // A wrong passphrase keeps the file selected so it can be tried again.
      if (error instanceof EncryptedBackupError && error.kind === "wrong-passphrase") throw new Error(wrongPassphraseMessage);
      locked.delete(handle);
      throw unlockFailure(error, signal);
    }
    try {
      return await prepareRestore(text, signal, candidate.epoch);
    } catch (error) {
      throw unlockFailure(error, signal);
    } finally {
      locked.delete(handle);
    }
  }

  function unlockFailure(error: unknown, signal: AbortSignal | undefined) {
    if (signal?.aborted) return new Error("Backup operation canceled.");
    if (error instanceof Error && /portfolio changed/iu.test(error.message)) {
      return new Error("Your portfolio changed. Select the backup again.");
    }
    return new Error(unreadableBackupMessage);
  }

  async function restorePortfolioBackup(review: PreparedRestore, signal?: AbortSignal) {
    const candidate = prepared.get(review);
    if (!candidate) throw new Error("Select the backup again before restoring.");
    prepared.delete(review);
    assertActive(signal, candidate.epoch);
    const state = runtime.store.getState();
    if (state.restoreEpoch !== candidate.epoch) throw new Error("Your portfolio changed. Select the backup again.");
    try {
      state.replaceFromBackup(candidate.payload, candidate.revision);
    } catch (error) {
      if (error instanceof Error && /portfolio changed|recovery|Restart CogVest/iu.test(error.message)) throw error;
      throw new Error("Restore did not finish. Restart CogVest if local data recovery is required, then select the backup again.");
    }
    runtime.onRestored?.();
  }

  /**
   * Saves each kept recovery copy, exactly as it was stored, to a folder the
   * user picks (#654). Returns the file names, or undefined when cancelled.
   */
  async function exportRecoveryCopies() {
    const copies = runtime.store.getState().readRecoveryCopies();
    if (!copies.length) throw new Error("No recovery copy is available to export.");
    const created: WritableBackupFile[] = [];
    try {
      const directory = await runtime.selectDirectory();
      if (!directory) return undefined;
      const names: string[] = [];
      for (const { incident, legacy, rawValue } of copies) {
        const area = incident.sourceKey.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "");
        const time = incident.detectedAt ? incident.detectedAt.replace(/[:.]/gu, "-") : "undated";
        const name = `CogVest-recovery-${legacy ? "legacy-" : ""}${area}-${time}.txt`;
        const file = directory.createFile(name, "text/plain");
        created.push(file);
        await file.write(rawValue);
        if (await file.text() !== rawValue) throw new Error("Recovery copy verification failed.");
        names.push(name);
      }
      return names;
    } catch (error) {
      for (const file of created) {
        try { file.delete(); } catch { /* The error below asks the user to check the folder. */ }
      }
      if (isCancellation(error)) return undefined;
      throw new Error("Recovery copies could not be saved. Check folder access and free space, then try again. Remove any partial CogVest-recovery files from that folder.");
    }
  }

  return { exportPortfolioBackup, exportRecoveryCopies, selectPortfolioBackup, unlockPortfolioBackup, restorePortfolioBackup };
}

let service: ReturnType<typeof createBackupService> | undefined;
function getService() {
  service ??= createBackupService({
    store: getPortfolioStore(),
    digest: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
    encryption: expoEncryptedBackupDeps,
    onExported: (portfolio) => getBackupStatusStore().getState().recordExport(portfolio),
    now: () => new Date(),
    appVersion: Constants.expoConfig?.version ?? "unknown",
    uniqueId: Crypto.randomUUID,
    selectFile: async () => {
      const result = await File.pickFileAsync(undefined, "*/*");
      const file = Array.isArray(result) ? result[0] : result;
      return file ? { size: file.size, text: () => readBoundedBackupFile(file.uri, undefined, encryptedBackupMaxBytes) } : undefined;
    },
    selectDirectory: async () => {
      const directory = await Directory.pickDirectoryAsync();
      return {
        createFile: (name: string, mime: string) => {
          const file = directory.createFile(name, mime);
          return {
            write: (text: string) => file.write(text),
            text: () => readBoundedBackupFile(file.uri, undefined, encryptedBackupMaxBytes),
            delete: () => file.delete(),
          };
        },
      };
    },
  });
  return service;
}

export const exportPortfolioBackup = (signal?: AbortSignal, options?: ExportOptions) => getService().exportPortfolioBackup(signal, options);
export const exportRecoveryCopies = () => getService().exportRecoveryCopies();
export const selectPortfolioBackup = (signal?: AbortSignal) => getService().selectPortfolioBackup(signal);
export const unlockPortfolioBackup = (handle: LockedRestore, passphrase: string, signal?: AbortSignal) =>
  getService().unlockPortfolioBackup(handle, passphrase, signal);
export const restorePortfolioBackup = (review: PreparedRestore, signal?: AbortSignal) => getService().restorePortfolioBackup(review, signal);
