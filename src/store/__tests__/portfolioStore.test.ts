import {
  createPortfolioStore,
  createDefaultPreferences,
  historicalQuoteCacheKey,
  historicalQuoteCacheStorageKey,
  portfolioStorageKey,
  quoteCacheStorageKey,
} from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { Asset, CashEntry, OpeningPosition, Quote, Trade } from "@/src/types";
import type { MonthlySnapshot } from "@/src/types";

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
  purpose: "capitalContribution",
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

const monthlySnapshot: MonthlySnapshot = {
  cashValue: 120000,
  cryptoValue: 40000,
  debtValue: 300000,
  equityValue: 800000,
  id: "snapshot-2026-05",
  investedValue: 1060000,
  month: "2026-05",
  monthlyExpense: 40000,
  monthlyInvestment: 60000,
  notes: "May close",
  portfolioValue: 1385000,
  salary: 160000,
};

describe("portfolio store", () => {
  it("starts with empty raw data and V1 preferences", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    expect(store.getState().assets).toEqual([]);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
    expect(store.getState().monthlySnapshots).toEqual([]);
    expect(store.getState().preferences).toEqual(createDefaultPreferences());
  });

  it("rejects unsupported assets and quote currencies at write boundaries", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const foreignAsset: Asset = {
      ...asset,
      currency: "USD",
      exchange: undefined,
      id: "asset-aapl",
      name: "Apple",
      symbol: "AAPL",
      ticker: "AAPL",
    };

    expect(() => store.getState().addAsset(foreignAsset)).toThrow(
      "CogVest V1 supports INR holdings only",
    );

    store.getState().addAsset(asset);

    expect(() =>
      store.getState().upsertQuote({
        ...quote,
        currency: "USD",
      }),
    ).toThrow("has a USD quote");
  });

  it("adds, updates, and removes raw portfolio records", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addTrade(trade);
    store.getState().addCashEntry(cashEntry);
    store.getState().addMonthlySnapshot(monthlySnapshot);
    store.getState().updatePreferences({ maskWealthValues: true });

    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(store.getState().trades).toEqual([trade]);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(store.getState().monthlySnapshots).toEqual([monthlySnapshot]);
    expect(store.getState().preferences.maskWealthValues).toBe(true);

    store.getState().updateOpeningPosition({
      ...openingPosition,
      quantity: 30,
    });

    expect(store.getState().openingPositions[0]?.quantity).toBe(30);

    store.getState().updateMonthlySnapshot({
      ...monthlySnapshot,
      monthlyInvestment: 70000,
    });

    expect(store.getState().monthlySnapshots[0]?.monthlyInvestment).toBe(70000);

    store.getState().removeOpeningPosition(openingPosition.id);
    store.getState().removeTrade(trade.id);
    store.getState().removeCashEntry(cashEntry.id);
    store.getState().removeMonthlySnapshot(monthlySnapshot.id);
    store.getState().removeAsset(asset.id);

    expect(store.getState().assets).toEqual([]);
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
    expect(store.getState().monthlySnapshots).toEqual([]);
  });

  it("records a funded buy and linked cash movement in one transition", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 100000 });
    const fundedBuy = {
      ...trade,
      pricePerUnit: 100,
      quantity: 800,
      totalValue: 80000,
    };

    const result = store.getState().recordFundedBuy({
      cashLabel: "Reliance Industries purchase",
      trade: fundedBuy,
    });

    expect(result).toMatchObject({ isValid: true, trade: fundedBuy });
    expect(store.getState().trades).toEqual([fundedBuy]);
    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({ amount: 100000 }),
      expect.objectContaining({
        amount: 80000,
        linkedTradeId: fundedBuy.id,
        purpose: "purchaseFunding",
        type: "withdrawal",
      }),
    ]);
    expect(storage.getItem(portfolioStorageKey)).toMatchObject({
      cashEntries: store.getState().cashEntries,
      trades: [fundedBuy],
    });
  });

  it("rejects a funded buy above available cash before mutation", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 5000 });

    const result = store.getState().recordFundedBuy({
      cashLabel: "Reliance Industries purchase",
      trade: { ...trade, totalValue: 5800 },
    });

    expect(result).toEqual({
      availableCash: 5000,
      isValid: false,
      reason: "insufficientCash",
      requiredCash: 5800,
    });
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({ amount: 5000 }),
    ]);
  });

  it("records sale proceeds as a linked cash addition", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const sale = {
      ...trade,
      id: "trade-sale",
      pricePerUnit: 3100,
      totalValue: 6200,
      type: "sell" as const,
    };
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);

    const result = store.getState().recordSaleWithProceeds({
      cashLabel: "Reliance Industries sale proceeds",
      trade: sale,
    });

    expect(result).toMatchObject({ isValid: true, trade: sale });
    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({
        amount: 6200,
        linkedTradeId: sale.id,
        purpose: "saleProceeds",
        type: "addition",
      }),
    ]);
  });

  it("rejects a sale above available units before mutation", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);

    const result = store.getState().recordSaleWithProceeds({
      cashLabel: "Reliance Industries sale proceeds",
      trade: {
        ...trade,
        id: "trade-sale",
        pricePerUnit: 100,
        quantity: 30,
        totalValue: 3000,
        type: "sell",
      },
    });

    expect(result).toEqual({
      availableUnits: 25,
      isValid: false,
      reason: "insufficientUnits",
      requiredUnits: 30,
    });
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("rejects a linked trade whose total does not match its units and fees", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 10000 });

    const result = store.getState().recordFundedBuy({
      cashLabel: "Reliance Industries purchase",
      trade: { ...trade, totalValue: 5000 },
    });

    expect(result).toEqual({ isValid: false, reason: "invalidTrade" });
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({ amount: 10000 }),
    ]);
  });

  it("keeps memory unchanged when an atomic accounting write fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 10000 });
    const originalSetItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === portfolioStorageKey) {
        throw new Error("simulated persistence failure");
      }

      originalSetItem(key, value);
    };

    expect(() =>
      store.getState().recordFundedBuy({
        cashLabel: "Reliance Industries purchase",
        trade,
      }),
    ).toThrow("simulated persistence failure");
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({ amount: 10000 }),
    ]);
  });

  it("persists only raw portfolio data under the portfolio key", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addTrade(trade);
    store.getState().addCashEntry(cashEntry);
    store.getState().addMonthlySnapshot(monthlySnapshot);

    const persisted = storage.getItem(portfolioStorageKey);

    expect(persisted).toEqual({
      assets: [asset],
      cashEntries: [cashEntry],
      monthlySnapshots: [monthlySnapshot],
      openingPositions: [openingPosition],
      preferences: createDefaultPreferences(),
      schemaVersion: 5,
      trades: [trade],
    });
    expect(persisted).not.toHaveProperty("holdings");
    expect(persisted).not.toHaveProperty("allocation");
    expect(persisted).not.toHaveProperty("dashboardTotal");
    expect(persisted).not.toHaveProperty("monthlyProgressSummaries");
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
      monthlySnapshots: [monthlySnapshot],
      openingPositions: [openingPosition],
      preferences: { ...createDefaultPreferences(), maskWealthValues: true },
      schemaVersion: 5,
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
    expect(store.getState().monthlySnapshots).toEqual([monthlySnapshot]);
    expect(store.getState().preferences.maskWealthValues).toBe(true);
    expect(store.getState().quoteCache[asset.id]).toEqual(quote);
  });

  it("defaults historical quote cache to empty when no storage key exists", () => {
    const storage = createMemoryJsonStorage();
    storage.setItem(portfolioStorageKey, {
      assets: [asset],
      cashEntries: [cashEntry],
      monthlySnapshots: [monthlySnapshot],
      openingPositions: [openingPosition],
      preferences: createDefaultPreferences(),
      schemaVersion: 5,
      trades: [trade],
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState().historicalQuoteCache).toEqual({});
  });

  it("persists generated monthly snapshot metadata and historical quotes", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });

    store.getState().addMonthlySnapshot({
      cashValue: 50000,
      cryptoValue: 100000,
      debtValue: 200000,
      equityValue: 700000,
      generated: {
        generatedAt: "2026-08-01T04:00:00.000Z",
        priceBasis: "mixed",
        source: "auto",
        warnings: ["1 asset used latest local fallback"],
      },
      id: "snapshot-2026-07",
      investedValue: 900000,
      month: "2026-07",
      monthlyInvestment: 45000,
      performanceBasis: {
        netExternalFlow: 45000,
        status: "complete",
        warnings: [],
        weightedExternalFlow: 22500,
      },
      portfolioValue: 1050000,
      salary: 0,
    });
    store.getState().upsertHistoricalQuote({
      assetId: "asset-reliance",
      asOfMonth: "2026-07",
      basis: "historical-close",
      currency: "INR",
      fetchedAt: "2026-08-01T04:00:00.000Z",
      price: 2910,
      source: "yahoo",
    });

    const rehydrated = createPortfolioStore({ storage });

    expect(rehydrated.getState().monthlySnapshots[0]?.generated).toMatchObject({
      priceBasis: "mixed",
      source: "auto",
    });
    expect(
      rehydrated.getState().monthlySnapshots[0]?.performanceBasis,
    ).toMatchObject({
      netExternalFlow: 45000,
      status: "complete",
      weightedExternalFlow: 22500,
    });
    expect(
      rehydrated.getState().historicalQuoteCache[
        historicalQuoteCacheKey("asset-reliance", "2026-07")
      ],
    ).toMatchObject({
      basis: "historical-close",
      price: 2910,
    });
    expect(storage.getItem(portfolioStorageKey)).not.toHaveProperty(
      "historicalQuoteCache",
    );
    expect(storage.getItem(historicalQuoteCacheStorageKey)).toEqual({
      [historicalQuoteCacheKey("asset-reliance", "2026-07")]: {
        assetId: "asset-reliance",
        asOfMonth: "2026-07",
        basis: "historical-close",
        currency: "INR",
        fetchedAt: "2026-08-01T04:00:00.000Z",
        price: 2910,
        source: "yahoo",
      },
    });
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
    expect(store.getState().monthlySnapshots).toEqual([]);
    expect(store.getState().trades).toEqual([trade]);
    expect(store.getState().schemaVersion).toBe(5);
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
    expect(store.getState().schemaVersion).toBe(5);
  });

  it("migrates V3 snapshots by defaulting monthly snapshots", () => {
    const storage = createMemoryJsonStorage();
    storage.setItem(portfolioStorageKey, {
      assets: [asset],
      cashEntries: [cashEntry],
      openingPositions: [openingPosition],
      preferences: createDefaultPreferences(),
      schemaVersion: 3,
      trades: [trade],
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState().monthlySnapshots).toEqual([]);
    expect(store.getState().schemaVersion).toBe(5);
  });

  it("migrates V4 additions without inventing income semantics", () => {
    const storage = createMemoryJsonStorage();
    storage.setItem(portfolioStorageKey, {
      assets: [],
      cashEntries: [
        {
          amount: 5000,
          date: "2026-05-01",
          id: "legacy-addition",
          label: "Old deposit",
          type: "addition",
        },
      ],
      monthlySnapshots: [],
      openingPositions: [],
      preferences: createDefaultPreferences(),
      schemaVersion: 4,
      trades: [],
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({
        id: "legacy-addition",
        purpose: "legacyUncategorized",
      }),
    ]);
    expect(store.getState().schemaVersion).toBe(5);
  });
});
