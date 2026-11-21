import { createHash } from "crypto";
import { createBackupService, type LockedRestore, type PreparedRestore } from "../index";
import { createPortfolioStore, portfolioStorageKey, quoteCacheStorageKey } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioBackup, parsePortfolioBackup, backupMaxBytes } from "@/src/domain/portfolioBackup";
import { encodeBase64, encryptedBackupMaxBytes, isEncryptedBackupText, type EncryptedBackupDeps } from "@/src/domain/encryptedBackup";
import { nodeEncryptedBackupDeps } from "@/src/testing/encryptedBackupTestDeps";

jest.mock("expo-file-system", () => ({ Directory: {}, File: {} }));

const digest = async (text: string) => createHash("sha256").update(text).digest("hex");

function ready(result: PreparedRestore | LockedRestore | undefined): PreparedRestore {
  if (!result || !("review" in result)) throw new Error("Expected an ordinary backup review.");
  return result;
}
const now = () => new Date("2026-09-10T10:00:00.000Z");
const meta = { appVersion: "1.0.1", createdAt: now().toISOString() };

function harness() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addCashEntry({ id: "cash", type: "addition", purpose: "capitalContribution", label: "Synthetic cash", date: "2026-01-01", amount: 100 });
  let written = "";
  const file = { write: jest.fn(async (text: string) => { written = text; }), text: jest.fn(async () => written), delete: jest.fn() };
  const runtime = {
    store, digest, now, appVersion: "1.0.1", uniqueId: () => "unique",
    selectFile: jest.fn(async (): Promise<{ size: number; text: () => Promise<string> } | undefined> => ({ size: 1000, text: file.text })),
    selectDirectory: jest.fn(async (): Promise<{ createFile: (name: string, mime: string) => typeof file } | undefined> => ({ createFile: jest.fn(() => file) })),
    onRestored: jest.fn(),
  };
  return { store, runtime, file, service: createBackupService(runtime), storage };
}

