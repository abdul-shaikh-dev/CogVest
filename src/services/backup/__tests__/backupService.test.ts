import { createHash } from "crypto";
import { createBackupService } from "../index";
import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioBackup, parsePortfolioBackup, backupMaxBytes } from "@/src/domain/portfolioBackup";

jest.mock("expo-file-system", () => ({ Directory: {}, File: {} }));

const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
const now = () => new Date("2026-09-10T10:00:00.000Z");
const meta = { appVersion: "1.0.1", createdAt: now().toISOString() };

function harness() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addCashEntry({ id: "cash", type: "addition", purpose: "capitalContribution", label: "Synthetic cash", date: "2026-01-01", amount: 100 });
  let written = "";
  const file = { write: jest.fn((text: string) => { written = text; }), text: jest.fn(async () => written), delete: jest.fn() };
  const runtime = {
    store, digest, now, appVersion: "1.0.1", uniqueId: () => "unique",
    selectFile: jest.fn(async (): Promise<{ size: number; text: () => Promise<string> } | undefined> => ({ size: 1000, text: file.text })),
    selectDirectory: jest.fn(async (): Promise<{ createFile: (name: string, mime: string) => typeof file } | undefined> => ({ createFile: jest.fn(() => file) })),
    onRestored: jest.fn(),
  };
  return { store, runtime, file, service: createBackupService(runtime), storage };
}

describe("backup file service", () => {
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
    file.write(await createPortfolioBackup(exported.payload, meta, digest));
    store.getState().addCashEntry({ id: "extra", type: "addition", purpose: "income", label: "Other", date: "2026-01-02", amount: 200 });
    const prepared = (await service.selectPortfolioBackup())!;
    expect(prepared.review.counts.find((count) => count.label === "Cash entries")).toEqual({ label: "Cash entries", current: 2, backup: 1 });
    expect(store.getState().cashEntries).toHaveLength(2);
    expect(runtime.onRestored).not.toHaveBeenCalled();
    await service.restorePortfolioBackup(prepared);
    expect(store.getState().cashEntries).toEqual(exported.payload.portfolio.cashEntries);
    expect(runtime.onRestored).toHaveBeenCalledTimes(1);
    await expect(service.restorePortfolioBackup(prepared)).rejects.toThrow("Select the backup again");
  });

  it("does not trust a forged review token or accept changes after preview", async () => {
    const { service, store, file } = harness();
    file.write(await createPortfolioBackup(store.getState().captureBackup().payload, meta, digest));
    const prepared = (await service.selectPortfolioBackup())!;
    await expect(service.restorePortfolioBackup({ ...prepared })).rejects.toThrow("Select the backup again");
    store.getState().updatePreferences({ displayMode: "minimal" });
    await expect(service.restorePortfolioBackup(prepared)).rejects.toThrow("portfolio changed");
    expect(store.getState().preferences.displayMode).toBe("minimal");
  });

  it("can replace a destination that cannot itself be exported", async () => {
    const { service, store, file } = harness();
    const original = store.getState().captureBackup().payload;
    file.write(await createPortfolioBackup(original, meta, digest));
    store.setState({ cashEntries: [...store.getState().cashEntries, {
      id: "inconsistent", type: "addition", purpose: "saleProceeds", linkedTradeId: "missing",
      label: "Inconsistent legacy entry", date: "2026-01-02", amount: 200,
    }] });
    expect(() => store.getState().captureBackup()).toThrow();
    const prepared = (await service.selectPortfolioBackup())!;
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
    file.write.mockImplementation(() => { throw new Error("Full"); });
    file.delete.mockImplementation(() => { throw new Error("Access revoked"); });
    await expect(service.exportPortfolioBackup()).rejects.toThrow("Remove the incomplete new backup file");
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
    runtime.selectFile.mockResolvedValue({ size: backupMaxBytes + 1, text: read });
    const original = store.getState().captureBackup();
    await expect(service.selectPortfolioBackup()).rejects.toThrow("could not be read or validated");
    expect(read).not.toHaveBeenCalled();
    runtime.selectFile.mockResolvedValue({ size: 3, text: read });
    await expect(service.selectPortfolioBackup()).rejects.toThrow("could not be read or validated");
    expect(store.getState().captureBackup()).toEqual(original);
  });

  it("a canceled confirmation cannot mutate current data", async () => {
    const { service, store, file } = harness();
    file.write(await createPortfolioBackup(store.getState().captureBackup().payload, meta, digest));
    const prepared = (await service.selectPortfolioBackup())!;
    const controller = new AbortController();
    controller.abort();
    const original = store.getState().captureBackup();
    await expect(service.restorePortfolioBackup(prepared, controller.signal)).rejects.toThrow("canceled");
    expect(store.getState().captureBackup()).toEqual(original);
  });
});
