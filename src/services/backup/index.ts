import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { Directory, File } from "expo-file-system";
import type { StoreApi } from "zustand/vanilla";

import { backupMaxBytes, createPortfolioBackup, parsePortfolioBackup, type BackupPayload } from "@/src/domain/portfolioBackup";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { resetQuickSetupSessionAfterRestore } from "@/src/features/quickSetup/quickSetupSession";
import { readBoundedBackupFile } from "./boundedRead";

export type BackupReview = {
  createdAt: string;
  appVersion: string;
  counts: Array<{ label: string; current: number; backup: number }>;
};
export type PreparedRestore = { review: BackupReview };

type WritableBackupFile = { write: (text: string) => void; text: () => Promise<string>; delete: () => void };
type BackupRuntime = {
  store: StoreApi<PortfolioStoreState>;
  digest: (text: string) => Promise<string>;
  now: () => Date;
  appVersion: string;
  uniqueId: () => string;
  selectFile: () => Promise<{ size: number; text: () => Promise<string> } | undefined>;
  selectDirectory: () => Promise<{ createFile: (name: string, mime: string) => WritableBackupFile } | undefined>;
  onRestored: () => void;
};

const countCollections = [
  ["assets", "Assets"], ["openingPositions", "Opening positions"],
  ["trades", "Investment records"], ["cashEntries", "Cash entries"],
  ["monthlySnapshots", "Monthly snapshots"], ["ppfAccounts", "PPF accounts"],
  ["ppfLedgerEntries", "PPF entries"],
] as const;

function isCancellation(error: unknown) {
  return error instanceof Error && /cancelled|canceled/iu.test(error.message);
}

export function createBackupService(runtime: BackupRuntime) {
  const prepared = new WeakMap<PreparedRestore, { payload: BackupPayload; revision: string; epoch: number }>();

  function assertActive(signal: AbortSignal | undefined, epoch: number) {
    if (signal?.aborted) throw new Error("Backup operation canceled.");
    if (runtime.store.getState().restoreEpoch !== epoch) throw new Error("Your portfolio changed. Please start again.");
  }

  async function exportPortfolioBackup(signal?: AbortSignal) {
    const epoch = runtime.store.getState().restoreEpoch;
    let file: WritableBackupFile | undefined;
    let writeCompleted = false;
    try {
      assertActive(signal, epoch);
      runtime.store.getState().captureBackup();
      const directory = await runtime.selectDirectory();
      assertActive(signal, epoch);
      if (!directory) return undefined;
      const snapshot = runtime.store.getState().captureBackup();
      const now = runtime.now();
      const contents = await createPortfolioBackup(snapshot.payload, {
        createdAt: now.toISOString(), appVersion: runtime.appVersion,
      }, runtime.digest);
      assertActive(signal, epoch);
      // A changed portfolio during hashing must not be silently backed up as current.
      if (runtime.store.getState().captureBackup().revision !== snapshot.revision) {
        throw new Error("Your portfolio changed. Please back it up again.");
      }
      const filename = `CogVest-backup-${now.toISOString().slice(0, 10)}-${runtime.uniqueId()}.json`;
      file = directory.createFile(filename, "application/json");
      file.write(contents);
      if (await file.text() !== contents) throw new Error("Backup file verification failed.");
      assertActive(signal, epoch);
      writeCompleted = true;
      return filename;
    } catch (error) {
      if (file && !writeCompleted) {
        try { file.delete(); }
        catch { throw new Error("Backup was not completed. Remove the incomplete new backup file from the selected folder."); }
      }
      if (isCancellation(error)) return undefined;
      if (error instanceof Error && error.message.startsWith("Invalid CogVest backup:")) {
        throw new Error("Some saved records need review before CogVest can create a restorable backup. Your data is unchanged.");
      }
      throw new Error(error instanceof Error && /portfolio changed|back it up|recovery/iu.test(error.message)
        ? error.message : "Backup could not be saved. Check folder access and free space, then try again.");
    }
  }

  async function selectPortfolioBackup(signal?: AbortSignal): Promise<PreparedRestore | undefined> {
    const epoch = runtime.store.getState().restoreEpoch;
    try {
      assertActive(signal, epoch);
      runtime.store.getState().getBackupRevision();
      const file = await runtime.selectFile();
      assertActive(signal, epoch);
      if (!file) return undefined;
      if (!Number.isFinite(file.size) || file.size <= 0 || file.size > backupMaxBytes) {
        throw new Error("This file is empty, unreadable, or exceeds the backup size limit.");
      }
      const decoded = await parsePortfolioBackup(await file.text(), runtime.digest);
      assertActive(signal, epoch);
      const current = runtime.store.getState();
      const revision = current.getBackupRevision();
      const result: PreparedRestore = {
        review: {
          createdAt: decoded.createdAt,
          appVersion: decoded.appVersion,
          counts: countCollections.map(([key, label]) => ({
            label, current: current[key].length,
            backup: decoded.payload.portfolio[key].length,
          })),
        },
      };
      prepared.set(result, { payload: decoded.payload, revision, epoch: current.restoreEpoch });
      return result;
    } catch (error) {
      if (isCancellation(error)) return undefined;
      // Never surface provider URIs or financial record fragments in error messages.
      throw new Error("This backup could not be read or validated. Choose an intact, supported CogVest backup. Your portfolio has not changed.");
    }
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
    runtime.onRestored();
  }

  return { exportPortfolioBackup, selectPortfolioBackup, restorePortfolioBackup };
}

let service: ReturnType<typeof createBackupService> | undefined;
function getService() {
  service ??= createBackupService({
    store: getPortfolioStore(),
    digest: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
    now: () => new Date(),
    appVersion: Constants.expoConfig?.version ?? "unknown",
    uniqueId: Crypto.randomUUID,
    selectFile: async () => {
      const result = await File.pickFileAsync(undefined, "*/*");
      const file = Array.isArray(result) ? result[0] : result;
      return file ? { size: file.size, text: () => readBoundedBackupFile(file.uri) } : undefined;
    },
    selectDirectory: async () => {
      const directory = await Directory.pickDirectoryAsync();
      return {
        createFile: (name: string, mime: string) => {
          const file = directory.createFile(name, mime);
          return {
            write: (text: string) => file.write(text),
            text: () => readBoundedBackupFile(file.uri),
            delete: () => file.delete(),
          };
        },
      };
    },
    onRestored: resetQuickSetupSessionAfterRestore,
  });
  return service;
}

export const exportPortfolioBackup = (signal?: AbortSignal) => getService().exportPortfolioBackup(signal);
export const selectPortfolioBackup = (signal?: AbortSignal) => getService().selectPortfolioBackup(signal);
export const restorePortfolioBackup = (review: PreparedRestore, signal?: AbortSignal) => getService().restorePortfolioBackup(review, signal);
