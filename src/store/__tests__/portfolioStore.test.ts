import {
  createPortfolioStore,
  createDefaultPreferences,
  portfolioStorageKey,
  quoteCacheStorageKey,
} from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { Asset, CashEntry, Quote, Trade } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const trade: Trade = {
  assetId: asset.id,
  date: "2026-04-26T00:00:00.000Z",
  id: "trade-1",
  pricePerUnit: 2900,
  quantity: 2,
  totalValue: 5800,
  type: "buy",
};

const cashEntry: CashEntry = {
  amount: 10000,
  date: "2026-04-26T00:00:00.000Z",
  id: "cash-1",
  label: "Broker cash",
  type: "addition",
};

const quote: Quote = {
  asOf: "2026-04-26T10:00:00.000Z",
  assetId: asset.id,
  currency: "INR",
  price: 2912.5,
  source: "yahoo",
};

describe("portfolio store", () => {
  it("starts with empty raw data and V1 preferences", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    expect(store.getState().assets).toEqual([]);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
    expect(store.getState().preferences).toEqual(createDefaultPreferences());
  });

  it("adds, updates, and removes raw portfolio records", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    store.getState().addCashEntry(cashEntry);
    store.getState().updatePreferences({ maskWealthValues: true });

    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().trades).toEqual([trade]);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(store.getState().preferences.maskWealthValues).toBe(true);

    store.getState().removeTrade(trade.id);
    store.getState().removeCashEntry(cashEntry.id);
    store.getState().removeAsset(asset.id);

    expect(store.getState().assets).toEqual([]);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("persists only raw portfolio data under the portfolio key", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });

    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    store.getState().addCashEntry(cashEntry);

    const persisted = storage.getItem(portfolioStorageKey);

    expect(persisted).toEqual({
      assets: [asset],
      cashEntries: [cashEntry],
      preferences: createDefaultPreferences(),
      schemaVersion: 1,
      trades: [trade],
    });
    expect(persisted).not.toHaveProperty("holdings");
    expect(persisted).not.toHaveProperty("allocation");
    expect(persisted).not.toHaveProperty("dashboardTotal");
  });

  it("persists quotes separately from the main raw portfolio snapshot", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });

    store.getState().addAsset(asset);
    store.getState().upsertQuote(quote);

    expect(storage.getItem(portfolioStorageKey)).not.toHaveProperty("quotes");
    expect(storage.getItem(quoteCacheStorageKey)).toEqual({
      [asset.id]: quote,
    });
  });

  it("rehydrates raw portfolio data and quote cache from storage", () => {
    const storage = createMemoryJsonStorage();
    storage.setItem(portfolioStorageKey, {
      assets: [asset],
      cashEntries: [cashEntry],
      preferences: { ...createDefaultPreferences(), maskWealthValues: true },
      schemaVersion: 1,
      trades: [trade],
    });
    storage.setItem(quoteCacheStorageKey, {
      [asset.id]: quote,
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().trades).toEqual([trade]);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(store.getState().preferences.maskWealthValues).toBe(true);
    expect(store.getState().quoteCache[asset.id]).toEqual(quote);
  });
});