describe("backup file service", () => {
  it("previews EPF account and audit counts without changing data before restore", async () => {
    const { service, store, file } = harness();
    store.getState().applyEpfCommand({ commandId: "epf-setup", reason: "Statement", change: {
      type: "accountPut", account: { id: "epf", nickname: "EPF", provider: "employerTrust", status: "active", currency: "INR",
        checkpoint: { date: "2026-01-01", balance: { total: 1000, components: null }, capital: null,
          source: "trustStatement", recordedAt: "2026-01-02T00:00:00Z" }, historyCompleteThrough: null },
    } }, store.getState().getBackupRevision());
    const saved = store.getState().captureBackup().payload;
    await file.write(await createPortfolioBackup(saved, meta, digest));
    store.getState().applyEpfCommand({ commandId: "epf-delete", reason: "Remove test account", change: { type: "accountRemove", id: "epf" } }, store.getState().getBackupRevision());
    const before = store.getState();
    const prepared = ready(await service.selectPortfolioBackup());
    expect(prepared.review.counts).toEqual(expect.arrayContaining([
      { label: "EPF accounts", current: 0, backup: 1 }, { label: "EPF edit history", current: 2, backup: 1 },
    ]));
    expect(store.getState()).toBe(before);
    await service.restorePortfolioBackup(prepared);
    expect(store.getState().epf).toEqual(saved.portfolio.epf);
  });
  it("keeps a move settled as a claim through backup, restore and a reload (#735)", async () => {
    const { service, store, file, storage } = harness();
    const epfAccount = (id: string, total: number) => ({ id, nickname: id, provider: "epfo" as const, status: "active" as const,
      currency: "INR" as const, historyCompleteThrough: null,
      checkpoint: { date: "2026-01-01", balance: { total, components: null }, capital: null,
        source: "epfoStatement" as const, recordedAt: "2026-01-02T00:00:00Z" } });
    for (const account of [epfAccount("old", 1000), epfAccount("new", 0)]) {
      store.getState().applyEpfCommand({ commandId: `put-${account.id}`, reason: "Statement", change: { type: "accountPut", account } },
        store.getState().getBackupRevision());
    }
    const outcome = store.getState().applyEpfCommand({ commandId: "claim", reason: "Add EPF entry", change: { type: "eventPut", cash: null, event: {
      id: "claim", type: "claimTransfer", recordedAt: "2026-09-10T00:00:00Z", evidence: "EPFO passbook",
      effectiveDate: "2026-03-05", postedDate: "2026-03-05", sourceId: "old", destinationId: "new",
      payout: { total: 1050, components: null }, interest: { total: 50, components: null }, status: "completed",
      credits: [{ date: "2026-02-10", postedDate: "2026-02-10", amount: { total: 1000, components: null } },
        { date: "2026-04-20", postedDate: "2026-04-20", amount: { total: 50, components: null } }],
    } } }, store.getState().getBackupRevision());
    expect(outcome).toBe("applied");
    const saved = store.getState().captureBackup().payload;
    await file.write(await createPortfolioBackup(saved, meta, digest));
    store.getState().applyEpfCommand({ commandId: "remove-claim", reason: "Remove", change: { type: "eventRemove", id: "claim" } },
      store.getState().getBackupRevision());
    await service.restorePortfolioBackup(ready(await service.selectPortfolioBackup()));
    expect(store.getState().epf.events).toEqual(saved.portfolio.epf.events);
    const reloaded = createPortfolioStore({ storage, now });
    expect(reloaded.getState().epf.events).toEqual([expect.objectContaining({ id: "claim", type: "claimTransfer", status: "completed" })]);
  });
  it("names the record that blocks a restorable backup", async () => {
    const { service, store, file } = harness();
    store.setState({ monthlySnapshots: [{ id: "snapshot-2025-10", month: "2025-10", cashValue: 100, cryptoValue: 0, debtValue: 0,
      equityValue: 1000, investedValue: 1000, monthlyInvestment: 0, portfolioValue: 1200 }] });
    await expect(service.exportPortfolioBackup()).rejects.toThrow("CogVest can't create a restorable backup yet: the 2025-10 month-end " +
      "snapshot needs correction in Progress: Portfolio value must equal Equity + Debt + Crypto + Cash. Your data is unchanged.");
    expect(file.write).not.toHaveBeenCalled();
  });

  it("exports a verified file without changing the portfolio", async () => {
    const { service, store, file } = harness();
    const original = store.getState().captureBackup();
    expect(await service.exportPortfolioBackup()).toBe("CogVest-backup-2026-09-10-unique.json");
    expect((await parsePortfolioBackup(await file.text(), digest)).payload).toEqual(original.payload);
    expect(store.getState().captureBackup()).toEqual(original);
    expect(file.delete).not.toHaveBeenCalled();
  });

  it("previews, preserves current data before confirmation, then replaces exactly once", async () => {
    const { service, store, file, runtime } = harness();
    const exported = store.getState().captureBackup();
    await file.write(await createPortfolioBackup(exported.payload, meta, digest));
    store.getState().addCashEntry({ id: "extra", type: "addition", purpose: "capitalContribution", label: "Other", date: "2026-01-02", amount: 200 });
    const prepared = ready(await service.selectPortfolioBackup());
    expect(prepared.review.counts.find((count) => count.label === "Cash entries")).toEqual({ label: "Cash entries", current: 2, backup: 1 });
    expect(prepared.review.counts.find((count) => count.label === "Futures accounts")).toEqual({ label: "Futures accounts", current: 0, backup: 0 });
    expect(store.getState().cashEntries).toHaveLength(2);
    expect(runtime.onRestored).not.toHaveBeenCalled();
    await service.restorePortfolioBackup(prepared);
    expect(store.getState().cashEntries).toEqual(exported.payload.portfolio.cashEntries);
    expect(runtime.onRestored).toHaveBeenCalledTimes(1);
    await expect(service.restorePortfolioBackup(prepared)).rejects.toThrow("Select the backup again");
  });

  it("does not trust a forged review token or accept changes after preview", async () => {
    const { service, store, file } = harness();
    await file.write(await createPortfolioBackup(store.getState().captureBackup().payload, meta, digest));
    const prepared = ready(await service.selectPortfolioBackup());
    await expect(service.restorePortfolioBackup({ ...prepared })).rejects.toThrow("Select the backup again");
    store.getState().updatePreferences({ displayMode: "minimal" });
    await expect(service.restorePortfolioBackup(prepared)).rejects.toThrow("portfolio changed");
    expect(store.getState().preferences.displayMode).toBe("minimal");
  });

  it("can replace a destination that cannot itself be exported", async () => {
    const { service, store, file } = harness();
    const original = store.getState().captureBackup().payload;
    await file.write(await createPortfolioBackup(original, meta, digest));
    store.setState({ cashEntries: [...store.getState().cashEntries, {
      id: "inconsistent", type: "addition", purpose: "saleProceeds", linkedTradeId: "missing",
      label: "Inconsistent legacy entry", date: "2026-01-02", amount: 200,
    }] });
    expect(() => store.getState().captureBackup()).toThrow();
    const prepared = ready(await service.selectPortfolioBackup());
    expect(store.getState().cashEntries).toHaveLength(2);
    await service.restorePortfolioBackup(prepared);
    expect(store.getState().captureBackup().payload).toEqual(original);
  });

  it("treats picker cancellation as no action", async () => {
    const { runtime, service, file, store } = harness();
    const original = store.getState().captureBackup();
    runtime.selectDirectory.mockResolvedValue(undefined);
    runtime.selectFile.mockRejectedValue(new Error("User canceled"));
    expect(await service.exportPortfolioBackup()).toBeUndefined();
    expect(await service.selectPortfolioBackup()).toBeUndefined();
    expect(file.write).not.toHaveBeenCalled();
    expect(store.getState().captureBackup()).toEqual(original);
  });

  it("stops before writing if screen closes while picking a location", async () => {
    const { runtime, file, service } = harness();
    const controller = new AbortController();
    runtime.selectDirectory.mockImplementation(async () => {
      controller.abort();
      return { createFile: () => file };
    });
    expect(await service.exportPortfolioBackup(controller.signal)).toBeUndefined();
    expect(file.write).not.toHaveBeenCalled();
  });

  it("does not save stale data when live records change during hashing", async () => {
    const { runtime, file, store } = harness();
    const service = createBackupService({ ...runtime, digest: async (text) => {
      store.getState().updatePreferences({ displayMode: "minimal" });
      return digest(text);
    } });
    await expect(service.exportPortfolioBackup()).rejects.toThrow("portfolio changed");
    expect(file.write).not.toHaveBeenCalled();
  });

  it("removes only its newly created incomplete file after verification fails", async () => {
    const { service, file, store } = harness();
    file.text.mockResolvedValue("truncated");
    const original = store.getState().captureBackup();
    await expect(service.exportPortfolioBackup()).rejects.toThrow("could not be saved");
    expect(file.delete).toHaveBeenCalledTimes(1);
    expect(store.getState().captureBackup()).toEqual(original);
  });

  it("reports incomplete-file cleanup failure", async () => {
    const { service, file } = harness();
    file.write.mockRejectedValue(new Error("Full"));
    file.delete.mockImplementation(() => { throw new Error("Access revoked"); });
    await expect(service.exportPortfolioBackup()).rejects.toThrow("Remove the incomplete new backup file");
  });

  it("verifies the file only after an asynchronous write settles", async () => {
    const { service, file } = harness();
    const write = file.write.getMockImplementation()!;
    let finish!: () => void;
    file.write.mockImplementation((text: string) => new Promise<void>((resolve) => {
      finish = () => { void write(text).then(resolve); };
    }));
    const exported = service.exportPortfolioBackup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(file.write).toHaveBeenCalledTimes(1);
    expect(file.text).not.toHaveBeenCalled();
    finish();
    expect(await exported).toBe("CogVest-backup-2026-09-10-unique.json");
    expect(file.text).toHaveBeenCalledTimes(1);
    expect(file.delete).not.toHaveBeenCalled();
  });

  it("deletes the new file and reports failure when the asynchronous write rejects", async () => {
    const { service, file } = harness();
    file.write.mockRejectedValue(new Error("No space left on device"));
    await expect(service.exportPortfolioBackup()).rejects.toThrow("Backup could not be saved");
    expect(file.text).not.toHaveBeenCalled();
    expect(file.delete).toHaveBeenCalledTimes(1);
  });

  it("removes the newly written file if canceled while readback is pending", async () => {
    const { service, file } = harness();
    const controller = new AbortController();
    const read = file.text.getMockImplementation()!;
    file.text.mockImplementation(async () => { controller.abort(); return read(); });
    expect(await service.exportPortfolioBackup(controller.signal)).toBeUndefined();
    expect(file.write).toHaveBeenCalledTimes(1);
    expect(file.delete).toHaveBeenCalledTimes(1);
  });

  it("checks size before reading and rejects unsupported or corrupt files without mutation", async () => {
    const { service, runtime, store } = harness();
    const read = jest.fn(async () => "bad");
    runtime.selectFile.mockResolvedValue({ size: encryptedBackupMaxBytes + 1, text: read });
    const original = store.getState().captureBackup();
    await expect(service.selectPortfolioBackup()).rejects.toThrow("could not be read or validated");
    expect(read).not.toHaveBeenCalled();
    runtime.selectFile.mockResolvedValue({ size: 3, text: read });
    await expect(service.selectPortfolioBackup()).rejects.toThrow("could not be read or validated");
    expect(store.getState().captureBackup()).toEqual(original);
  });

  it("a canceled confirmation cannot mutate current data", async () => {
    const { service, store, file } = harness();
    await file.write(await createPortfolioBackup(store.getState().captureBackup().payload, meta, digest));
    const prepared = ready(await service.selectPortfolioBackup());
    const controller = new AbortController();
    controller.abort();
    const original = store.getState().captureBackup();
    await expect(service.restorePortfolioBackup(prepared, controller.signal)).rejects.toThrow("canceled");
    expect(store.getState().captureBackup()).toEqual(original);
  });

  it("lists payout counts in the preview when either side has payouts (#671)", async () => {
    const { service, store, file } = harness();
    await file.write(await createPortfolioBackup(store.getState().captureBackup().payload, meta, digest));
    store.setState({ distributions: [{
      assetId: "synthetic-asset", grossAmount: 10, id: "payout", paidOn: "2026-03-01",
      recordedAt: "2026-03-02T00:00:00.000Z", taxWithheld: 0, treatment: "paidToCash",
    }] });

    const prepared = ready(await service.selectPortfolioBackup());

    expect(prepared.review.counts).toContainEqual({ label: "Dividends and payouts", current: 1, backup: 0 });
    expect(prepared.review.counts.map((count) => count.label)).not.toContain("Payout confirmations");
  });

  it("passes a recovery instruction through, and replaces any other restore failure with a safe message (#671)", async () => {
    const { service, store, file, runtime } = harness();
    await file.write(await createPortfolioBackup(store.getState().captureBackup().payload, meta, digest));

    const recovery = ready(await service.selectPortfolioBackup());
    const replace = jest.spyOn(store.getState(), "replaceFromBackup");
    replace.mockImplementationOnce(() => { throw new Error("Restart CogVest to finish local data recovery before continuing."); });
    await expect(service.restorePortfolioBackup(recovery)).rejects.toThrow("Restart CogVest to finish local data recovery");

    const other = ready(await service.selectPortfolioBackup());
    replace.mockImplementationOnce(() => { throw new Error("content://provider/secret/123 write failed"); });
    await expect(service.restorePortfolioBackup(other)).rejects.toThrow(
      "Restore did not finish. Restart CogVest if local data recovery is required, then select the backup again.");
    expect(runtime.onRestored).not.toHaveBeenCalled();
  });
});

