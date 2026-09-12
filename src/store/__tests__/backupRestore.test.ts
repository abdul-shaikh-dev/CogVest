import { createPortfolioStore, createEmptyPortfolioSnapshot, portfolioStorageKey, quoteCacheStorageKey, assetGraphJournalStorageKey } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { backupRestoreJournalKey, casFolioSaltStorageKey, quickSetupStorageKey } from "@/src/services/storage/backupKeys";
import { captureBackupStorage } from "../backupPersistence";
import type { BackupPayload } from "@/src/domain/portfolioBackup";
import { createCasFolioFingerprintProvider } from "@/src/services/import-export/casStatementImport";
import { createHash } from "crypto";
import { createQuickSetupSessionStore } from "@/src/features/quickSetup/quickSetupSession";
import { parseCamsKfinCasWithFolioFingerprint } from "@/src/domain/camsKfinCas";
import { normalizeCamsKfinCas } from "@/src/domain/camsKfinCasNormalizer";
import { sanitizedCombinedDetailedCasFixture } from "@/src/domain/__tests__/fixtures/camsKfinCas.fixture";
import { buildTransactionImportPlan } from "@/src/features/transactionImport/transactionImport";
import type { Asset } from "@/src/types";

const now = () => new Date("2026-09-10T10:00:00.000Z");
const salt = "ab".repeat(32);

function payload(): BackupPayload {
  return {
    portfolio: {
      ...createEmptyPortfolioSnapshot(),
      assets: [{ id: "sample", name: "Example stock", ticker: "SAMPLE.NS", symbol: "SAMPLE", currency: "INR", assetClass: "stock", exchange: "NSE", instrumentType: "stock", sectorType: "other", quoteSourceId: "SAMPLE.NS" }],
      openingPositions: [{ id: "opening", assetId: "sample", date: "2026-01-01", quantity: 2, averageCostPrice: 100 }],
      preferences: { defaultChartRange: "ALL", displayMode: "minimal", hasCompletedOnboarding: true, maskWealthValues: true },
    },
    quoteCache: { sample: { assetId: "sample", asOf: now().toISOString(), currency: "INR", price: 125, source: "manual" } },
    historicalQuoteCache: {},
    casFolioSalt: salt,
  };
}

function destination() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addCashEntry({ id: "old", amount: 900, date: "2026-01-01", label: "Old cash", type: "addition", purpose: "capitalContribution" });
  storage.setRawItem(casFolioSaltStorageKey, "cd".repeat(32));
  storage.setRawItem(quickSetupStorageKey, "old-session");
  return { store, storage };
}

