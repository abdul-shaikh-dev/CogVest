import { createMemoryJsonStorage, type JsonStorage } from "@/src/services/storage";
import {
  backupRestoreJournalKey,
  backupRestoreKeys,
  casFolioSaltStorageKey,
  quickSetupStorageKey,
} from "@/src/services/storage/backupKeys";
import {
  createEmptyPortfolioSnapshot,
  createPortfolioStore,
  portfolioStorageKey,
  preferencesStorageKey,
} from "@/src/store";
import { historicalQuoteCacheStorageKey } from "@/src/store/storeTypes";

const now = () => new Date("2026-09-10T10:00:00.000Z");

function storeWithCash(storage: JsonStorage = createMemoryJsonStorage()) {
  const store = createPortfolioStore({ storage, now });
  store.getState().addCashEntry({
    amount: 900, date: "2026-01-01", id: "cash", label: "Synthetic cash", purpose: "capitalContribution", type: "addition",
  });
  return { storage, store };
}

/** The storage keys written while `action` runs. */
function writesDuring(storage: JsonStorage, action: () => void) {
  const spies = [
    jest.spyOn(storage, "setItem"),
    jest.spyOn(storage, "setRawItem"),
    jest.spyOn(storage, "removeItem"),
  ];
  action();
  const keys = spies.flatMap((spy) => spy.mock.calls.map(([key]) => key as string));
  for (const spy of spies) spy.mockRestore();
  return keys;
}

