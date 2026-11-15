import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Quote } from "@/src/types";

// Since #658 a provider quote carries its market time (asOf) and its fetch time.
const asset: Asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "stock", name: "Synthetic Ltd",
  symbol: "SYN", ticker: "SYN.NS",
};
const fridayClose: Quote = {
  asOf: "2026-11-13T10:00:00.000Z", assetId: "stock", currency: "INR",
  fetchedAt: "2026-11-15T06:00:00.000Z", price: 100, source: "yahoo",
};
const now = () => new Date("2026-11-15T06:05:00.000Z");

describe("quote fetch time", () => {
  it("keeps the fetch time through a restart", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    store.getState().addAsset(asset);
    store.getState().upsertQuote(fridayClose);

    expect(createPortfolioStore({ now, storage }).getState().quoteCache.stock).toEqual(fridayClose);
  });

  it("keeps the fetch time through backup and restore", () => {
    const source = createPortfolioStore({ now, storage: createMemoryJsonStorage() });
    source.getState().addAsset(asset);
    source.getState().upsertQuote(fridayClose);
    const target = createPortfolioStore({ now, storage: createMemoryJsonStorage() });

    target.getState().replaceFromBackup(source.getState().captureBackup().payload, target.getState().getBackupRevision());

    expect(target.getState().quoteCache.stock).toEqual(fridayClose);
  });

  it("still loads a quote saved before fetch times existed", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    store.getState().addAsset(asset);
    const { fetchedAt: _fetchedAt, ...legacy } = fridayClose;
    store.getState().upsertQuote(legacy);

    expect(createPortfolioStore({ now, storage }).getState().quoteCache.stock).toEqual(legacy);
  });
});
