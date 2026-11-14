import { withoutOrphanQuotes } from "@/src/domain/quoteCacheIntegrity";
import { createMemoryJsonStorage, type JsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import {
  historicalQuoteCacheStorageKey,
  portfolioStorageKey,
  quoteCacheStorageKey,
} from "@/src/store/storeTypes";
import type { Asset, HistoricalQuote, Quote } from "@/src/types";

const kept: Asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "kept", name: "Synthetic Kept Ltd",
  symbol: "KEPT", ticker: "KEPT.NS",
};
const deleted: Asset = { ...kept, id: "deleted", name: "Synthetic Deleted Ltd", symbol: "GONE", ticker: "GONE.NS" };

function quoteFor(assetId: string): Quote {
  return { asOf: "2026-10-01T10:00:00.000Z", assetId, currency: "INR", price: 100, source: "yahoo" };
}
function historicalQuoteFor(assetId: string): HistoricalQuote {
  return {
    asOfMonth: "2026-09", assetId, basis: "historical-close", currency: "INR",
    fetchedAt: "2026-10-01T04:00:00.000Z", price: 95, source: "yahoo",
  };
}

/** A portfolio with one kept holding and one deleted holding. */
function portfolioAfterDelete(storage: JsonStorage = createMemoryJsonStorage()) {
  const store = createPortfolioStore({ storage });
  store.getState().addAsset(kept);
  store.getState().addAsset(deleted);
  store.getState().upsertQuote(quoteFor("kept"));
  store.getState().upsertHistoricalQuote(historicalQuoteFor("kept"));
  expect(store.getState().deleteAsset("deleted")).toMatchObject({ status: "applied" });
  return { storage, store };
}

describe("quotes for deleted holdings (#651)", () => {
  it("ignores a late quote for a deleted holding, and backup export still works", () => {
    const { storage, store } = portfolioAfterDelete();

    store.getState().upsertQuote(quoteFor("deleted"));
    store.getState().upsertHistoricalQuote(historicalQuoteFor("deleted"));

    expect(Object.keys(store.getState().quoteCache)).toEqual(["kept"]);
    expect(Object.keys(store.getState().historicalQuoteCache)).toEqual(["kept:2026-09"]);
    expect(Object.keys(storage.getItem<Record<string, Quote>>(quoteCacheStorageKey) ?? {})).toEqual(["kept"]);
    expect(store.getState().captureBackup().payload.quoteCache).toEqual({ kept: quoteFor("kept") });
  });

  it("drops saved orphan quotes when the portfolio opens, so export works again", () => {
    const { storage } = portfolioAfterDelete();
    // An orphan saved by an earlier version.
    storage.setItem(quoteCacheStorageKey, { deleted: quoteFor("deleted"), kept: quoteFor("kept") });
    storage.setItem(historicalQuoteCacheStorageKey, {
      "deleted:2026-09": historicalQuoteFor("deleted"),
      "kept:2026-09": historicalQuoteFor("kept"),
    });

    const reopened = createPortfolioStore({ storage });

    expect(reopened.getState().storageRecovery).toBeUndefined();
    expect(Object.keys(reopened.getState().quoteCache)).toEqual(["kept"]);
    expect(Object.keys(reopened.getState().historicalQuoteCache)).toEqual(["kept:2026-09"]);
    expect(Object.keys(storage.getItem<Record<string, Quote>>(quoteCacheStorageKey) ?? {})).toEqual(["kept"]);
    expect(Object.keys(storage.getItem<Record<string, HistoricalQuote>>(historicalQuoteCacheStorageKey) ?? {}))
      .toEqual(["kept:2026-09"]);
    expect(() => reopened.getState().captureBackup()).not.toThrow();
  });

  it("keeps saved quotes untouched while the portfolio itself needs recovery", () => {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(portfolioStorageKey, "{not json");
    storage.setItem(quoteCacheStorageKey, { kept: quoteFor("kept") });

    const reopened = createPortfolioStore({ storage });

    expect(reopened.getState().storageRecovery).toBeDefined();
    expect(storage.getItem(quoteCacheStorageKey)).toEqual({ kept: quoteFor("kept") });
  });

  it("leaves orphan quotes in memory out of the exported backup", () => {
    const { store } = portfolioAfterDelete();
    store.setState({
      historicalQuoteCache: { ...store.getState().historicalQuoteCache, "deleted:2026-09": historicalQuoteFor("deleted") },
      quoteCache: { ...store.getState().quoteCache, deleted: quoteFor("deleted") },
    });

    const { payload } = store.getState().captureBackup();

    expect(Object.keys(payload.quoteCache)).toEqual(["kept"]);
    expect(Object.keys(payload.historicalQuoteCache)).toEqual(["kept:2026-09"]);
  });

  it("does not change quotes in memory when saving them fails", () => {
    const storage = createMemoryJsonStorage();
    const { store } = portfolioAfterDelete(storage);
    const before = store.getState();
    const setItem = storage.setItem;
    storage.setItem = () => {
      throw new Error("Device storage is full.");
    };

    expect(() => store.getState().upsertQuote({ ...quoteFor("kept"), price: 120 })).toThrow("Device storage is full.");
    expect(() => store.getState().upsertHistoricalQuote({ ...historicalQuoteFor("kept"), price: 120 }))
      .toThrow("Device storage is full.");
    storage.setItem = setItem;

    expect(store.getState().quoteCache).toBe(before.quoteCache);
    expect(store.getState().historicalQuoteCache).toBe(before.historicalQuoteCache);
  });
});

describe("withoutOrphanQuotes", () => {
  it("returns the same cache when every quote has its asset", () => {
    const cache = { kept: quoteFor("kept") };
    expect(withoutOrphanQuotes(cache, [kept])).toBe(cache);
  });

  it("drops quotes whose asset is missing or now uses another currency", () => {
    const cache = { deleted: quoteFor("deleted"), kept: quoteFor("kept") };
    expect(withoutOrphanQuotes(cache, [kept, deleted].map((asset) => ({ ...asset })))).toBe(cache);
    expect(withoutOrphanQuotes(cache, [kept])).toEqual({ kept: quoteFor("kept") });
    expect(withoutOrphanQuotes(cache, [{ ...kept, currency: "USD" }])).toEqual({});
  });
});