describe("preferences saved under their own key (#665)", () => {
  it("writes only the preferences key when a preference changes", () => {
    const { storage, store } = storeWithCash();
    const portfolioBefore = storage.getRawItem(portfolioStorageKey);

    const keys = writesDuring(storage, () => store.getState().updatePreferences({ maskWealthValues: true }));

    expect(keys).toEqual([preferencesStorageKey]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(portfolioBefore);
    expect(storage.getItem(preferencesStorageKey)).toEqual({
      preferences: expect.objectContaining({ maskWealthValues: true }),
      version: 1,
    });
    expect(createPortfolioStore({ storage, now }).getState().preferences.maskWealthValues).toBe(true);
  });

  it("migrates a portfolio from an earlier version, whose preferences are only in the portfolio record", () => {
    const storage = createMemoryJsonStorage({
      [portfolioStorageKey]: {
        ...createEmptyPortfolioSnapshot(),
        preferences: { ...createEmptyPortfolioSnapshot().preferences, displayMode: "minimal", maskWealthValues: true },
      },
    });

    const store = createPortfolioStore({ storage, now });
    expect(store.getState().storageRecovery).toBeUndefined();
    expect(store.getState().preferences).toMatchObject({ displayMode: "minimal", maskWealthValues: true });
    expect(storage.getRawItem(preferencesStorageKey)).toBeNull();

    store.getState().updatePreferences({ maskWealthValues: false });
    const reopened = createPortfolioStore({ storage, now }).getState();
    expect(reopened.preferences).toMatchObject({ displayMode: "minimal", maskWealthValues: false });
  });

  it("keeps the saved preferences when a record change rewrites the portfolio", () => {
    const { storage, store } = storeWithCash();
    store.getState().updatePreferences({ displayMode: "minimal" });
    store.getState().addCashEntry({
      amount: 100, date: "2026-02-01", id: "cash-2", label: "Synthetic cash", purpose: "capitalContribution", type: "addition",
    });

    const reopened = createPortfolioStore({ storage, now }).getState();
    expect(reopened.preferences.displayMode).toBe("minimal");
    expect(reopened.cashEntries.map((entry) => entry.id)).toEqual(["cash", "cash-2"]);
  });

  it.each([
    ["updatePreferences", (store: ReturnType<typeof storeWithCash>["store"]) =>
      store.getState().updatePreferences({ maskWealthValues: true })],
    ["acknowledgeNudge", (store: ReturnType<typeof storeWithCash>["store"]) =>
      store.getState().acknowledgeNudge("minimal", 1)],
  ])("%s leaves the preferences unchanged when the write fails", (_name, change) => {
    const { storage, store } = storeWithCash();
    const before = store.getState().preferences;
    jest.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("Synthetic storage full");
    });

    expect(() => change(store)).toThrow("Synthetic storage full");
    expect(store.getState().preferences).toBe(before);
    expect(storage.getRawItem(preferencesStorageKey)).toBeNull();
  });

  it.each([
    ["not JSON", "{broken", "invalid-json"],
    ["a later version", JSON.stringify({ preferences: {}, version: 2 }), "unsupported-schema"],
    ["the wrong shape", JSON.stringify({ preferences: { maskWealthValues: "yes" }, version: 1 }), "invalid-shape"],
    ["an unknown field", JSON.stringify({ extra: true, preferences: {}, version: 1 }), "invalid-shape"],
  ])("quarantines a preferences record that is %s, and reset falls back to the portfolio's copy", (_label, raw, reason) => {
    const { storage, store } = storeWithCash();
    store.getState().updatePreferences({ displayMode: "minimal" });
    store.getState().addCashEntry({
      amount: 100, date: "2026-02-01", id: "cash-2", label: "Synthetic cash", purpose: "capitalContribution", type: "addition",
    });
    storage.setRawItem(preferencesStorageKey, raw);

    const reopened = createPortfolioStore({ storage, now });
    const incidents = reopened.getState().storageRecovery?.incidents ?? [];
    expect(incidents).toEqual([expect.objectContaining({
      displayName: "Display preferences", preserved: true, reason, sourceKey: preferencesStorageKey,
    })]);
    expect(storage.getRawItem(incidents[0].recoveryKey)).toBe(raw);
    expect(() => reopened.getState().updatePreferences({ maskWealthValues: true })).toThrow();

    reopened.getState().resetAffectedStorage();

    expect(reopened.getState().storageRecovery).toBeUndefined();
    expect(storage.getRawItem(preferencesStorageKey)).toBeNull();
    expect(reopened.getState().cashEntries).toHaveLength(2);
    // The portfolio record was last saved with these preferences.
    expect(reopened.getState().preferences.displayMode).toBe("minimal");
    expect(createPortfolioStore({ storage, now }).getState().preferences.displayMode).toBe("minimal");
  });

  it("resets the preferences with the portfolio when the portfolio record is reset", () => {
    const { storage, store } = storeWithCash();
    store.getState().updatePreferences({ maskWealthValues: true });
    storage.setRawItem(portfolioStorageKey, "{broken");

    const reopened = createPortfolioStore({ storage, now });
    expect(reopened.getState().storageRecovery?.incidents.map((incident) => incident.sourceKey))
      .toEqual([portfolioStorageKey]);
    reopened.getState().resetAffectedStorage();

    expect(storage.getRawItem(preferencesStorageKey)).toBeNull();
    expect(reopened.getState().preferences.maskWealthValues).toBe(false);
    expect(createPortfolioStore({ storage, now }).getState().preferences.maskWealthValues).toBe(false);
  });
});

