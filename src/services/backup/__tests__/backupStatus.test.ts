import { createHash } from "crypto";

import { backupReminder, portfolioFingerprint, portfolioRecordCount } from "@/src/domain/backupReminder";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { backupRestoreJournalKey, backupStatusStorageKey } from "@/src/services/storage/backupKeys";
import { createPortfolioStore, selectRawSnapshot } from "@/src/store";

import { createBackupStatusStore } from "../backupStatus";
import { createBackupService, type LockedRestore, type PreparedRestore } from "../index";

jest.mock("expo-file-system", () => ({ Directory: {}, File: {} }));

const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
let clock = new Date("2026-03-01T10:00:00.000Z");
const now = () => clock;

function harness() {
  clock = new Date("2026-03-01T10:00:00.000Z");
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addCashEntry({
    id: "cash-1", type: "addition", purpose: "capitalContribution", label: "Synthetic cash", date: "2026-01-01", amount: 100,
  });
  const statusStore = createBackupStatusStore({ storage, now });
  let written = "";
  const file = { write: jest.fn(async (text: string) => { written = text; }), text: jest.fn(async () => written), delete: jest.fn() };
  const onExported = jest.fn((portfolio) => statusStore.getState().recordExport(portfolio));
  const service = createBackupService({
    store, digest, now, appVersion: "1.0.1", uniqueId: () => "unique",
    selectFile: async () => ({ size: written.length, text: async () => written }),
    selectDirectory: async () => ({ createFile: () => file }),
    onExported,
  });
  const reminder = () => {
    const snapshot = selectRawSnapshot(store.getState());
    return backupReminder({
      fingerprint: portfolioFingerprint(snapshot), minimalMode: false, now: clock,
      recordCount: portfolioRecordCount(snapshot), status: statusStore.getState().status,
    });
  };
  return { file, onExported, reminder, service, statusStore, storage, store };
}

describe("backup status record (#759)", () => {
  it("starts the reminder clock on first use and saves it", () => {
    const { storage, statusStore } = harness();
    expect(statusStore.getState().status).toEqual({ reminderDays: 30, trackingSince: "2026-03-01T10:00:00.000Z" });
    expect(JSON.parse(storage.getRawItem(backupStatusStorageKey) ?? "{}")).toMatchObject({ version: 1, reminderDays: 30 });
  });

  it("records a finished export with the live portfolio, and keeps it across a restart", async () => {
    const { service, statusStore, storage, store, onExported } = harness();
    await expect(service.exportPortfolioBackup()).resolves.toMatch(/^CogVest-backup-/u);
    expect(onExported).toHaveBeenCalledTimes(1);
    const status = statusStore.getState().status;
    expect(status.lastBackupAt).toBe("2026-03-01T10:00:00.000Z");
    expect(status.fingerprintAtBackup).toBe(portfolioFingerprint(selectRawSnapshot(store.getState())));
    expect(status.recordCountAtBackup).toBe(1);

    clock = new Date("2026-06-01T10:00:00.000Z");
    expect(createBackupStatusStore({ storage, now }).getState().status).toEqual(status);
  });

  it("does not record an export that failed verification", async () => {
    const { file, service, statusStore } = harness();
    file.text.mockResolvedValueOnce("changed on disk");
    await expect(service.exportPortfolioBackup()).rejects.toThrow("Backup could not be saved.");
    expect(statusStore.getState().status.lastBackupAt).toBeUndefined();
  });

  it("still reports a saved backup when the reminder record cannot be written", async () => {
    const { onExported, service } = harness();
    onExported.mockImplementationOnce(() => { throw new Error("storage full"); });
    await expect(service.exportPortfolioBackup()).resolves.toMatch(/^CogVest-backup-/u);
  });

  it("is not changed by a restore, which therefore never counts as a backup", async () => {
    const { reminder, service, statusStore, storage, store } = harness();
    await service.exportPortfolioBackup();
    const afterExport = statusStore.getState().status;
    expect(reminder()).toEqual({ due: false });

    // Restore the backup over a portfolio with an extra record.
    store.getState().addCashEntry({
      id: "cash-2", type: "addition", purpose: "capitalContribution", label: "Synthetic cash", date: "2026-02-01", amount: 50,
    });
    const prepared = await service.selectPortfolioBackup() as PreparedRestore | LockedRestore;
    await service.restorePortfolioBackup(prepared as PreparedRestore);
    expect(store.getState().cashEntries).toHaveLength(1);
    expect(storage.getRawItem(backupStatusStorageKey)).toBe(JSON.stringify({ version: 1, ...afterExport }));
    expect(createBackupStatusStore({ storage, now }).getState().status).toEqual(afterExport);

    // The restored records match the export, so nothing new needs a backup.
    clock = new Date("2026-05-01T10:00:00.000Z");
    expect(reminder()).toEqual({ due: false });
    // A change after the restore is due an interval after the last real export.
    store.getState().addCashEntry({
      id: "cash-3", type: "addition", purpose: "capitalContribution", label: "Synthetic cash", date: "2026-04-01", amount: 10,
    });
    expect(reminder()).toMatchObject({ due: true, reason: "days", daysSinceBackup: 61 });
  });

  it("changes the interval and clears a snooze", () => {
    const { statusStore } = harness();
    statusStore.getState().snooze();
    expect(statusStore.getState().status.snoozedUntil).toBe("2026-03-31T10:00:00.000Z");
    statusStore.getState().setReminderDays(7);
    expect(statusStore.getState().status).toEqual({ reminderDays: 7, trackingSince: "2026-03-01T10:00:00.000Z" });
  });

  it.each([
    ["not JSON", "{"],
    ["an unknown interval", JSON.stringify({ version: 1, trackingSince: "2026-01-01T00:00:00.000Z", reminderDays: 12 })],
    ["an unknown field", JSON.stringify({ version: 1, trackingSince: "2026-01-01T00:00:00.000Z", reminderDays: 30, extra: true })],
    ["a newer version", JSON.stringify({ version: 2, trackingSince: "2026-01-01T00:00:00.000Z", reminderDays: 30 })],
  ])("starts a new record when the saved one is %s", (_label, raw) => {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(backupStatusStorageKey, raw);
    expect(createBackupStatusStore({ storage, now }).getState().status)
      .toEqual({ reminderDays: 30, trackingSince: "2026-03-01T10:00:00.000Z" });
  });

  it("refuses to write while a restore is being recovered, and keeps the state unchanged", () => {
    const storage = createMemoryJsonStorage();
    const statusStore = createBackupStatusStore({ storage, now });
    storage.setRawItem(backupRestoreJournalKey, "{}");
    expect(() => statusStore.getState().setReminderDays(90)).toThrow("Restart CogVest");
    expect(statusStore.getState().status.reminderDays).toBe(30);
  });
});
