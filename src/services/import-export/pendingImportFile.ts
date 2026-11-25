import type { ImportFileRef } from "./importFileProbe";

/**
 * The one file waiting to be handed to an import screen (#771): shared from
 * another app or chosen under "Import a file". It lives only in memory, holds
 * a URI and never the contents, and is taken once by the screen that reads it.
 */

let pending: ImportFileRef | null = null;
const listeners = new Set<() => void>();

export function setPendingImportFile(file: ImportFileRef | null) {
  pending = file;
  for (const listener of listeners) listener();
}

export function peekPendingImportFile() {
  return pending;
}

/** Hands the file to one reader and clears it, so it is never imported twice. */
export function takePendingImportFile() {
  const file = pending;
  pending = null;
  return file;
}

export function subscribePendingImportFile(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * A picker for an import screen that returns the pending file first, once,
 * then falls back to the system picker.
 */
export function withPendingFile<T>(
  read: (file: ImportFileRef) => Promise<T>,
  pick: () => Promise<T | undefined>,
): () => Promise<T | undefined> {
  return async () => {
    const file = takePendingImportFile();
    return file ? read(file) : pick();
  };
}
