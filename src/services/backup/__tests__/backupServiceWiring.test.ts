import { randomUUID } from "crypto";

import { backupMaxBytes } from "@/src/domain/portfolioBackup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

// Exercises the real native wiring in getService (#671): the folder and file
// pickers, the bounded native read, SHA-256, the app version and the
// post-restore hook. Only the Expo modules themselves are replaced.

const mockStore = createPortfolioStore({
  storage: createMemoryJsonStorage(),
  now: () => new Date("2026-09-10T10:00:00.000Z"),
});
const mockFiles = new Map<string, string>();
const mockPickDirectoryAsync = jest.fn();
const mockPickFileAsync = jest.fn();
const mockReadAsStringAsync = jest.fn(async (uri: string, options: { length: number; position: number }) => {
  const text = mockFiles.get(uri);
  if (text === undefined) throw new Error("missing file");
  return Buffer.from(text, "utf8").subarray(options.position, options.position + options.length).toString("base64");
});

jest.mock("expo-file-system", () => ({
  Directory: { pickDirectoryAsync: (...args: unknown[]) => mockPickDirectoryAsync(...args) },
  File: { pickFileAsync: (...args: unknown[]) => mockPickFileAsync(...args) },
}));
jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: (uri: string, options: { length: number; position: number }) => mockReadAsStringAsync(uri, options),
}));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm: string, value: string) =>
    (jest.requireActual("crypto") as typeof import("crypto")).createHash("sha256").update(value).digest("hex"),
  randomUUID: () => "wired-id",
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "9.8.7" } } }));
jest.mock("@/src/store", () => ({
  ...jest.requireActual("@/src/store"),
  getPortfolioStore: () => mockStore,
}));

// Imported after the mocks so getService binds to them.
import { exportPortfolioBackup, restorePortfolioBackup, selectPortfolioBackup } from "../index";

function pickedDirectory() {
  const created: Array<{ name: string; mime: string; uri: string; delete: jest.Mock }> = [];
  return {
    created,
    directory: {
      createFile: jest.fn((name: string, mime: string) => {
        const uri = `content://provider/tree/qa/document/${name}`;
        const file = {
          name, mime, uri,
          write: jest.fn(async (text: string) => { mockFiles.set(uri, text); }),
          delete: jest.fn(() => { mockFiles.delete(uri); }),
        };
        created.push(file);
        return file;
      }),
    },
  };
}

beforeEach(() => {
  mockFiles.clear();
  jest.clearAllMocks();
  mockStore.getState().addCashEntry({
    id: `cash-${randomUUID()}`, type: "addition", purpose: "capitalContribution",
    label: "Synthetic cash", date: "2026-01-01", amount: 100,
  });
});

describe("backup service native wiring (#671)", () => {
  it("writes a JSON backup into the picked folder and verifies it with a bounded native read", async () => {
    const { created, directory } = pickedDirectory();
    mockPickDirectoryAsync.mockResolvedValue(directory);

    const name = await exportPortfolioBackup();

    // The wired clock is the real one; the id comes from expo-crypto.
    expect(name).toMatch(/^CogVest-backup-\d{4}-\d{2}-\d{2}-wired-id\.json$/u);
    expect(mockPickDirectoryAsync).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ mime: "application/json", name });
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(created[0].uri,
      { encoding: "base64", length: backupMaxBytes + 1, position: 0 });
    const saved = JSON.parse(mockFiles.get(created[0].uri)!) as { appVersion: string };
    expect(saved.appVersion).toBe("9.8.7");
  });

  it("deletes the new file through the picked folder when its readback does not match", async () => {
    const { created, directory } = pickedDirectory();
    mockPickDirectoryAsync.mockResolvedValue(directory);
    mockReadAsStringAsync.mockResolvedValueOnce(Buffer.from("{}", "utf8").toString("base64"));

    await expect(exportPortfolioBackup()).rejects.toThrow("Backup could not be saved.");
    expect(created[0].delete).toHaveBeenCalledTimes(1);
    expect(mockFiles.has(created[0].uri)).toBe(false);
  });

  it("reports a folder picker cancellation as no action", async () => {
    mockPickDirectoryAsync.mockRejectedValue(new Error("User cancelled the folder picker"));

    await expect(exportPortfolioBackup()).resolves.toBeUndefined();
  });

  it("restores a file chosen in the picker, reading it through the bounded reader", async () => {
    const { created, directory } = pickedDirectory();
    mockPickDirectoryAsync.mockResolvedValue(directory);
    await exportPortfolioBackup();
    const backedUp = mockStore.getState().cashEntries;
    mockStore.getState().addCashEntry({
      id: "after-backup", type: "addition", purpose: "capitalContribution",
      label: "Added after the backup", date: "2026-02-01", amount: 50,
    });
    // SDK 58 can return a single file or an array.
    mockPickFileAsync.mockResolvedValue([{ size: mockFiles.get(created[0].uri)!.length, uri: created[0].uri }]);

    const prepared = await selectPortfolioBackup();

    expect(mockPickFileAsync).toHaveBeenCalledWith(undefined, "*/*");
    expect(prepared!.review.counts).toContainEqual({
      label: "Cash entries", current: backedUp.length + 1, backup: backedUp.length,
    });
    const epoch = mockStore.getState().restoreEpoch;
    await restorePortfolioBackup(prepared!);
    expect(mockStore.getState().cashEntries).toEqual(backedUp);
    // Screens reset their in-memory state from the new restore epoch (#666).
    expect(mockStore.getState().restoreEpoch).toBe(epoch + 1);
  });

  it("treats a dismissed file picker as no action", async () => {
    mockPickFileAsync.mockResolvedValue(null);

    await expect(selectPortfolioBackup()).resolves.toBeUndefined();
  });

  it("rejects a picked file whose bounded read exceeds the limit, without reading it whole", async () => {
    const uri = "content://provider/document/huge.json";
    mockFiles.set(uri, "x".repeat(backupMaxBytes + 10));
    // The provider under-reports the size; the bounded read still catches it.
    mockPickFileAsync.mockResolvedValue({ size: 100, uri });
    const before = mockStore.getState();

    await expect(selectPortfolioBackup()).rejects.toThrow("This backup could not be read or validated.");
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ length: backupMaxBytes + 1 }));
    expect(mockStore.getState()).toBe(before);
  });
});
