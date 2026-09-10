import { createMemoryJsonStorage, type JsonStorage } from "@/src/services/storage";
import { backupRestoreKeys, backupRestoreJournalKey } from "@/src/services/storage/backupKeys";
import { captureBackupStorage, commitBackupRestore, recoverBackupRestore, type BackupStorageImage } from "../backupPersistence";

function fixture() {
  const storage = createMemoryJsonStorage();
  for (const key of backupRestoreKeys) storage.setRawItem(key, `old:${key}`);
  const original = captureBackupStorage(storage);
  const next = Object.fromEntries(backupRestoreKeys.map((key, i) => [key, i === 4 ? null : `new:${key}`])) as BackupStorageImage;
  return { storage, original, next };
}

describe("all-key backup replacement journal", () => {
  it("commits all five keys, clears transient setup, and finishes the journal", () => {
    const { storage, next } = fixture();
    commitBackupRestore(storage, next);
    expect(captureBackupStorage(storage)).toEqual(next);
    expect(storage.getRawItem(backupRestoreJournalKey)).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7])("retains original after a one-off write failure at operation %i", (at) => {
    const { storage, original, next } = fixture();
    let operation = 0;
    const write = (fn: () => void) => {
      if (++operation === at) throw new Error("Storage full");
      fn();
    };
    const failing: JsonStorage = {
      ...storage,
      setRawItem: (key, value) => write(() => storage.setRawItem(key, value)),
      removeItem: (key) => write(() => storage.removeItem(key)),
    };
    expect(() => commitBackupRestore(failing, next)).toThrow("Storage full");
    expect(captureBackupStorage(storage)).toEqual(original);
    expect(storage.getRawItem(backupRestoreJournalKey)).toBeNull();
  });

  it.each([2, 3, 4, 5, 6, 7])("replays original on restart after persistent failure at operation %i", (at) => {
    const { storage, original, next } = fixture();
    let operation = 0;
    const write = (fn: () => void) => {
      if (++operation >= at) throw new Error("Persistent storage failure");
      fn();
    };
    const failing: JsonStorage = {
      ...storage,
      setRawItem: (key, value) => write(() => storage.setRawItem(key, value)),
      removeItem: (key) => write(() => storage.removeItem(key)),
    };
    expect(() => commitBackupRestore(failing, next)).toThrow();
    expect(storage.getRawItem(backupRestoreJournalKey)).not.toBeNull();
    recoverBackupRestore(storage);
    expect(captureBackupStorage(storage)).toEqual(original);
    expect(storage.getRawItem(backupRestoreJournalKey)).toBeNull();
  });

  it.each([0, 1, 2, 3, 4, 5])("recovers a process killed after %i replacement writes", (count) => {
    const { storage, original, next } = fixture();
    storage.setRawItem(backupRestoreJournalKey, JSON.stringify({ version: 1, original }));
    for (const key of backupRestoreKeys.slice(0, count)) {
      if (next[key] === null) storage.removeItem(key);
      else storage.setRawItem(key, next[key]!);
    }
    recoverBackupRestore(storage);
    expect(captureBackupStorage(storage)).toEqual(original);
  });

  it("does not accept arbitrary destination keys in a corrupted journal", () => {
    const { storage, original } = fixture();
    storage.setRawItem(backupRestoreJournalKey, JSON.stringify({ version: 1, original: { ...original, arbitrary: "value" } }));
    expect(() => recoverBackupRestore(storage)).toThrow("Invalid restore journal");
    expect(captureBackupStorage(storage)).toEqual(original);
    expect(storage.getRawItem(backupRestoreJournalKey)).not.toBeNull();
  });

  it("requires a readable journal before changing data", () => {
    const { storage, original, next } = fixture();
    const dropping: JsonStorage = { ...storage, setRawItem: () => undefined };
    expect(() => commitBackupRestore(dropping, next)).toThrow("confirm the write");
    expect(captureBackupStorage(storage)).toEqual(original);
  });

  it("detects a silently dropped replacement write and rolls back", () => {
    const { storage, original, next } = fixture();
    let dropped = false;
    const dropping: JsonStorage = {
      ...storage,
      setRawItem: (key, value) => {
        if (key === backupRestoreKeys[1] && !dropped) { dropped = true; return; }
        storage.setRawItem(key, value);
      },
    };
    expect(() => commitBackupRestore(dropping, next)).toThrow("confirm the write");
    expect(captureBackupStorage(storage)).toEqual(original);
  });

  it("recognizes verified commit when final deletion succeeded but its first readback failed", () => {
    const { storage, next } = fixture();
    let finalReadFails = false;
    let removed = false;
    const unusual: JsonStorage = {
      ...storage,
      removeItem: (key) => {
        storage.removeItem(key);
        if (key === backupRestoreJournalKey) { removed = true; finalReadFails = true; }
      },
      getRawItem: (key) => {
        if (key === backupRestoreJournalKey && finalReadFails) {
          finalReadFails = false;
          throw new Error("Readback failed");
        }
        return storage.getRawItem(key);
      },
      setRawItem: (key, value) => {
        if (removed) throw new Error("Journal cannot be recreated");
        storage.setRawItem(key, value);
      },
    };
    expect(() => commitBackupRestore(unusual, next)).not.toThrow();
    expect(captureBackupStorage(storage)).toEqual(next);
    expect(storage.getRawItem(backupRestoreJournalKey)).toBeNull();
  });

  it("requires recovery if the commit outcome remains unreadable, without starting an unjournaled rollback", () => {
    const { storage, next } = fixture();
    let removed = false;
    const unreadable: JsonStorage = {
      ...storage,
      removeItem: (key) => { storage.removeItem(key); if (key === backupRestoreJournalKey) removed = true; },
      getRawItem: (key) => { if (removed) throw new Error("Read failure"); return storage.getRawItem(key); },
    };
    expect(() => commitBackupRestore(unreadable, next)).toThrow("Restart CogVest");
    expect(captureBackupStorage(storage)).toEqual(next);
  });
});
