import { createDailyPriceCache, dailyPriceCacheStorageKey, type DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createEmptyPortfolioSnapshot, createPortfolioStore } from "@/src/store";
import { captureBackupStorage } from "../backupPersistence";

const now = () => new Date("2026-09-10T12:00:00.000Z");
function entry(index = 0): DailyPriceEntry {
  return {
    provider: "yahoo", providerId: `SYNTHETIC${index}.NS`, currency: "INR", basis: "close",
    from: "2026-08-01", to: "2026-08-31", complete: true,
    fetchedAt: new Date(Date.UTC(2026, 8, 9, 0, 0, index)).toISOString(),
    points: [{ date: "2026-08-31", close: 125 }],
  };
}

function portfolio() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().replaceFromBackup({
    portfolio: {
      ...createEmptyPortfolioSnapshot(),
      assets: [{ id: "asset", name: "Synthetic", symbol: "SYNTHETIC", ticker: "SYNTHETIC.NS", quoteSourceId: "SYNTHETIC.NS", instrumentType: "stock", sectorType: "other", assetClass: "stock", currency: "INR" }],
      openingPositions: [{ id: "opening", assetId: "asset", date: "2026-01-01", quantity: 2, averageCostPrice: 100 }],
    },
    quoteCache: { asset: { assetId: "asset", asOf: "2026-01-01T00:00:00.000Z", currency: "INR", price: 120, source: "manual" } },
    historicalQuoteCache: { "asset:2026-08": { assetId: "asset", asOfMonth: "2026-08", basis: "historical-close", currency: "INR", fetchedAt: "2026-09-01T00:00:00.000Z", price: 115, source: "yahoo" } },
    casFolioSalt: null,
  }, store.getState().captureBackup().revision);
  return { storage, store, cache: createDailyPriceCache({ storage, now }) };
}

describe("disposable daily history isolation", () => {
  it("evicts chart entries without changing financial data, backup contents or a pending backup revision", () => {
    const { storage, store, cache } = portfolio();
    const before = store.getState().captureBackup();
    const raw = captureBackupStorage(storage);
    for (let index = 0; index < 65; index += 1) cache.write(entry(index));
    expect(cache.read(entry(0)).status).toBe("missing");
    expect(cache.read(entry(64)).status).toBe("hit");
    expect(captureBackupStorage(storage)).toEqual(raw);
    expect(store.getState().captureBackup()).toEqual(before);
    expect(createPortfolioStore({ storage, now }).getState().captureBackup().payload).toEqual(before.payload);
  });

  it("keeps corruption and clearing confined to disposable data", () => {
    const { storage, store, cache } = portfolio();
    const raw = captureBackupStorage(storage);
    const before = store.getState().captureBackup().payload;
    storage.setRawItem(dailyPriceCacheStorageKey, "{broken");
    expect(cache.read(entry()).status).toBe("corrupt");
    expect(createPortfolioStore({ storage, now }).getState().storageRecovery).toBeUndefined();
    cache.clear();
    expect(captureBackupStorage(storage)).toEqual(raw);
    expect(store.getState().captureBackup().payload).toEqual(before);
  });
});