describe("recovery copy export (#654)", () => {
  function recoveringHarness() {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(portfolioStorageKey, "{unreadable-portfolio");
    storage.setRawItem(quoteCacheStorageKey, "[unreadable-quotes]");
    const store = createPortfolioStore({ storage, now });
    const files = new Map<string, { contents: string; deleted: boolean }>();
    const createFile = jest.fn((name: string) => {
      const entry = { contents: "", deleted: false };
      files.set(name, entry);
      return {
        write: jest.fn(async (text: string) => { entry.contents = text; }),
        text: jest.fn(async () => entry.contents),
        delete: jest.fn(() => { entry.deleted = true; }),
      };
    });
    const runtime = {
      store, digest, now, appVersion: "1.0.1", uniqueId: () => "unique", selectFile: jest.fn(),
      selectDirectory: jest.fn(async (): Promise<{ createFile: typeof createFile } | undefined> => ({ createFile })),
      onRestored: jest.fn(),
    };
    return { store, files, createFile, runtime, service: createBackupService(runtime) };
  }

  it("saves each kept copy exactly as stored, named by area and time, while recovery is open", async () => {
    const { store, files, service } = recoveringHarness();
    expect(store.getState().storageRecovery?.incidents).toHaveLength(2);

    const names = await service.exportRecoveryCopies();

    expect(names).toEqual([
      "CogVest-recovery-cogvest-v1-portfolio-2026-09-10T10-00-00-000Z.txt",
      "CogVest-recovery-cogvest-v1-quote-cache-2026-09-10T10-00-00-000Z.txt",
    ]);
    expect([...files.values()].map((file) => file.contents)).toEqual(["{unreadable-portfolio", "[unreadable-quotes]"]);
    expect(store.getState().storageRecovery?.incidents).toHaveLength(2);
  });

  it("marks a copy saved by an earlier version as legacy in its file name", async () => {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(`cogvest:recovery:${quoteCacheStorageKey}`, "[old-quotes]");
    storage.setRawItem(portfolioStorageKey, "{unreadable-portfolio");
    const store = createPortfolioStore({ storage, now });
    const contents: string[] = [];
    const service = createBackupService({
      store, digest, now, appVersion: "1.0.1", uniqueId: () => "unique", selectFile: jest.fn(), onRestored: jest.fn(),
      selectDirectory: async () => ({ createFile: () => {
        let written = "";
        return { write: async (text: string) => { written = text; contents.push(text); }, text: async () => written, delete: () => undefined };
      } }),
    });

    await expect(service.exportRecoveryCopies()).resolves.toEqual([
      "CogVest-recovery-cogvest-v1-portfolio-2026-09-10T10-00-00-000Z.txt",
      "CogVest-recovery-legacy-cogvest-v1-quote-cache-undated.txt",
    ]);
    expect(contents).toEqual(["{unreadable-portfolio", "[old-quotes]"]);
  });

  it("treats a cancelled folder picker as no action", async () => {
    const { createFile, runtime, service } = recoveringHarness();
    runtime.selectDirectory.mockResolvedValue(undefined);

    await expect(service.exportRecoveryCopies()).resolves.toBeUndefined();
    expect(createFile).not.toHaveBeenCalled();
  });

  it("removes the files it created when a write fails", async () => {
    const { files, createFile, service } = recoveringHarness();
    createFile.mockImplementationOnce((name: string) => {
      files.set(name, { contents: "", deleted: false });
      return { write: jest.fn(async (_text: string) => { throw new Error("disk full"); }), text: jest.fn(async () => ""),
        delete: jest.fn(() => { files.get(name)!.deleted = true; }) };
    });

    await expect(service.exportRecoveryCopies()).rejects.toThrow("Recovery copies could not be saved.");
    expect([...files.values()].every((file) => file.deleted)).toBe(true);
  });

  it("refuses when no copy was kept", async () => {
    const { service } = harness();
    await expect(service.exportRecoveryCopies()).rejects.toThrow("No recovery copy is available to export.");
  });
});
describe("passphrase-protected backups (#760)", () => {
  // Real scrypt and AES-GCM; the lowest accepted cost keeps the suite fast.
  const encryption: EncryptedBackupDeps = {
    ...nodeEncryptedBackupDeps,
    kdf: (passphrase, salt, params) => nodeEncryptedBackupDeps.kdf(passphrase, salt, { ...params, logN: 15 }),
  };
  const passphrase = "orbit lantern basil 42";

  function protectedHarness() {
    const base = harness();
    const created: string[] = [];
    base.runtime.selectDirectory.mockImplementation(async () => ({
      createFile: jest.fn((name: string) => { created.push(name); return base.file; }),
    }));
    return { ...base, created, service: createBackupService({ ...base.runtime, encryption }) };
  }

  it("saves a file that hides the portfolio and restores it with the passphrase", async () => {
    const { service, store, file, created } = protectedHarness();
    const saved = store.getState().captureBackup().payload;
    const name = await service.exportPortfolioBackup(undefined, { passphrase });
    expect(name).toBe("CogVest-backup-2026-09-10-unique-protected.json");
    expect(created).toEqual([name]);
    const contents = await file.text();
    expect(isEncryptedBackupText(contents)).toBe(true);
    expect(contents).not.toContain("Synthetic cash");
    expect(contents).not.toContain("capitalContribution");

    store.getState().addCashEntry({ id: "later", type: "addition", purpose: "capitalContribution", label: "Later cash", date: "2026-02-01", amount: 50 });
    const handle = await service.selectPortfolioBackup();
    expect(handle).toEqual({ locked: true });
    const before = store.getState();
    await expect(service.unlockPortfolioBackup(handle as { locked: true }, "orbit lantern basil 43"))
      .rejects.toThrow("The passphrase is wrong, or the file has been changed. Your portfolio has not changed.");
    expect(store.getState()).toBe(before);

    const prepared = await service.unlockPortfolioBackup(handle as { locked: true }, passphrase);
    expect(prepared.review.counts).toContainEqual({ label: "Cash entries", current: 2, backup: 1 });
    expect(store.getState()).toBe(before);
    await expect(service.unlockPortfolioBackup(handle as { locked: true }, passphrase)).rejects.toThrow("Select the backup again");
    await service.restorePortfolioBackup(prepared);
    expect(store.getState().cashEntries).toEqual(saved.portfolio.cashEntries);
  });

  it("keeps an ordinary backup readable without a passphrase", async () => {
    const { service, file } = protectedHarness();
    await service.exportPortfolioBackup();
    expect(isEncryptedBackupText(await file.text())).toBe(false);
    expect(ready(await service.selectPortfolioBackup()).review.counts).toContainEqual({ label: "Cash entries", current: 1, backup: 1 });
  });

  it("rejects a changed protected file and leaves the portfolio alone", async () => {
    const { service, store, file } = protectedHarness();
    await service.exportPortfolioBackup(undefined, { passphrase });
    const raw = JSON.parse(await file.text());
    const bytes = Uint8Array.from(atob(raw.ciphertext), (character) => character.charCodeAt(0));
    bytes[5] ^= 1;
    await file.write(JSON.stringify({ ...raw, ciphertext: encodeBase64(bytes) }));
    const before = store.getState();
    const handle = (await service.selectPortfolioBackup()) as { locked: true };
    await expect(service.unlockPortfolioBackup(handle, passphrase)).rejects.toThrow("The passphrase is wrong, or the file has been changed.");
    expect(store.getState()).toBe(before);
  });

  it("reports a damaged protected file before asking for its passphrase", async () => {
    const { service, file } = protectedHarness();
    await service.exportPortfolioBackup(undefined, { passphrase });
    const raw = JSON.parse(await file.text());
    await file.write(JSON.stringify({ ...raw, kdf: { ...raw.kdf, logN: 30 } }));
    await expect(service.selectPortfolioBackup()).rejects.toThrow("This backup could not be read or validated.");
  });

  it("asks for the file again when the portfolio changes before unlocking", async () => {
    const { service, store } = protectedHarness();
    await service.exportPortfolioBackup(undefined, { passphrase });
    const handle = (await service.selectPortfolioBackup()) as { locked: true };
    const prepared = await service.unlockPortfolioBackup(handle, passphrase);
    store.getState().addCashEntry({ id: "later", type: "addition", purpose: "capitalContribution", label: "Later cash", date: "2026-02-01", amount: 50 });
    await expect(service.restorePortfolioBackup(prepared)).rejects.toThrow("portfolio changed");
  });

  it("refuses a protected export when encryption is unavailable, without creating a file", async () => {
    const { service, runtime } = harness();
    await expect(service.exportPortfolioBackup(undefined, { passphrase })).rejects.toThrow("Backup could not be saved.");
    expect(runtime.selectDirectory).not.toHaveBeenCalled();
  });

  it("reads a protected file larger than the ordinary limit only up to the protected limit", async () => {
    const { service, runtime } = protectedHarness();
    const read = jest.fn(async () => "bad");
    runtime.selectFile.mockResolvedValue({ size: backupMaxBytes + 1, text: read });
    await expect(service.selectPortfolioBackup()).rejects.toThrow("could not be read or validated");
    expect(read).toHaveBeenCalled();
  });
});

