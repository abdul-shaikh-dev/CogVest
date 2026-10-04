import { createEmptyPortfolioSnapshot, createPortfolioStore, portfolioStorageKey } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { validateBackupPayload } from "@/src/domain/portfolioBackup";

it("defaults new installs to system but migrates old installs to dark without changing records", () => {
  const storage = createMemoryJsonStorage();
  expect(createPortfolioStore({ storage }).getState().preferences.appearance).toBe("system");
  const legacy = createEmptyPortfolioSnapshot();
  delete legacy.preferences.appearance;
  legacy.preferences.maskWealthValues = true;
  legacy.preferences.displayMode = "minimal";
  storage.setItem(portfolioStorageKey, legacy);
  const restored = createPortfolioStore({ storage }).getState();
  expect(restored.preferences).toEqual({ ...legacy.preferences, appearance: "dark" });
  expect(restored.trades).toEqual(legacy.trades);
  expect(restored.storageRecovery).toBeUndefined();
});

it.each(["light", "dark", "system"] as const)("persists %s and accepts it in backups independently from masking/display", (appearance) => {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage });
  store.getState().updatePreferences({ appearance, displayMode: "minimal", maskWealthValues: true });
  const preferences = createPortfolioStore({ storage }).getState().preferences;
  expect(preferences).toMatchObject({ appearance, displayMode: "minimal", maskWealthValues: true });
  const payload = { portfolio: { ...createEmptyPortfolioSnapshot(), preferences }, quoteCache: {}, historicalQuoteCache: {}, casFolioSalt: null };
  expect(validateBackupPayload(payload).portfolio.preferences.appearance).toBe(appearance);
  delete payload.portfolio.preferences.appearance;
  expect(() => validateBackupPayload(payload)).not.toThrow();
});

it("rejects unsupported appearance values in a backup", () => {
  const portfolio = createEmptyPortfolioSnapshot();
  const payload = { portfolio: { ...portfolio, preferences: { ...portfolio.preferences, appearance: "automatic-at-night" } }, quoteCache: {}, historicalQuoteCache: {}, casFolioSalt: null };
  expect(() => validateBackupPayload(payload)).toThrow();
});

it("restores an older backup as dark immediately and after restart", () => {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage });
  store.getState().updatePreferences({ appearance: "light" });
  const portfolio = createEmptyPortfolioSnapshot();
  delete portfolio.preferences.appearance;
  const payload = { portfolio, quoteCache: {}, historicalQuoteCache: {}, casFolioSalt: null };
  store.getState().replaceFromBackup(payload, store.getState().captureBackup().revision);
  expect(store.getState().preferences.appearance ?? "dark").toBe("dark");
  const restarted = createPortfolioStore({ storage });
  expect(restarted.getState().preferences.appearance).toBe("dark");
  expect(restarted.getState().cashEntries).toEqual(portfolio.cashEntries);
  expect(restarted.getState().monthlySnapshots).toEqual(portfolio.monthlySnapshots);
});

it("preserves invalid persisted preferences for recovery instead of silently accepting them", () => {
  const storage = createMemoryJsonStorage();
  const portfolio = createEmptyPortfolioSnapshot();
  storage.setItem(portfolioStorageKey, { ...portfolio, preferences: { ...portfolio.preferences, appearance: "invalid" } });
  expect(createPortfolioStore({ storage }).getState().storageRecovery).toBeDefined();
});