describe("backup restore and the preferences key (#665)", () => {
  it("applies the backup's preferences and clears the saved ones", () => {
    const { storage, store } = storeWithCash();
    const backup = store.getState().captureBackup().payload;
    store.getState().updatePreferences({ maskWealthValues: true });

    store.getState().replaceFromBackup(backup, store.getState().captureBackup().revision);

    expect(store.getState().preferences.maskWealthValues).toBe(false);
    expect(storage.getRawItem(preferencesStorageKey)).toBeNull();
    expect(createPortfolioStore({ storage, now }).getState().preferences.maskWealthValues).toBe(false);
  });

  it("puts the saved preferences back when a restore fails part-way", () => {
    const { storage, store } = storeWithCash();
    const backup = store.getState().captureBackup().payload;
    store.getState().updatePreferences({ maskWealthValues: true });
    const savedPreferences = storage.getRawItem(preferencesStorageKey);
    const setRawItem = storage.setRawItem.bind(storage);
    let failed = false;
    jest.spyOn(storage, "setRawItem").mockImplementation((key, value) => {
      if (key === historicalQuoteCacheStorageKey && !failed) {
        failed = true;
        throw new Error("Synthetic storage full");
      }
      setRawItem(key, value);
    });

    expect(() => store.getState().replaceFromBackup(backup, store.getState().captureBackup().revision))
      .toThrow("Synthetic storage full");

    expect(storage.getRawItem(preferencesStorageKey)).toBe(savedPreferences);
    expect(storage.getRawItem(backupRestoreJournalKey)).toBeNull();
    expect(createPortfolioStore({ storage, now }).getState().preferences.maskWealthValues).toBe(true);
  });

  it("recovers a restore journal saved by the earlier version, which has no preferences key", () => {
    const { storage, store } = storeWithCash();
    store.getState().updatePreferences({ maskWealthValues: true });
    const original = Object.fromEntries(backupRestoreKeys
      .filter((key) => key !== preferencesStorageKey)
      .map((key) => [key, storage.getRawItem(key)]));
    storage.setRawItem(backupRestoreJournalKey, JSON.stringify({ original, version: 1 }));

    const reopened = createPortfolioStore({ storage, now });

    expect(reopened.getState().storageRecovery).toBeUndefined();
    expect(storage.getRawItem(backupRestoreJournalKey)).toBeNull();
    // Before that restore no preferences key existed.
    expect(storage.getRawItem(preferencesStorageKey)).toBeNull();
    expect(reopened.getState().cashEntries).toHaveLength(1);
  });

  it("still rejects a restore journal with a key it does not know", () => {
    const { storage } = storeWithCash();
    const original = Object.fromEntries(backupRestoreKeys.map((key) => [key, storage.getRawItem(key)]));
    storage.setRawItem(backupRestoreJournalKey, JSON.stringify({ original: { ...original, "cogvest:unknown": null }, version: 1 }));

    expect(createPortfolioStore({ storage, now }).getState().storageRecovery?.incidents)
      .toEqual([expect.objectContaining({ sourceKey: backupRestoreJournalKey })]);
  });
});

describe("backup revision (#665)", () => {
  it("is taken without reading or serialising the portfolio records", () => {
    const { storage, store } = storeWithCash();
    const reads = jest.spyOn(storage, "getRawItem");

    const revision = store.getState().getBackupRevision();

    expect(new Set(reads.mock.calls.map(([key]) => key))).toEqual(new Set([
      backupRestoreJournalKey, "cogvest:v1:asset-graph-journal", casFolioSaltStorageKey, quickSetupStorageKey,
    ]));
    expect(revision.length).toBeLessThan(200);
    reads.mockRestore();
  });

  it("changes after any store change or a write to the keys kept outside the store", () => {
    const { storage, store } = storeWithCash();
    const first = store.getState().getBackupRevision();
    expect(store.getState().getBackupRevision()).toBe(first);

    store.getState().updatePreferences({ maskWealthValues: true });
    const afterPreference = store.getState().getBackupRevision();
    expect(afterPreference).not.toBe(first);

    store.getState().upsertQuotes([]);
    expect(store.getState().getBackupRevision()).toBe(afterPreference);

    storage.setRawItem(quickSetupStorageKey, "synthetic-session");
    const afterQuickSetup = store.getState().getBackupRevision();
    expect(afterQuickSetup).not.toBe(afterPreference);

    storage.setRawItem(casFolioSaltStorageKey, "ef".repeat(32));
    expect(store.getState().getBackupRevision()).not.toBe(afterQuickSetup);
  });

  it("rejects a restore reviewed before a later change", () => {
    const { store } = storeWithCash();
    const { payload, revision } = store.getState().captureBackup();
    store.getState().upsertQuote({ asOf: now().toISOString(), assetId: "missing", currency: "INR", price: 1, source: "manual" });
    expect(store.getState().getBackupRevision()).toBe(revision);

    store.getState().updatePreferences({ maskWealthValues: true });
    expect(() => store.getState().replaceFromBackup(payload, revision)).toThrow("Your portfolio changed.");
  });
});
