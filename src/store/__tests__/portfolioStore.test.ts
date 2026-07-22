import {
  createPortfolioStore,
  createDefaultPreferences,
  historicalQuoteCacheKey,
  historicalQuoteCacheStorageKey,
  portfolioStorageKey,
  quoteCacheStorageKey,
  storageRecoveryKeyPrefix,
} from "@/src/store";
import { getMonthlySnapshotPriceConfidence } from "@/src/domain/calculations";
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
    const store = createPortfolioStore({
      now: () => new Date(2026, 3, 26, 12),
      storage: createMemoryJsonStorage(),
    });

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

  it("treats duplicate financial record IDs as idempotent appends", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    store.getState().addAsset(asset);
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addTrade(trade);
    store.getState().addTrade(trade);
    store.getState().addCashEntry(cashEntry);
    store.getState().addCashEntry(cashEntry);
    store.getState().addMonthlySnapshot(monthlySnapshot);
    store.getState().addMonthlySnapshot(monthlySnapshot);

    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(store.getState().trades).toEqual([trade]);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(store.getState().monthlySnapshots).toEqual([monthlySnapshot]);
  });

  it("corrects and deletes a manual cash entry with durable state", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });

    store.getState().addCashEntry(cashEntry);

    expect(
      store.getState().correctManualCashEntry({
        ...cashEntry,
        amount: 12500,
        label: "Corrected broker cash",
      }),
    ).toEqual({
      entry: {
        ...cashEntry,
        amount: 12500,
        label: "Corrected broker cash",
      },
      status: "applied",
    });
    expect(createPortfolioStore({ storage }).getState().cashEntries).toEqual([
      {
        ...cashEntry,
        amount: 12500,
        label: "Corrected broker cash",
      },
    ]);

    expect(store.getState().deleteManualCashEntry(cashEntry.id)).toMatchObject({
      entry: expect.objectContaining({ id: cashEntry.id }),
      status: "applied",
    });
    expect(createPortfolioStore({ storage }).getState().cashEntries).toEqual([]);
  });

  it("rejects cash correction for unknown and trade-linked entries", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const linkedEntry: CashEntry = {
      ...cashEntry,
      id: "cash-trade-buy",
      linkedTradeId: "trade-buy",
      purpose: "purchaseFunding",
      type: "withdrawal",
    };

    store.getState().addCashEntry(linkedEntry);

    expect(
      store.getState().correctManualCashEntry({
        ...linkedEntry,
        amount: 500,
      }),
    ).toEqual({ reason: "linkedEntry", status: "rejected" });
    expect(store.getState().deleteManualCashEntry(linkedEntry.id)).toEqual({
      reason: "linkedEntry",
      status: "rejected",
    });
    expect(store.getState().deleteManualCashEntry("cash-missing")).toEqual({
      reason: "notFound",
      status: "rejected",
    });
    expect(store.getState().cashEntries).toEqual([linkedEntry]);
  });

  it.each([
    ["invalid calendar date", { date: "2026-02-30" }],
    ["future calendar date", { date: "2999-01-01" }],
    ["unknown runtime type", { type: "transfer" }],
  ])("rejects a manual cash correction with %s", (_scenario, override) => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addCashEntry(cashEntry);
    const persistedBeforeCorrection = storage.getRawItem(portfolioStorageKey);

    expect(
      store.getState().correctManualCashEntry({
        ...cashEntry,
        ...override,
      } as CashEntry),
    ).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(
      persistedBeforeCorrection,
    );
  });

  it("uses the injected clock when validating a correction date", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({
      now: () => new Date(2026, 3, 26, 12),
      storage,
    });
    store.getState().addCashEntry(cashEntry);

    expect(
      store.getState().correctManualCashEntry({
        ...cashEntry,
        date: "2026-04-27",
      }),
    ).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(store.getState().cashEntries).toEqual([cashEntry]);
  });

  it("prevents generic cash mutations from breaking a linked transaction", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const linkedEntry: CashEntry = {
      ...cashEntry,
      id: "cash-linked",
      linkedTradeId: "trade-linked",
      purpose: "purchaseFunding",
      type: "withdrawal",
    };
    store.getState().addCashEntry(linkedEntry);

    expect(() => store.getState().removeCashEntry(linkedEntry.id)).toThrow(
      "Linked cash entries must be changed with their investment transaction.",
    );
    expect(() =>
      store.getState().updateCashEntry({ ...linkedEntry, amount: 500 }),
    ).toThrow(
      "Linked cash entries must be changed with their investment transaction.",
    );
    expect(store.getState().cashEntries).toEqual([linkedEntry]);
  });

  it("keeps generic cash mutations unchanged when persistence fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addCashEntry(cashEntry);
    const persistedBeforeFailure = storage.getRawItem(portfolioStorageKey);
    storage.setItem = () => {
      throw new Error("simulated generic cash mutation failure");
    };

    expect(() =>
      store.getState().updateCashEntry({ ...cashEntry, amount: 20000 }),
    ).toThrow("simulated generic cash mutation failure");
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(persistedBeforeFailure);

    expect(() => store.getState().removeCashEntry(cashEntry.id)).toThrow(
      "simulated generic cash mutation failure",
    );
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(persistedBeforeFailure);
  });

  it("keeps the original cash entry when correction persistence fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });

    store.getState().addCashEntry(cashEntry);
    const persistedBeforeFailure = storage.getRawItem(portfolioStorageKey);
    const originalSetItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === portfolioStorageKey) {
        throw new Error("simulated cash correction failure");
      }

      originalSetItem(key, value);
    };

    expect(() =>
      store.getState().correctManualCashEntry({
        ...cashEntry,
        amount: 20000,
      }),
    ).toThrow("simulated cash correction failure");
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(persistedBeforeFailure);

    expect(() =>
      store.getState().deleteManualCashEntry(cashEntry.id),
    ).toThrow("simulated cash correction failure");
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(persistedBeforeFailure);
  });

  it("corrects an opening position and refreshes auto history while preserving manual history", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage,
    });
    const autoSnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-05-01T00:00:00.000Z",
        priceBasis: "latest-local-fallback",
        source: "auto",
        warnings: ["Estimated from a local price."],
      },
      id: "snapshot-auto-april",
      month: "2026-04",
    };
    const manualSnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-06-01T00:00:00.000Z",
        priceBasis: "manual-fallback",
        source: "manual",
        warnings: [],
      },
      id: "snapshot-manual-may",
      month: "2026-05",
      notes: "Keep my month-end note",
    };

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addMonthlySnapshot(autoSnapshot);
    store.getState().addMonthlySnapshot(manualSnapshot);

    const result = store.getState().correctOpeningPosition({
      ...openingPosition,
      date: "2026-03-15T00:00:00.000Z",
      quantity: 50,
    });

    expect(result).toMatchObject({
      openingPosition: expect.objectContaining({ quantity: 50 }),
      pendingMonths: [],
      provisionalMonths: expect.arrayContaining(["2026-03", "2026-04"]),
      refreshedMonths: expect.arrayContaining(["2026-03", "2026-04"]),
      status: "applied",
    });
    expect(store.getState().openingPositions).toEqual([
      {
        ...openingPosition,
        date: "2026-03-15T00:00:00.000Z",
        quantity: 50,
      },
    ]);
    expect(
      store.getState().monthlySnapshots.find(({ month }) => month === "2026-04"),
    ).toMatchObject({
      id: autoSnapshot.id,
      investedValue: 72500,
      portfolioValue: 83912.5,
    });
    expect(
      store.getState().monthlySnapshots.find(({ month }) => month === "2026-05"),
    ).toEqual(manualSnapshot);
    expect(createPortfolioStore({ storage }).getState().openingPositions).toEqual([
      {
        ...openingPosition,
        date: "2026-03-15T00:00:00.000Z",
        quantity: 50,
      },
    ]);
  });

  it("removes obsolete auto history when an acquisition date moves later", () => {
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage: createMemoryJsonStorage(),
    });
    const autoSnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-05-01T00:00:00.000Z",
        priceBasis: "latest-local-fallback",
        source: "auto",
        warnings: [],
      },
      id: "snapshot-auto-april",
      month: "2026-04",
    };
    const manualSnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-06-01T00:00:00.000Z",
        priceBasis: "manual-fallback",
        source: "manual",
        warnings: [],
      },
      id: "snapshot-manual-may",
      month: "2026-05",
      notes: "Keep this review",
    };

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addMonthlySnapshot(autoSnapshot);
    store.getState().addMonthlySnapshot(manualSnapshot);

    const result = store.getState().correctOpeningPosition({
      ...openingPosition,
      date: "2026-06-15T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      pendingMonths: [],
      refreshedMonths: ["2026-06"],
      status: "applied",
    });
    expect(store.getState().monthlySnapshots.map(({ month }) => month)).toEqual([
      "2026-05",
      "2026-06",
    ]);
    expect(store.getState().monthlySnapshots[0]).toEqual(manualSnapshot);
  });

  it("deletes an opening position and removes affected auto history without deleting manual history", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage,
    });
    const autoSnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-05-01T00:00:00.000Z",
        priceBasis: "latest-local-fallback",
        source: "auto",
        warnings: [],
      },
      month: "2026-04",
    };
    const manualSnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      id: "snapshot-manual",
      month: "2026-05",
      notes: "Preserve this",
    };

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addMonthlySnapshot(autoSnapshot);
    store.getState().addMonthlySnapshot(manualSnapshot);

    expect(store.getState().deleteOpeningPosition(openingPosition.id)).toMatchObject({
      openingPosition,
      status: "applied",
    });
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().monthlySnapshots).toEqual([manualSnapshot]);
    expect(createPortfolioStore({ storage }).getState().monthlySnapshots).toEqual([
      manualSnapshot,
    ]);
  });

  it.each([
    ["unknown ID", { id: "missing" }, "notFound"],
    ["asset mismatch", { assetId: "asset-other" }, "assetMismatch"],
    ["zero quantity", { quantity: 0 }, "invalidEntry"],
    ["negative average cost", { averageCostPrice: -1 }, "invalidEntry"],
    ["invalid current price", { currentPrice: Number.NaN }, "invalidEntry"],
    ["impossible date", { date: "2026-02-30" }, "invalidEntry"],
    ["future date", { date: "2026-07-23" }, "invalidEntry"],
    ["invalid conviction", { conviction: 8 }, "invalidEntry"],
  ])("rejects opening-position correction with %s", (_case, override, reason) => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage,
    });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    const persistedBeforeCorrection = storage.getRawItem(portfolioStorageKey);

    expect(
      store.getState().correctOpeningPosition({
        ...openingPosition,
        ...override,
      } as OpeningPosition),
    ).toEqual({ reason, status: "rejected" });
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(
      persistedBeforeCorrection,
    );
  });

  it("keeps opening positions and history unchanged when correction persistence fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addMonthlySnapshot(monthlySnapshot);
    const persistedBeforeFailure = storage.getRawItem(portfolioStorageKey);
    storage.setItem = () => {
      throw new Error("simulated opening correction failure");
    };

    expect(() =>
      store.getState().correctOpeningPosition({
        ...openingPosition,
        quantity: 50,
      }),
    ).toThrow("simulated opening correction failure");
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(store.getState().monthlySnapshots).toEqual([monthlySnapshot]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(persistedBeforeFailure);

    expect(() =>
      store.getState().deleteOpeningPosition(openingPosition.id),
    ).toThrow("simulated opening correction failure");
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(store.getState().monthlySnapshots).toEqual([monthlySnapshot]);
  });

  it("records an opening position atomically and ignores replay after restart", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const command = {
      asset,
      commandId: openingPosition.id,
      openingPosition,
      quote,
    };

    expect(store.getState().recordOpeningPosition(command).status).toBe(
      "applied",
    );
    const restartedStore = createPortfolioStore({ storage });

    expect(restartedStore.getState().recordOpeningPosition(command).status).toBe(
      "alreadyApplied",
    );
    expect(restartedStore.getState().assets).toEqual([asset]);
    expect(restartedStore.getState().openingPositions).toEqual([openingPosition]);
    expect(restartedStore.getState().quoteCache).toEqual({ [asset.id]: quote });
  });

  it("exposes no partial opening position when portfolio persistence fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const originalSetItem = storage.setItem;
    let shouldFailPortfolioWrite = true;

    storage.setItem = (key, value) => {
      if (key === portfolioStorageKey && shouldFailPortfolioWrite) {
        shouldFailPortfolioWrite = false;
        throw new Error("simulated portfolio failure");
      }

      originalSetItem(key, value);
    };

    expect(() =>
      store.getState().recordOpeningPosition({
        asset,
        commandId: openingPosition.id,
        openingPosition,
        quote,
      }),
    ).toThrow("simulated portfolio failure");
    expect(store.getState().assets).toEqual([]);
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().quoteCache).toEqual({});
    expect(storage.getItem(quoteCacheStorageKey)).toBeNull();
  });

  it("keeps the durable holding when optional quote caching fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const originalSetItem = storage.setItem;

    storage.setItem = (key, value) => {
      if (key === quoteCacheStorageKey) {
        throw new Error("simulated quote cache failure");
      }

      originalSetItem(key, value);
    };

    const result = store.getState().recordOpeningPosition({
      asset,
      commandId: openingPosition.id,
      openingPosition,
      quote,
    });

    expect(result).toMatchObject({
      quoteCacheStatus: "unavailable",
      status: "applied",
    });
    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(store.getState().quoteCache).toEqual({});

    const restartedStore = createPortfolioStore({ storage });
    expect(restartedStore.getState().assets).toEqual([asset]);
    expect(restartedStore.getState().openingPositions).toEqual([
      openingPosition,
    ]);
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
      cashEntries: store.getState().cashEntries.map(({ notes: _notes, ...entry }) =>
        entry,
      ),
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

  it("corrects a funded buy and its linked cash movement atomically", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage,
    });
    const fundedBuy = {
      ...trade,
      fees: 10,
      pricePerUnit: 100,
      quantity: 2,
      totalValue: 210,
    };
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 1000 });
    store.getState().recordFundedBuy({ cashLabel: "Reliance purchase", trade: fundedBuy });

    const { totalValue: _totalValue, ...corrected } = {
      ...fundedBuy,
      date: "2026-04-27",
      quantity: 3,
    };
    expect(store.getState().correctTrade(corrected)).toMatchObject({
      cashEntry: expect.objectContaining({
        amount: 310,
        date: "2026-04-27",
        id: `cash-${trade.id}`,
      }),
      status: "applied",
      trade: { ...corrected, totalValue: 310 },
    });
    expect(store.getState().cashEntries).toContainEqual(
      expect.objectContaining({ amount: 310, linkedTradeId: trade.id }),
    );
    expect(createPortfolioStore({ storage }).getState().trades).toEqual([
      { ...corrected, totalValue: 310 },
    ]);
  });

  it("derives a corrected trade total instead of trusting caller data", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    const { totalValue: _totalValue, ...correction } = {
      ...trade,
      fees: 25,
      pricePerUnit: 100,
      quantity: 3,
    };

    expect(store.getState().correctTrade(correction)).toMatchObject({
      status: "applied",
      trade: { totalValue: 325 },
    });
  });

  it("rejects a backdated funded buy that depends on a later cash deposit", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const fundedBuy = {
      ...trade,
      date: "2026-04-26",
      pricePerUnit: 100,
      quantity: 2,
      totalValue: 200,
    };
    store.getState().addAsset(asset);
    store.getState().addCashEntry({
      ...cashEntry,
      amount: 1000,
      date: "2026-04-20",
    });
    store.getState().recordFundedBuy({ cashLabel: "Purchase", trade: fundedBuy });
    store.getState().addCashEntry({
      ...cashEntry,
      amount: 1000,
      date: "2026-05-01",
      id: "cash-future",
    });
    const { totalValue: _totalValue, ...correction } = {
      ...fundedBuy,
      date: "2026-04-10",
    };

    expect(store.getState().correctTrade(correction)).toEqual({
      reason: "insufficientCash",
      status: "rejected",
    });
  });

  it("keeps an unlinked legacy trade unlinked after correction", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);

    const { totalValue: _totalValue, ...correction } = {
      ...trade,
      quantity: 3,
    };
    expect(store.getState().correctTrade(correction)).toMatchObject({
      cashEntry: undefined,
      status: "applied",
    });
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("rejects trade correction and deletion that would oversell a holding", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const buy = { ...trade, pricePerUnit: 100, quantity: 5, totalValue: 500 };
    const sell = {
      ...trade,
      id: "trade-sale",
      pricePerUnit: 120,
      quantity: 4,
      totalValue: 480,
      type: "sell" as const,
    };
    store.getState().addAsset(asset);
    store.getState().addTrade(buy);
    store.getState().addTrade(sell);

    const { totalValue: _totalValue, ...correction } = {
      ...sell,
      quantity: 6,
    };
    expect(store.getState().correctTrade(correction)).toEqual({
      reason: "oversold",
      status: "rejected",
    });
    expect(store.getState().deleteTrade(buy.id)).toEqual({
      reason: "oversold",
      status: "rejected",
    });
  });

  it("rejects stale, identity-changing, invalid, and future trade corrections", () => {
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage: createMemoryJsonStorage(),
    });
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    const { totalValue: _totalValue, ...correction } = trade;

    expect(
      store.getState().correctTrade({ ...correction, id: "missing" }),
    ).toEqual({ reason: "notFound", status: "rejected" });
    expect(
      store.getState().correctTrade({ ...correction, assetId: "other" }),
    ).toEqual({ reason: "assetMismatch", status: "rejected" });
    expect(
      store.getState().correctTrade({ ...correction, type: "sell" }),
    ).toEqual({ reason: "typeMismatch", status: "rejected" });
    expect(
      store.getState().correctTrade({ ...correction, quantity: 0 }),
    ).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(
      store.getState().correctTrade({ ...correction, date: "2026-07-23" }),
    ).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(store.getState().trades).toEqual([trade]);
  });

  it("rejects correction when a trade has duplicate linked cash movements", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const fundedBuy = { ...trade, pricePerUnit: 100, quantity: 2, totalValue: 200 };
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 1000 });
    store.getState().recordFundedBuy({ cashLabel: "Purchase", trade: fundedBuy });
    store.setState((state) => ({
      cashEntries: [
        ...state.cashEntries,
        {
          amount: 200,
          date: fundedBuy.date,
          id: "cash-duplicate-link",
          label: "Duplicate",
          linkedTradeId: fundedBuy.id,
          purpose: "purchaseFunding",
          type: "withdrawal",
        },
      ],
    }));
    const { totalValue: _totalValue, ...correction } = fundedBuy;

    expect(store.getState().correctTrade(correction)).toEqual({
      reason: "inconsistentLink",
      status: "rejected",
    });
  });

  it("refreshes automatic trade history while preserving manual snapshots", () => {
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage: createMemoryJsonStorage(),
    });
    const autoSnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-05-01T00:00:00.000Z",
        priceBasis: "latest-local-fallback",
        source: "auto",
        warnings: [],
      },
      id: "snapshot-auto-april",
      month: "2026-04",
    };
    const manualSnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      id: "snapshot-manual-may",
      month: "2026-05",
      notes: "Keep reviewed values",
    };
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    store.getState().addMonthlySnapshot(autoSnapshot);
    store.getState().addMonthlySnapshot(manualSnapshot);
    const { totalValue: _totalValue, ...correction } = {
      ...trade,
      quantity: 3,
    };

    expect(store.getState().correctTrade(correction)).toMatchObject({
      refreshedMonths: expect.arrayContaining(["2026-04"]),
      status: "applied",
    });
    expect(
      store.getState().monthlySnapshots.find(({ month }) => month === "2026-04"),
    ).toMatchObject({ id: autoSnapshot.id, investedValue: 8700 });
    expect(
      store.getState().monthlySnapshots.find(({ month }) => month === "2026-05"),
    ).toEqual(manualSnapshot);
  });

  it("deletes a linked sale and its proceeds together", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const sale = {
      ...trade,
      id: "trade-sale",
      pricePerUnit: 100,
      quantity: 2,
      totalValue: 200,
      type: "sell" as const,
    };
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().recordSaleWithProceeds({ cashLabel: "Sale proceeds", trade: sale });

    expect(store.getState().deleteTrade(sale.id)).toMatchObject({
      cashEntry: expect.objectContaining({ linkedTradeId: sale.id }),
      status: "applied",
      trade: sale,
    });
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("rejects reducing or deleting sale proceeds that funded a later purchase", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const sale = {
      ...trade,
      date: "2026-04-10",
      id: "trade-sale",
      pricePerUnit: 100,
      quantity: 2,
      totalValue: 200,
      type: "sell" as const,
    };
    const laterBuy = {
      ...trade,
      date: "2026-04-20",
      id: "trade-later-buy",
      pricePerUnit: 150,
      quantity: 1,
      totalValue: 150,
    };
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({
      ...openingPosition,
      date: "2026-04-01",
      quantity: 2,
    });
    store.getState().recordSaleWithProceeds({ cashLabel: "Sale", trade: sale });
    store.getState().recordFundedBuy({ cashLabel: "Later buy", trade: laterBuy });
    const { totalValue: _totalValue, ...correction } = {
      ...sale,
      quantity: 1,
    };

    expect(store.getState().correctTrade(correction)).toEqual({
      reason: "insufficientCash",
      status: "rejected",
    });
    expect(store.getState().deleteTrade(sale.id)).toEqual({
      reason: "insufficientCash",
      status: "rejected",
    });
  });

  it("applies acquisitions before disposals on the same calendar date", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const sameDayBuy = {
      ...trade,
      date: "2026-04-10",
      id: "z-buy",
      pricePerUnit: 100,
      quantity: 2,
      totalValue: 200,
    };
    const sameDaySale = {
      ...trade,
      date: "2026-04-10",
      id: "a-sale",
      pricePerUnit: 100,
      quantity: 2,
      totalValue: 200,
      type: "sell" as const,
    };
    store.getState().addAsset(asset);
    store.getState().addTrade(sameDayBuy);
    store.getState().addTrade(sameDaySale);
    const { totalValue: _totalValue, ...correction } = sameDaySale;

    expect(store.getState().correctTrade(correction)).toMatchObject({
      status: "applied",
    });
  });

  it("preserves trade, linked cash, and history when correction persistence fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const fundedBuy = { ...trade, pricePerUnit: 100, quantity: 2, totalValue: 200 };
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 1000 });
    store.getState().recordFundedBuy({ cashLabel: "Purchase", trade: fundedBuy });
    const before = store.getState();
    storage.setItem = () => {
      throw new Error("simulated trade correction failure");
    };

    const { totalValue: _totalValue, ...correction } = {
      ...fundedBuy,
      quantity: 3,
    };
    expect(() => store.getState().correctTrade(correction)).toThrow(
      "simulated trade correction failure",
    );
    expect(store.getState().trades).toEqual(before.trades);
    expect(store.getState().cashEntries).toEqual(before.cashEntries);
    expect(store.getState().monthlySnapshots).toEqual(before.monthlySnapshots);
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
        confidence: "provisional",
        generatedAt: "2026-08-01T04:00:00.000Z",
        priceBasis: "mixed",
        priceEvidence: [
          {
            assetId: "asset-reliance",
            basis: "latest-local-fallback",
            price: 2910,
          },
        ],
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
      confidence: "provisional",
      priceBasis: "mixed",
      priceEvidence: [
        {
          assetId: "asset-reliance",
          basis: "latest-local-fallback",
          price: 2910,
        },
      ],
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

  it("rehydrates legacy aggregate price metadata with conservative confidence", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const legacySnapshot: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-08-01T04:00:00.000Z",
        priceBasis: "mixed",
        source: "auto",
        warnings: ["1 holding used manual price fallback."],
      },
    };
    store.getState().addMonthlySnapshot(legacySnapshot);

    const rehydratedSnapshot = createPortfolioStore({ storage }).getState()
      .monthlySnapshots[0];

    expect(rehydratedSnapshot).toEqual(legacySnapshot);
    expect(getMonthlySnapshotPriceConfidence(rehydratedSnapshot!)).toBe(
      "provisional",
    );
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

  it.each([
    ["malformed JSON", "{not-json", "invalid-json"],
    [
      "unsupported schema",
      JSON.stringify({ schemaVersion: 99 }),
      "unsupported-schema",
    ],
    [
      "invalid record shape",
      JSON.stringify({ assets: [{ id: "broken" }], schemaVersion: 5 }),
      "invalid-shape",
    ],
  ])("quarantines %s without treating it as a normal empty portfolio", (
    _label,
    rawValue,
    reason,
  ) => {
    const storage = createMemoryJsonStorage();
    const now = new Date("2026-07-22T10:00:00.000Z");
    storage.setRawItem(portfolioStorageKey, rawValue);

    const store = createPortfolioStore({ now: () => now, storage });
    const incident = store.getState().storageRecovery?.incidents[0];
    const recoveryKey = `${storageRecoveryKeyPrefix}:${portfolioStorageKey}`;

    expect(incident).toMatchObject({
      detectedAt: now.toISOString(),
      displayName: "Portfolio records",
      preserved: true,
      reason,
      recoveryKey,
      sourceKey: portfolioStorageKey,
    });
    expect(storage.getRawItem(portfolioStorageKey)).toBe(rawValue);
    expect(storage.getRawItem(recoveryKey)).toBe(rawValue);
    expect(storage.getItem(`${recoveryKey}:metadata`)).toEqual({
      detectedAt: now.toISOString(),
      reason,
      sourceKey: portfolioStorageKey,
    });
    expect(store.getState().assets).toEqual([]);
  });

  it("quarantines malformed quote caches without losing valid portfolio records", () => {
    const storage = createMemoryJsonStorage();
    const firstStore = createPortfolioStore({ storage });
    firstStore.getState().addAsset(asset);
    storage.setRawItem(quoteCacheStorageKey, "{broken-quotes");
    storage.setRawItem(historicalQuoteCacheStorageKey, "[not-a-cache]");

    const store = createPortfolioStore({ storage });

    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().quoteCache).toEqual({});
    expect(store.getState().historicalQuoteCache).toEqual({});
    expect(store.getState().storageRecovery?.incidents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKey: quoteCacheStorageKey }),
        expect.objectContaining({ sourceKey: historicalQuoteCacheStorageKey }),
      ]),
    );
  });

  it("enters recovery when a valid stored snapshot cannot be migrated", () => {
    const storage = createMemoryJsonStorage();
    const firstStore = createPortfolioStore({ storage });
    firstStore.getState().addAsset(asset);
    const originalRaw = storage.getRawItem(portfolioStorageKey);

    const store = createPortfolioStore({
      migratePortfolioSnapshot: () => {
        throw new Error("migration failed");
      },
      storage,
    });

    expect(store.getState().storageRecovery?.incidents[0]).toMatchObject({
      preserved: true,
      reason: "migration-failed",
      sourceKey: portfolioStorageKey,
    });
    expect(storage.getRawItem(portfolioStorageKey)).toBe(originalRaw);
    expect(
      storage.getRawItem(`${storageRecoveryKeyPrefix}:${portfolioStorageKey}`),
    ).toBe(originalRaw);
  });

  it("resets only affected active keys and retains recovery copies", () => {
    const storage = createMemoryJsonStorage();
    const firstStore = createPortfolioStore({ storage });
    firstStore.getState().addAsset(asset);
    const corruptQuoteCache = "{broken-quotes";
    storage.setRawItem(quoteCacheStorageKey, corruptQuoteCache);

    const store = createPortfolioStore({ storage });
    const recoveryKey = `${storageRecoveryKeyPrefix}:${quoteCacheStorageKey}`;

    store.getState().resetAffectedStorage();

    expect(store.getState().storageRecovery).toBeUndefined();
    expect(store.getState().assets).toEqual([asset]);
    expect(storage.getRawItem(portfolioStorageKey)).not.toBeNull();
    expect(storage.getRawItem(quoteCacheStorageKey)).toBeNull();
    expect(storage.getRawItem(recoveryKey)).toBe(corruptQuoteCache);
  });

  it("starts from a safe empty portfolio after confirmed portfolio reset", () => {
    const storage = createMemoryJsonStorage();
    const corruptPortfolio = "{broken-portfolio";
    storage.setRawItem(portfolioStorageKey, corruptPortfolio);

    const store = createPortfolioStore({ storage });
    const recoveryKey = `${storageRecoveryKeyPrefix}:${portfolioStorageKey}`;

    store.getState().resetAffectedStorage();

    expect(store.getState()).toMatchObject({
      assets: [],
      cashEntries: [],
      monthlySnapshots: [],
      openingPositions: [],
      quoteCache: {},
      trades: [],
    });
    expect(store.getState().storageRecovery).toBeUndefined();
    expect(storage.getRawItem(portfolioStorageKey)).toBeNull();
    expect(storage.getRawItem(recoveryKey)).toBe(corruptPortfolio);
  });

  it("refuses reset when a recovery copy could not be preserved", () => {
    const baseStorage = createMemoryJsonStorage();
    const corruptPortfolio = "{broken-portfolio";
    baseStorage.setRawItem(portfolioStorageKey, corruptPortfolio);
    const storage = {
      ...baseStorage,
      setRawItem: () => {
        throw new Error("storage full");
      },
    };

    const store = createPortfolioStore({ storage });

    expect(store.getState().storageRecovery?.incidents[0]).toMatchObject({
      preserved: false,
      sourceKey: portfolioStorageKey,
    });

    store.getState().resetAffectedStorage();

    expect(store.getState().storageRecovery).toBeDefined();
    expect(storage.getRawItem(portfolioStorageKey)).toBe(corruptPortfolio);
  });
});
