import {
  createPortfolioStore,
  createDefaultPreferences,
  portfolioStorageKey,
  quoteCacheStorageKey,
} from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { Asset, CashEntry, OpeningPosition, Quote, Trade } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  instrumentType: "stock",
  name: "Reliance Industries",
  quoteSourceId: "RELIANCE.NS",
  sectorType: "financialServices",
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

const openingPosition: OpeningPosition = {
  assetId: asset.id,
  averageCostPrice: 1450,
  currentPrice: 1678.25,
  date: "2026-04-15T00:00:00.000Z",
  id: "opening-1",
  quantity: 25,
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
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
    expect(store.getState().preferences).toEqual(createDefaultPreferences());
  });

  it("adds, updates, and removes raw portfolio records", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addTrade(trade);
    store.getState().addCashEntry(cashEntry);
    store.getState().updatePreferences({ maskWealthValues: true });

    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(store.getState().trades).toEqual([trade]);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(store.getState().preferences.maskWealthValues).toBe(true);

    store.getState().updateOpeningPosition({
      ...openingPosition,
      quantity: 30,
    });

    expect(store.getState().openingPositions[0]?.quantity).toBe(30);

    store.getState().removeOpeningPosition(openingPosition.id);
    store.getState().removeTrade(trade.id);
    store.getState().removeCashEntry(cashEntry.id);
    store.getState().removeAsset(asset.id);

    expect(store.getState().assets).toEqual([]);
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("persists only raw portfolio data under the portfolio key", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addTrade(trade);
    store.getState().addCashEntry(cashEntry);

    const persisted = storage.getItem(portfolioStorageKey);

    expect(persisted).toEqual({
      assets: [asset],
      cashEntries: [cashEntry],
      openingPositions: [openingPosition],
      preferences: createDefaultPreferences(),
      schemaVersion: 3,
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
      openingPositions: [openingPosition],
      preferences: { ...createDefaultPreferences(), maskWealthValues: true },
      schemaVersion: 3,
      trades: [trade],
    });
    storage.setItem(quoteCacheStorageKey, {
      [asset.id]: quote,
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(store.getState().trades).toEqual([trade]);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(store.getState().preferences.maskWealthValues).toBe(true);
    expect(store.getState().quoteCache[asset.id]).toEqual(quote);
  });

  it("migrates V1 persisted snapshots by adding empty opening positions", () => {
    const storage = createMemoryJsonStorage();
    storage.setItem(portfolioStorageKey, {
      assets: [asset],
      cashEntries: [cashEntry],
      preferences: createDefaultPreferences(),
      schemaVersion: 1,
      trades: [trade],
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().trades).toEqual([trade]);
    expect(store.getState().schemaVersion).toBe(3);
    expect(store.getState().assets[0]).toMatchObject({
      instrumentType: "stock",
      quoteSourceId: "RELIANCE.NS",
      sectorType: "financialServices",
    });
  });

  it("migrates V2 snapshots by defaulting missing asset metadata", () => {
    const storage = createMemoryJsonStorage();
    storage.setItem(portfolioStorageKey, {
      assets: [
        {
          assetClass: "etf",
          currency: "INR",
          id: "asset-niftybees",
          name: "Nifty 50 ETF",
          symbol: "NIFTYBEES",
          ticker: "NIFTYBEES.NS",
        },
      ],
      cashEntries: [],
      openingPositions: [],
      preferences: createDefaultPreferences(),
      schemaVersion: 2,
      trades: [],
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState().assets[0]).toMatchObject({
      instrumentType: "etf",
      quoteSourceId: "NIFTYBEES.NS",
      sectorType: "diversified",
    });
    expect(store.getState().schemaVersion).toBe(3);
  });
});