describe("portfolio backup replacement", () => {
  it("replaces rather than merges, cold opens identically, and revokes captured old actions", () => {
    const { store, storage } = destination();
    const oldAction = store.getState().updatePreferences;
    const original = store.getState().captureBackup();
    store.getState().replaceFromBackup(payload(), original.revision);
    expect(store.getState().restoreEpoch).toBe(1);
    expect(store.getState().captureBackup().payload).toEqual(payload());
    expect(store.getState().cashEntries).toEqual([]);
    expect(storage.getRawItem(quickSetupStorageKey)).toBeNull();
    expect(() => oldAction({ maskWealthValues: false })).toThrow("restored");
    expect(createPortfolioStore({ storage, now }).getState().captureBackup().payload).toEqual(payload());
    store.getState().replaceFromBackup(payload(), store.getState().captureBackup().revision);
    expect(store.getState().openingPositions).toHaveLength(1);
  });

  it("rejects a stale preview when current data, quotes, or auxiliary keys change", () => {
    const { store, storage } = destination();
    const revision = store.getState().captureBackup().revision;
    storage.setRawItem(quickSetupStorageKey, "changed-session");
    const before = captureBackupStorage(storage);
    expect(() => store.getState().replaceFromBackup(payload(), revision)).toThrow("changed");
    expect(captureBackupStorage(storage)).toEqual(before);
    const nextRevision = store.getState().captureBackup().revision;
    store.getState().updatePreferences({ maskWealthValues: true });
    expect(() => store.getState().replaceFromBackup(payload(), nextRevision)).toThrow("changed");
  });

  it("validates again at commit and does not trust the caller", () => {
    const { store, storage } = destination();
    const malformed = payload();
    malformed.portfolio.openingPositions[0].assetId = "missing";
    const before = captureBackupStorage(storage);
    expect(() => store.getState().replaceFromBackup(malformed, store.getState().captureBackup().revision)).toThrow();
    expect(captureBackupStorage(storage)).toEqual(before);
  });

  it("preserves original memory and storage when a replacement write fails", () => {
    const { store, storage } = destination();
    const before = store.getState();
    const original = captureBackupStorage(storage);
    const revision = before.captureBackup().revision;
    const setter = storage.setRawItem;
    storage.setRawItem = jest.fn((key, value) => {
      if (key === quoteCacheStorageKey) { storage.setRawItem = setter; throw new Error("Storage full"); }
      setter(key, value);
    });
    expect(() => before.replaceFromBackup(payload(), revision)).toThrow("Storage full");
    expect(store.getState()).toBe(before);
    expect(captureBackupStorage(storage)).toEqual(original);
  });

  it("blocks changes and CAS/setup initialization when rollback cannot finish", () => {
    const { store, storage } = destination();
    const original = captureBackupStorage(storage);
    storage.setRawItem(backupRestoreJournalKey, JSON.stringify({ version: 1, original }));
    const setter = storage.setRawItem;
    storage.setRawItem = () => { throw new Error("Storage full"); };
    const blocked = createPortfolioStore({ storage, now });
    expect(blocked.getState().storageRecovery).toBeDefined();
    expect(() => blocked.getState().captureBackup()).toThrow("recovery");
    expect(() => blocked.getState().upsertQuote(payload().quoteCache.sample)).toThrow("recovery");
    expect(() => createCasFolioFingerprintProvider({ digest: async () => "test", randomBytes: () => new Uint8Array(32), storage })).toThrow("recovery");
    const setup = createQuickSetupSessionStore({ storage, now });
    expect(setup.getState().session).toBeNull();
    expect(() => setup.getState().start()).toThrow("recovery");
    blocked.getState().resetAffectedStorage();
    expect(storage.getRawItem(backupRestoreJournalKey)).not.toBeNull();
    storage.setRawItem = setter;
    const recovered = createPortfolioStore({ storage, now });
    expect(recovered.getState().storageRecovery).toBeUndefined();
    expect(recovered.getState().cashEntries).toEqual(store.getState().cashEntries);
  });

  it("still recovers an interrupted legacy asset-graph journal", () => {
    const { storage } = destination();
    const original = captureBackupStorage(storage);
    storage.setRawItem(assetGraphJournalStorageKey, JSON.stringify({ portfolio: original[portfolioStorageKey], quotes: original[quoteCacheStorageKey], historical: null }));
    storage.setRawItem(portfolioStorageKey, "bad-partial-write");
    const store = createPortfolioStore({ storage, now });
    expect(store.getState().storageRecovery).toBeUndefined();
    expect(store.getState().cashEntries[0].amount).toBe(900);
    expect(storage.getRawItem(assetGraphJournalStorageKey)).toBeNull();
  });

  it("retains CAS fingerprint identity across fresh storage and clears it for no-CAS backups", async () => {
    const { store, storage } = destination();
    store.getState().replaceFromBackup(payload(), store.getState().captureBackup().revision);
    const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
    const randomBytes = jest.fn(() => new Uint8Array(32));
    const first = createCasFolioFingerprintProvider({ digest, randomBytes, storage });
    const transferred = createMemoryJsonStorage();
    const secondStore = createPortfolioStore({ storage: transferred, now });
    secondStore.getState().replaceFromBackup(store.getState().captureBackup().payload, secondStore.getState().captureBackup().revision);
    const second = createCasFolioFingerprintProvider({ digest, randomBytes, storage: transferred });
    expect(await second("synthetic-folio-001")).toBe(await first("synthetic-folio-001"));
    expect(randomBytes).not.toHaveBeenCalled();
    secondStore.getState().replaceFromBackup({ ...payload(), casFolioSalt: null }, secondStore.getState().captureBackup().revision);
    expect(transferred.getRawItem(casFolioSaltStorageKey)).toBeNull();
  });

  it("recognizes the same CAS import after restoring its records and identity salt", async () => {
    const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
    const statement = sanitizedCombinedDetailedCasFixture.split("Another Sample Mutual Fund")[0]
      .replace("Opening Unit Balance: 10.0000000", "Opening Unit Balance: 0.0000000")
      .replace("125.0000 18.0000000", "125.0000 8.0000000")
      .replace("125.0000 22.0000000", "125.0000 12.0000000")
      .replace("Closing Unit Balance: 22.0000000", "Closing Unit Balance: 12.0000000")
      .replace("INR 3,300.00", "INR 1,800.00");
    const casOpeningEvidence = {
      coverageFrom: "2024-01-01",
      schemes: [{ folioLabel: "Folio 1", isin: "INF000000001", openingUnits: "0" }],
    };
    const asset: Asset = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "cas-fund",
      isin: "INF000000001",
      name: "Sample Equity Fund",
      symbol: "SAMPLEFUND",
      ticker: "SAMPLEFUND.NS",
    };
    const sourceStorage = createMemoryJsonStorage();
    sourceStorage.setRawItem(casFolioSaltStorageKey, salt);
    const sourceStore = createPortfolioStore({ storage: sourceStorage, now });
    const parseRows = async (storage: ReturnType<typeof createMemoryJsonStorage>) => {
      const fingerprint = createCasFolioFingerprintProvider({
        digest,
        randomBytes: () => { throw new Error("Restored CAS salt should be reused."); },
        storage,
      });
      return normalizeCamsKfinCas(
        await parseCamsKfinCasWithFolioFingerprint(statement, fingerprint),
      ).rows;
    };
    const resolutions = (rows: Awaited<ReturnType<typeof parseRows>>, resolvedAsset: Asset) =>
      rows.map((row) => ({ asset: resolvedAsset, row, status: "ready" as const }));

    const importedRows = await parseRows(sourceStorage);
    const initialPlan = buildTransactionImportPlan({
      batchId: "cas-import-before-backup",
      casOpeningEvidence,
      mode: "supplemental",
      now: now(),
      resolutions: resolutions(importedRows, asset),
      state: sourceStore.getState(),
    });
    expect(initialPlan.errors).toEqual([]);
    expect(initialPlan.command).toBeDefined();
    expect(sourceStore.getState().recordTransactionImport(initialPlan.command!)).toMatchObject({
      added: importedRows.length,
      status: "applied",
    });

    const backup = sourceStore.getState().captureBackup();
    const restoredStorage = createMemoryJsonStorage();
    const restoredStore = createPortfolioStore({ storage: restoredStorage, now });
    restoredStore.getState().replaceFromBackup(backup.payload, restoredStore.getState().getBackupRevision());
    const restoredRows = await parseRows(restoredStorage);
    const beforeAssets = restoredStore.getState().assets;
    const beforeTrades = restoredStore.getState().trades;
    const repeatPlan = buildTransactionImportPlan({
      batchId: "cas-import-after-restore",
      casOpeningEvidence,
      mode: "supplemental",
      now: now(),
      resolutions: resolutions(restoredRows, restoredStore.getState().assets[0]),
      state: restoredStore.getState(),
    });

    expect(restoredRows).toEqual(importedRows);
    expect(repeatPlan.errors).toEqual([]);
    expect(repeatPlan.duplicates).toBe(importedRows.length);
    expect(repeatPlan.summary.additions).toBe(0);
    expect(repeatPlan.command).toBeUndefined();
    expect(restoredStore.getState().assets).toEqual(beforeAssets);
    expect(restoredStore.getState().trades).toEqual(beforeTrades);
  });
});
