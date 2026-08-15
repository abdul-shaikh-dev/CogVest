import {
  createPortfolioStore,
  createDefaultPreferences,
  assetGraphJournalStorageKey,
  historicalQuoteCacheKey,
  historicalQuoteCacheStorageKey,
  portfolioStorageKey,
  quoteCacheStorageKey,
  storageRecoveryKeyPrefix,
} from "@/src/store";
import { getMonthlySnapshotPriceConfidence } from "@/src/domain/calculations";
import { getAvailableQuantity } from "@/src/domain/validators/trade";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type {
  Asset,
  CashEntry,
  OpeningPosition,
  PpfAccount,
  PpfLedgerEntry,
  Quote,
  Trade,
} from "@/src/types";
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

const ppfAccount: PpfAccount = {
  balanceAsOf: "2026-07-31",
  confirmedBalance: 100_000,
  createdAt: "2026-08-01T10:00:00.000Z",
  id: "ppf-1",
  nickname: "Primary PPF",
  opening: { financialYearStart: 2020, kind: "financialYear" },
  provider: "India Post",
  status: "active",
};

function ppfContribution(
  id: string,
  amount: number,
  date = "2026-08-01",
): PpfLedgerEntry {
  return {
    accountId: ppfAccount.id,
    amount,
    date,
    id,
    recordedAt: `${date}T10:00:00.000Z`,
    type: "contribution",
  };
}

const openingPosition: OpeningPosition = {
  assetId: asset.id,
  averageCostPrice: 1450,
  date: "2026-04-15T00:00:00.000Z",
  id: "opening-1",
  manualValuation: {
    asOf: "2026-04-26T00:00:00.000Z",
    currency: "INR",
    price: 1678.25,
    provenance: "user",
    source: "manual",
  },
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

  it("normalizes only newly written financial records", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    store.getState().addCashEntry({
      ...cashEntry,
      amount: 10000.005,
    });
    store.getState().addOpeningPosition({
      ...openingPosition,
      averageCostPrice: 1450.123456785,
      manualValuation: {
        ...openingPosition.manualValuation!,
        price: 1678.123456785,
      },
      quantity: 0.123456785,
    });
    store.getState().upsertQuote({
      ...quote,
      dayChangeAbs: 1.005,
      dayChangePct: 1.235,
      price: 2912.123456785,
    });

    expect(store.getState().cashEntries[0]?.amount).toBe(10000.01);
    expect(store.getState().openingPositions[0]).toMatchObject({
      averageCostPrice: 1450.12345679,
      manualValuation: { price: 1678.12345679 },
      quantity: 0.12345679,
    });
    expect(store.getState().quoteCache[asset.id]).toMatchObject({
      dayChangeAbs: 1.005,
      dayChangePct: 1.24,
      price: 2912.12345679,
    });
  });

  it("rejects a cash update that rounds below the supported money precision", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry(cashEntry);

    expect(() =>
      store.getState().updateCashEntry({ ...cashEntry, amount: 0.004 }),
    ).toThrow("Cash entry amount is below supported precision.");
    expect(store.getState().cashEntries).toEqual([cashEntry]);
  });

  it("rejects new records that collapse below their supported precision", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    expect(() =>
      store.getState().addOpeningPosition({
        ...openingPosition,
        quantity: 0.000000004,
      }),
    ).toThrow("Opening position contains invalid financial values.");
    expect(() =>
      store.getState().upsertQuote({
        ...quote,
        price: 0.000000004,
      }),
    ).toThrow("Quote price is below supported precision.");
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().quoteCache).toEqual({});
  });

  it("loads legacy schema-v5 numbers without rewriting their representation", () => {
    const storage = createMemoryJsonStorage();
    const legacySnapshot = {
      assets: [asset],
      cashEntries: [{ ...cashEntry, amount: 10000.005 }],
      monthlySnapshots: [],
      openingPositions: [
        {
          ...openingPosition,
          averageCostPrice: 1450.123456789,
          quantity: 0.123456789,
        },
      ],
      preferences: createDefaultPreferences(),
      schemaVersion: 5,
      trades: [],
    };
    const originalRaw = JSON.stringify(legacySnapshot);
    storage.setRawItem(portfolioStorageKey, originalRaw);

    const store = createPortfolioStore({ storage });

    expect(store.getState().cashEntries[0]?.amount).toBe(10000.005);
    expect(store.getState().openingPositions[0]?.averageCostPrice).toBe(
      1450.123456789,
    );
    expect(storage.getRawItem(portfolioStorageKey)).toBe(originalRaw);
  });

  it("completes fractional buy and sell cycles at the quantity quantum", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 1000 });

    for (const [id, quantity] of [
      ["trade-fraction-1", 0.1],
      ["trade-fraction-2", 0.2],
    ] as const) {
      expect(
        store.getState().recordFundedBuy({
          cashLabel: "Fractional buy",
          trade: {
            ...trade,
            id,
            pricePerUnit: 100,
            quantity,
            totalValue: quantity * 100,
          },
        }).isValid,
      ).toBe(true);
    }

    const sale = store.getState().recordSaleWithProceeds({
      cashLabel: "Full fractional sale",
      trade: {
        ...trade,
        id: "trade-fraction-sale",
        pricePerUnit: 110,
        quantity: 0.3,
        totalValue: 33,
        type: "sell",
      },
    });

    expect(sale.isValid).toBe(true);
    expect(store.getState().trades.at(-1)).toMatchObject({
      quantity: 0.3,
      totalValue: 33,
      type: "sell",
    });
    expect(getAvailableQuantity(store.getState().trades)).toBe(0);
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

  it("corrects asset metadata without changing its stable identity", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().upsertQuote(quote);

    const result = store.getState().correctAsset({
      ...asset,
      name: "Reliance Industries Limited",
      sectorType: "energy",
    });

    expect(result).toMatchObject({
      asset: expect.objectContaining({
        id: asset.id,
        name: "Reliance Industries Limited",
        sectorType: "energy",
      }),
      quoteCacheInvalidated: false,
      status: "applied",
    });
    expect(store.getState().quoteCache[asset.id]).toEqual(quote);
  });

  it("rejects direct insertion of a duplicate canonical asset identity", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);

    expect(() =>
      store.getState().addAsset({
        ...asset,
        id: "asset-duplicate",
        name: "Reliance duplicate",
        quoteSourceId: " reliance.ns ",
      }),
    ).toThrow("Asset identity already exists.");
    expect(store.getState().assets).toEqual([asset]);
  });

  it("rejects duplicate asset identities and invalid corrections", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addAsset({
      ...asset,
      id: "asset-hdfc",
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });

    expect(
      store.getState().correctAsset({
        ...asset,
        quoteSourceId: "HDFCBANK.NS",
        ticker: "HDFCBANK.NS",
      }),
    ).toEqual({ reason: "duplicateIdentity", status: "rejected" });
    expect(
      store.getState().correctAsset({ ...asset, name: "" }),
    ).toEqual({ reason: "invalidAsset", status: "rejected" });
    expect(
      store.getState().correctAsset({
        ...asset,
        sectorType: "not-a-sector" as Asset["sectorType"],
      }),
    ).toEqual({ reason: "invalidAsset", status: "rejected" });
    expect(
      store.getState().correctAsset({ ...asset, id: "missing" }),
    ).toEqual({ reason: "notFound", status: "rejected" });
  });

  it("invalidates only the corrected asset quote identity", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const otherAsset: Asset = {
      ...asset,
      id: "asset-hdfc",
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    store.getState().addAsset(asset);
    store.getState().addAsset(otherAsset);
    store.getState().upsertQuote(quote);
    store.getState().upsertQuote({
      ...quote,
      assetId: otherAsset.id,
    });
    store.getState().upsertHistoricalQuote({
      asOfMonth: "2026-04",
      assetId: asset.id,
      basis: "historical-close",
      currency: "INR",
      fetchedAt: "2026-05-01T00:00:00.000Z",
      price: 2850,
      source: "yahoo",
    });

    const result = store.getState().correctAsset({
      ...asset,
      quoteSourceId: "RELIANCE.BO",
      exchange: "BSE",
      ticker: "RELIANCE.BO",
    });

    expect(result).toMatchObject({
      quoteCacheInvalidated: true,
      status: "applied",
    });
    expect(store.getState().quoteCache[asset.id]).toBeUndefined();
    expect(store.getState().historicalQuoteCache).toEqual({});
    expect(store.getState().quoteCache[otherAsset.id]).toBeDefined();
  });

  it("rebuilds affected automatic snapshots after classification correction", () => {
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage: createMemoryJsonStorage(),
    });
    const automaticApril: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-05-01T00:00:00.000Z",
        priceBasis: "manual-fallback",
        source: "auto",
        warnings: [],
      },
      id: "snapshot-auto-april",
      month: "2026-04",
    };
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addMonthlySnapshot(automaticApril);
    store.getState().addMonthlySnapshot(monthlySnapshot);

    expect(
      store.getState().correctAsset({
        ...asset,
        assetClass: "debt",
        instrumentType: "debt",
        sectorType: "fixedIncome",
      }),
    ).toMatchObject({ status: "applied" });

    const rebuiltApril = store
      .getState()
      .monthlySnapshots.find((snapshot) => snapshot.month === "2026-04");
    expect(rebuiltApril).toMatchObject({
      debtValue:
        openingPosition.quantity * openingPosition.manualValuation!.price,
      equityValue: 0,
      id: automaticApril.id,
    });
    expect(
      store
        .getState()
        .monthlySnapshots.find((snapshot) => snapshot.id === monthlySnapshot.id),
    ).toEqual(monthlySnapshot);
  });

  it("deletes an asset graph without removing manual records", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage,
    });
    const linkedTrade: Trade = {
      ...trade,
      date: "2026-04-26",
      id: "trade-linked",
    };
    const linkedCash: CashEntry = {
      amount: linkedTrade.totalValue,
      date: linkedTrade.date,
      id: "cash-trade-linked",
      label: "Purchase · Reliance",
      linkedTradeId: linkedTrade.id,
      purpose: "purchaseFunding",
      type: "withdrawal",
    };
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addTrade(linkedTrade);
    store.getState().addCashEntry(cashEntry);
    store.getState().addCashEntry(linkedCash);
    store.getState().addMonthlySnapshot(monthlySnapshot);
    store.getState().upsertQuote(quote);
    store.getState().upsertHistoricalQuote({
      asOfMonth: "2026-04",
      assetId: asset.id,
      basis: "historical-close",
      currency: "INR",
      fetchedAt: "2026-05-01T00:00:00.000Z",
      price: 2850,
      source: "yahoo",
    });

    const result = store.getState().deleteAsset(asset.id);

    expect(result).toMatchObject({
      impact: {
        automaticSnapshots: 0,
        historicalQuotes: 1,
        linkedCashEntries: 1,
        openingPositions: 1,
        quotes: 1,
        trades: 1,
      },
      status: "applied",
    });
    expect(store.getState().assets).toEqual([]);
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(
      store
        .getState()
        .monthlySnapshots.find((snapshot) => snapshot.id === monthlySnapshot.id),
    ).toEqual(monthlySnapshot);
    expect(
      store
        .getState()
        .monthlySnapshots.find((snapshot) => snapshot.month === "2026-04"),
    ).toMatchObject({
      cashValue: cashEntry.amount,
      equityValue: 0,
      portfolioValue: cashEntry.amount,
    });
    expect(store.getState().quoteCache).toEqual({});
    expect(store.getState().historicalQuoteCache).toEqual({});
    expect(createPortfolioStore({ storage }).getState().assets).toEqual([]);
  });

  it("keeps the asset graph unchanged when cascade persistence fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().upsertQuote(quote);
    const originalSetItem = storage.setItem;
    let failed = false;
    storage.setItem = (key, value) => {
      if (key === historicalQuoteCacheStorageKey && !failed) {
        failed = true;
        throw new Error("simulated asset transition failure");
      }
      originalSetItem(key, value);
    };

    expect(() => store.getState().deleteAsset(asset.id)).toThrow(
      "simulated asset transition failure",
    );
    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().openingPositions).toEqual([openingPosition]);
    expect(store.getState().quoteCache[asset.id]).toEqual(quote);
    expect(createPortfolioStore({ storage }).getState().assets).toEqual([asset]);
  });

  it("recovers an interrupted multi-key asset transition from its journal", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addAsset(asset);
    store.getState().upsertQuote(quote);
    const originalSetItem = storage.setItem;
    const originalSetRawItem = storage.setRawItem;
    storage.setItem = (key, value) => {
      if (key === historicalQuoteCacheStorageKey) {
        throw new Error("simulated interrupted asset transition");
      }
      originalSetItem(key, value);
    };
    storage.setRawItem = () => {
      throw new Error("simulated rollback interruption");
    };

    expect(() => store.getState().deleteAsset(asset.id)).toThrow(
      "simulated interrupted asset transition",
    );
    expect(storage.getItem(assetGraphJournalStorageKey)).not.toBeNull();

    storage.setItem = originalSetItem;
    storage.setRawItem = originalSetRawItem;
    const recovered = createPortfolioStore({ storage });

    expect(recovered.getState().assets).toEqual([asset]);
    expect(recovered.getState().quoteCache[asset.id]).toEqual(quote);
    expect(storage.getItem(assetGraphJournalStorageKey)).toBeNull();
  });

  it("blocks safely when an asset transition journal is malformed", () => {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(assetGraphJournalStorageKey, "{broken-journal");

    const store = createPortfolioStore({ storage });

    expect(store.getState().storageRecovery?.incidents[0]).toMatchObject({
      displayName: "Interrupted asset change",
      preserved: false,
      reason: "invalid-json",
      sourceKey: assetGraphJournalStorageKey,
    });
    expect(storage.getRawItem(assetGraphJournalStorageKey)).toBe(
      "{broken-journal",
    );
  });

  it("blocks safely when an interrupted asset transition still cannot replay", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    store.getState().addAsset(asset);
    store.getState().upsertQuote(quote);
    const originalSetItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === historicalQuoteCacheStorageKey) {
        throw new Error("simulated interrupted asset transition");
      }
      originalSetItem(key, value);
    };
    storage.setRawItem = () => {
      throw new Error("storage remains unavailable");
    };

    expect(() => store.getState().deleteAsset(asset.id)).toThrow(
      "simulated interrupted asset transition",
    );

    const recoveringStore = createPortfolioStore({ storage });

    expect(
      recoveringStore.getState().storageRecovery?.incidents[0],
    ).toMatchObject({
      displayName: "Interrupted asset change",
      preserved: false,
      reason: "migration-failed",
      sourceKey: assetGraphJournalStorageKey,
    });
    expect(storage.getRawItem(assetGraphJournalStorageKey)).not.toBeNull();
  });

  it("rejects asset deletion when its sale proceeds fund later activity", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const sale: Trade = {
      ...trade,
      id: "trade-sale",
      type: "sell",
    };
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addTrade(sale);
    store.getState().addCashEntry({
      amount: sale.totalValue,
      date: sale.date,
      id: "cash-sale",
      label: "Sale proceeds",
      linkedTradeId: sale.id,
      purpose: "saleProceeds",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 1000,
      date: "2026-04-27",
      id: "later-withdrawal",
      label: "Later use",
      purpose: "withdrawal",
      type: "withdrawal",
    });

    expect(store.getState().deleteAsset(asset.id)).toEqual({
      reason: "insufficientCash",
      status: "rejected",
    });
    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().trades).toEqual([sale]);
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

  it("persists pending valuation and resolves it later with manual provenance", () => {
    const storage = createMemoryJsonStorage();
    const now = () => new Date("2026-08-09T10:00:00.000Z");
    const pendingPosition: OpeningPosition = {
      assetId: asset.id,
      averageCostPrice: 1450,
      date: "2026-04-15",
      id: "opening-pending",
      quantity: 25,
    };
    const store = createPortfolioStore({ now, storage });

    expect(
      store.getState().recordOpeningPosition({
        asset,
        commandId: pendingPosition.id,
        openingPosition: pendingPosition,
      }),
    ).toMatchObject({ quoteCacheStatus: "notRequested", status: "applied" });

    const rehydrated = createPortfolioStore({ now, storage });
    expect(rehydrated.getState().openingPositions).toEqual([pendingPosition]);
    expect(rehydrated.getState().quoteCache).toEqual({});

    expect(
      rehydrated.getState().correctOpeningPosition({
        ...pendingPosition,
        manualValuation: {
          asOf: now().toISOString(),
          currency: "INR",
          price: 1678.25,
          provenance: "user",
          source: "manual",
        },
      }).status,
    ).toBe("applied");
    expect(createPortfolioStore({ now, storage }).getState().openingPositions[0])
      .toMatchObject({
        manualValuation: {
          asOf: "2026-08-09T10:00:00.000Z",
          currency: "INR",
          price: 1678.25,
          provenance: "user",
          source: "manual",
        },
      });
  });

  it("rejects contradictory legacy and explicit manual valuations", () => {
    const store = createPortfolioStore({
      now: () => new Date("2026-08-09T10:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });

    expect(() =>
      store.getState().recordOpeningPosition({
        asset,
        commandId: "opening-contradictory",
        openingPosition: {
          ...openingPosition,
          currentPrice: 1600,
          id: "opening-contradictory",
        },
      }),
    ).toThrow("Opening position contains invalid financial values.");
  });

  it("rejects a manual valuation whose currency differs from its asset", () => {
    const store = createPortfolioStore({
      now: () => new Date("2026-08-09T10:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });

    expect(() =>
      store.getState().recordOpeningPosition({
        asset,
        commandId: "opening-currency-mismatch",
        openingPosition: {
          ...openingPosition,
          id: "opening-currency-mismatch",
          manualValuation: {
            asOf: "2026-08-09T10:00:00.000Z",
            currency: "USD",
            price: 1600,
            provenance: "user",
            source: "manual",
          },
        },
      }),
    ).toThrow("Opening position contains invalid financial values.");
  });

  it("persists, reloads, corrects, and deletes an unknown-date opening position", () => {
    const storage = createMemoryJsonStorage();
    const unknownPosition: OpeningPosition = {
      ...openingPosition,
      date: null,
      id: "opening-unknown-date",
    };
    const store = createPortfolioStore({
      now: () => new Date("2026-07-20T10:00:00.000Z"),
      storage,
    });

    expect(
      store.getState().recordOpeningPosition({
        asset,
        commandId: unknownPosition.id,
        openingPosition: unknownPosition,
      }).status,
    ).toBe("applied");

    const rehydrated = createPortfolioStore({
      now: () => new Date("2026-07-20T10:00:00.000Z"),
      storage,
    });
    expect(rehydrated.getState().openingPositions).toEqual([
      {
        ...unknownPosition,
        recordedAt: "2026-07-20T10:00:00.000Z",
        recordedOn: "2026-07-20",
      },
    ]);

    expect(
      rehydrated.getState().correctOpeningPosition({
        ...unknownPosition,
        date: "2024-04-15",
      }).status,
    ).toBe("applied");
    expect(rehydrated.getState().openingPositions[0]?.date).toBe("2024-04-15");
    expect(
      rehydrated.getState().deleteOpeningPosition(unknownPosition.id).status,
    ).toBe("applied");
    expect(rehydrated.getState().openingPositions).toEqual([]);
  });

  it("owns unknown-date provenance at the durable write boundary", () => {
    const store = createPortfolioStore({
      now: () => new Date("2026-07-20T10:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });

    expect(
      store.getState().recordOpeningPosition({
        asset,
        commandId: "opening-invalid-unknown",
        openingPosition: {
          ...openingPosition,
          date: null,
          id: "opening-invalid-unknown",
          recordedAt: "2020-01-01T00:00:00.000Z",
          recordedOn: "2020-01-01",
        },
      }).status,
    ).toBe("applied");
    expect(store.getState().openingPositions[0]).toMatchObject({
      date: null,
      recordedAt: "2026-07-20T10:00:00.000Z",
      recordedOn: "2026-07-20",
    });
  });

  it("rebuilds automatic history when a known date becomes unknown", () => {
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
      id: "snapshot-auto-april-unknown-correction",
      month: "2026-04",
    };

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().addMonthlySnapshot(autoSnapshot);

    const result = store.getState().correctOpeningPosition({
      ...openingPosition,
      date: null,
    });

    expect(result).toMatchObject({ refreshedMonths: [], status: "applied" });
    expect(store.getState().monthlySnapshots).toEqual([]);
    expect(store.getState().openingPositions[0]).toMatchObject({
      date: null,
      recordedOn: "2026-07-22",
    });
  });

  it("rebuilds automatic history when an unknown date becomes known", () => {
    const store = createPortfolioStore({
      now: () => new Date(2026, 6, 22, 12),
      storage: createMemoryJsonStorage(),
    });

    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({ ...openingPosition, date: null });

    const result = store.getState().correctOpeningPosition({
      ...store.getState().openingPositions[0],
      date: "2026-04-15",
    });

    expect(result).toMatchObject({
      refreshedMonths: expect.arrayContaining([
        "2026-04",
        "2026-05",
        "2026-06",
      ]),
      status: "applied",
    });
    expect(store.getState().openingPositions[0]).toEqual({
      ...openingPosition,
      date: "2026-04-15",
    });
  });

  it("reuses and updates a canonical asset when recording an opening position", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    const duplicateCandidate = {
      ...asset,
      id: "asset-provider-candidate",
      name: "Reliance Industries Limited",
      sectorType: "energy" as const,
    };
    const candidatePosition = {
      ...openingPosition,
      assetId: duplicateCandidate.id,
      id: "opening-provider-candidate",
    };
    const candidateQuote = {
      ...quote,
      assetId: duplicateCandidate.id,
      price: 3000,
    };

    const result = store.getState().recordOpeningPosition({
      asset: duplicateCandidate,
      commandId: candidatePosition.id,
      openingPosition: candidatePosition,
      quote: candidateQuote,
    });

    expect(result).toMatchObject({
      asset: {
        id: asset.id,
        name: "Reliance Industries Limited",
        sectorType: "energy",
      },
      openingPosition: {
        assetId: asset.id,
        id: candidatePosition.id,
      },
      quote: {
        assetId: asset.id,
        price: 3000,
      },
      status: "applied",
    });
    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().assets[0]).toMatchObject({
      id: asset.id,
      name: "Reliance Industries Limited",
      sectorType: "energy",
    });
    expect(store.getState().openingPositions[0]?.assetId).toBe(asset.id);
    expect(store.getState().quoteCache[asset.id]).toMatchObject({
      assetId: asset.id,
      price: 3000,
    });
    expect(
      store.getState().quoteCache[duplicateCandidate.id],
    ).toBeUndefined();
  });

  it("rejects an opening position candidate with conflicting canonical identities", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const secondAsset = {
      ...asset,
      id: "asset-hdfc",
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    store.getState().addAsset(asset);
    store.getState().addAsset(secondAsset);
    const ambiguousAsset = {
      ...asset,
      id: "asset-ambiguous",
      quoteSourceId: asset.quoteSourceId,
      ticker: secondAsset.ticker,
    };
    const ambiguousPosition = {
      ...openingPosition,
      assetId: ambiguousAsset.id,
      id: "opening-ambiguous",
    };

    expect(() =>
      store.getState().recordOpeningPosition({
        asset: ambiguousAsset,
        commandId: ambiguousPosition.id,
        openingPosition: ambiguousPosition,
      }),
    ).toThrow("Asset identity already exists.");
    expect(store.getState().assets).toHaveLength(2);
    expect(store.getState().openingPositions).toEqual([]);
  });

  it("invalidates old quote history when canonical quote identity changes", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);
    store.getState().upsertQuote(quote);
    store.getState().upsertHistoricalQuote({
      asOfMonth: "2026-04",
      assetId: asset.id,
      basis: "historical-close",
      currency: "INR",
      fetchedAt: "2026-05-01T00:00:00.000Z",
      price: 2800,
      source: "yahoo",
    });
    const correctedAsset = {
      ...asset,
      quoteSourceId: "RELIANCE-BSE",
      ticker: "RELIANCE.BO",
    };
    const nextPosition = {
      ...openingPosition,
      id: "opening-corrected-identity",
    };
    const nextQuote = {
      ...quote,
      asOf: "2026-07-20T10:00:00.000Z",
      price: 3100,
    };

    store.getState().recordOpeningPosition({
      asset: correctedAsset,
      commandId: nextPosition.id,
      openingPosition: nextPosition,
      quote: nextQuote,
    });

    expect(store.getState().assets[0]).toMatchObject({
      id: asset.id,
      quoteSourceId: "RELIANCE-BSE",
      ticker: "RELIANCE.BO",
    });
    expect(store.getState().historicalQuoteCache[asset.id]).toBeUndefined();
    expect(store.getState().quoteCache[asset.id]).toMatchObject({
      price: 3100,
    });
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

  it("reuses a canonical asset for a funded buy", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 100000 });
    const duplicateCandidate = {
      ...asset,
      id: "asset-provider-candidate",
    };
    const candidateTrade = {
      ...trade,
      assetId: duplicateCandidate.id,
      pricePerUnit: 100,
      quantity: 800,
      totalValue: 80000,
    };

    const result = store.getState().recordFundedBuy({
      asset: duplicateCandidate,
      cashLabel: "Reliance Industries purchase",
      trade: candidateTrade,
    });

    expect(result).toMatchObject({
      isValid: true,
      trade: {
        assetId: asset.id,
      },
    });
    expect(store.getState().assets).toEqual([asset]);
    expect(store.getState().trades[0]?.assetId).toBe(asset.id);
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

  it("rejects a funded buy that exceeds available cash by exactly one paise", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ ...cashEntry, amount: 5000 });

    expect(
      store.getState().recordFundedBuy({
        cashLabel: "One paise over",
        trade: {
          ...trade,
          pricePerUnit: 5000.01,
          quantity: 1,
          totalValue: 5000.01,
        },
      }),
    ).toEqual({
      availableCash: 5000,
      isValid: false,
      reason: "insufficientCash",
      requiredCash: 5000.01,
    });
    expect(store.getState().trades).toEqual([]);
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

  it("rejects a sale that exceeds available units by exactly one quantity quantum", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition({
      ...openingPosition,
      quantity: 1,
    });

    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "One quantum over",
        trade: {
          ...trade,
          id: "trade-sale-quantum",
          pricePerUnit: 100,
          quantity: 1.00000001,
          totalValue: 100,
          type: "sell",
        },
      }),
    ).toEqual({
      availableUnits: 1,
      isValid: false,
      reason: "insufficientUnits",
      requiredUnits: 1.00000001,
    });
    expect(store.getState().trades).toEqual([]);
  });

  it("rejects non-finite linked trades without throwing or mutating", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addCashEntry(cashEntry);

    expect(
      store.getState().recordFundedBuy({
        cashLabel: "Invalid buy",
        trade: { ...trade, quantity: Number.NaN },
      }),
    ).toEqual({ isValid: false, reason: "invalidTrade" });
    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "Invalid sale",
        trade: {
          ...trade,
          id: "trade-invalid-sale",
          pricePerUnit: Number.POSITIVE_INFINITY,
          type: "sell",
        },
      }),
    ).toEqual({ isValid: false, reason: "invalidTrade" });
    expect(store.getState().trades).toEqual([]);
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

  it("rejects a linked sale that becomes invalid after record normalization", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addOpeningPosition(openingPosition);

    expect(
      store.getState().recordSaleWithProceeds({
        cashLabel: "Rounded-away proceeds",
        trade: {
          ...trade,
          fees: 799.999,
          id: "trade-rounded-away-sale",
          pricePerUnit: 800,
          quantity: 1,
          totalValue: 0.001,
          type: "sell",
        },
      }),
    ).toEqual({ isValid: false, reason: "invalidTrade" });
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([]);
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
      store.getState().correctTrade({ ...correction, quantity: Number.NaN }),
    ).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(
      store.getState().correctTrade({
        ...correction,
        pricePerUnit: Number.POSITIVE_INFINITY,
      }),
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
    store.getState().upsertQuote(quote);
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
      ppfAccounts: [],
      ppfLedgerEntries: [],
      preferences: createDefaultPreferences(),
      schemaVersion: 8,
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

  it("migrates legacy opening prices without changing their value", () => {
    const storage = createMemoryJsonStorage();
    storage.setItem(portfolioStorageKey, {
      assets: [asset],
      openingPositions: [
        {
          assetId: asset.id,
          averageCostPrice: 1450,
          currentPrice: 1678.25,
          date: "2026-04-15",
          id: "opening-legacy-price",
          quantity: 25,
        },
      ],
      schemaVersion: 6,
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState().openingPositions).toEqual([
      {
        assetId: asset.id,
        averageCostPrice: 1450,
        date: "2026-04-15",
        id: "opening-legacy-price",
        manualValuation: {
          asOf: null,
          currency: "INR",
          price: 1678.25,
          provenance: "legacy",
          source: "manual",
        },
        quantity: 25,
      },
    ]);
    expect(store.getState().schemaVersion).toBe(8);
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
    expect(store.getState().schemaVersion).toBe(8);
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
    expect(store.getState().schemaVersion).toBe(8);
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
    expect(store.getState().schemaVersion).toBe(8);
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
    expect(store.getState().schemaVersion).toBe(8);
  });

  it("migrates legacy automatic zero income to unknown without changing manual values", () => {
    const storage = createMemoryJsonStorage();
    const automaticZero: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-06-01T00:00:00.000Z",
        priceBasis: "historical-close",
        source: "auto",
        warnings: [],
      },
      id: "snapshot-auto-zero",
      salary: 0,
    };
    const manualZero: MonthlySnapshot = {
      ...monthlySnapshot,
      generated: {
        generatedAt: "2026-06-01T00:00:00.000Z",
        priceBasis: "manual-fallback",
        source: "manual",
        warnings: [],
      },
      id: "snapshot-manual-zero",
      salary: 0,
    };
    const automaticIncome: MonthlySnapshot = {
      ...automaticZero,
      id: "snapshot-auto-income",
      salary: 160000,
    };
    storage.setItem(portfolioStorageKey, {
      assets: [],
      cashEntries: [],
      monthlySnapshots: [automaticZero, manualZero, automaticIncome],
      openingPositions: [],
      preferences: createDefaultPreferences(),
      schemaVersion: 5,
      trades: [],
    });

    const snapshots = createPortfolioStore({ storage }).getState()
      .monthlySnapshots;

    expect(
      snapshots.find((item) => item.id === automaticZero.id)?.salary,
    ).toBeUndefined();
    expect(snapshots.find((item) => item.id === manualZero.id)?.salary).toBe(0);
    expect(
      snapshots.find((item) => item.id === automaticIncome.id)?.salary,
    ).toBe(160000);
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

  it("migrates V7 portfolios with empty PPF collections", () => {
    const storage = createMemoryJsonStorage({
      [portfolioStorageKey]: {
        assets: [],
        cashEntries: [],
        monthlySnapshots: [],
        openingPositions: [],
        preferences: createDefaultPreferences(),
        schemaVersion: 7,
        trades: [],
      },
    });

    const store = createPortfolioStore({ storage });

    expect(store.getState()).toMatchObject({
      ppfAccounts: [],
      ppfLedgerEntries: [],
      schemaVersion: 8,
    });
  });

  it("persists PPF accounts and ledger entries across restart", () => {
    const storage = createMemoryJsonStorage();
    const now = () => new Date("2026-08-15T10:00:00.000Z");
    const store = createPortfolioStore({ now, storage });

    expect(store.getState().addPpfAccount(ppfAccount)).toMatchObject({
      status: "applied",
    });
    expect(
      store.getState().addPpfLedgerEntry(ppfContribution("ppf-entry-1", 500)),
    ).toMatchObject({ status: "applied" });

    const restarted = createPortfolioStore({ now, storage });
    expect(restarted.getState().ppfAccounts).toEqual([ppfAccount]);
    expect(restarted.getState().ppfLedgerEntries).toEqual([
      ppfContribution("ppf-entry-1", 500),
    ]);
  });

  it("rejects orphan, checkpoint-hidden, and negative PPF ledger events", () => {
    const store = createPortfolioStore({
      now: () => new Date("2026-08-15T10:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });

    expect(
      store.getState().addPpfLedgerEntry(ppfContribution("orphan", 500)),
    ).toEqual({ reason: "accountNotFound", status: "rejected" });
    store.getState().addPpfAccount(ppfAccount);
    expect(
      store
        .getState()
        .addPpfLedgerEntry(ppfContribution("hidden", 500, "2026-07-31")),
    ).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(
      store.getState().addPpfLedgerEntry({
        accountId: ppfAccount.id,
        amount: 100_050,
        date: "2026-08-01",
        id: "too-large-withdrawal",
        recordedAt: "2026-08-01T10:00:00.000Z",
        type: "withdrawal",
      }),
    ).toEqual({ reason: "invalidTimeline", status: "rejected" });
    expect(store.getState().ppfLedgerEntries).toEqual([]);
  });

  it("rejects corrections and deletions that would invalidate the PPF timeline", () => {
    const store = createPortfolioStore({
      now: () => new Date("2026-08-15T10:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });
    store.getState().addPpfAccount(ppfAccount);
    const contribution = ppfContribution("contribution", 500);
    const withdrawal: PpfLedgerEntry = {
      accountId: ppfAccount.id,
      amount: 100_200,
      date: "2026-08-02",
      id: "withdrawal",
      recordedAt: "2026-08-02T10:00:00.000Z",
      type: "withdrawal",
    };
    store.getState().addPpfLedgerEntry(contribution);
    store.getState().addPpfLedgerEntry(withdrawal);

    expect(store.getState().deletePpfLedgerEntry(contribution.id)).toEqual({
      reason: "invalidTimeline",
      status: "rejected",
    });
    expect(
      store.getState().correctPpfLedgerEntry({ ...withdrawal, amount: 101_000 }),
    ).toEqual({ reason: "invalidTimeline", status: "rejected" });
    expect(store.getState().ppfLedgerEntries).toEqual([contribution, withdrawal]);
  });

  it("preserves a completed contribution extension when lifecycle status changes", () => {
    const store = createPortfolioStore({
      now: () => new Date("2042-04-01T10:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });
    const extendedAccount: PpfAccount = {
      ...ppfAccount,
      balanceAsOf: "2036-03-31",
      confirmedExtensionStartFinancialYear: 2036,
      status: "extendedWithContributions",
    };
    expect(store.getState().addPpfAccount(extendedAccount)).toMatchObject({
      status: "applied",
    });
    expect(
      store.getState().addPpfLedgerEntry({
        accountId: extendedAccount.id,
        amount: 500,
        date: "2036-04-01",
        id: "extension-contribution",
        recordedAt: "2036-04-01T10:00:00.000Z",
        type: "contribution",
      }),
    ).toMatchObject({ status: "applied" });

    expect(
      store.getState().correctPpfAccount({
        ...extendedAccount,
        status: "matured",
      }),
    ).toMatchObject({ status: "applied" });
    expect(store.getState().ppfAccounts[0]).toMatchObject({
      confirmedExtensionStartFinancialYear: 2036,
      status: "matured",
    });
  });

  it("deletes a PPF account and its ledger atomically", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({
      now: () => new Date("2026-08-15T10:00:00.000Z"),
      storage,
    });
    store.getState().addPpfAccount(ppfAccount);
    store.getState().addPpfLedgerEntry(ppfContribution("entry", 500));

    expect(store.getState().deletePpfAccount(ppfAccount.id)).toMatchObject({
      deletedEntries: 1,
      status: "applied",
    });
    expect(store.getState()).toMatchObject({
      ppfAccounts: [],
      ppfLedgerEntries: [],
    });
    expect(createPortfolioStore({ storage }).getState()).toMatchObject({
      ppfAccounts: [],
      ppfLedgerEntries: [],
    });
  });

  it("keeps PPF memory unchanged when persistence fails", () => {
    const baseStorage = createMemoryJsonStorage();
    const storage = {
      ...baseStorage,
      setItem: () => {
        throw new Error("storage full");
      },
    };
    const store = createPortfolioStore({
      now: () => new Date("2026-08-15T10:00:00.000Z"),
      storage,
    });

    expect(() => store.getState().addPpfAccount(ppfAccount)).toThrow(
      "storage full",
    );
    expect(store.getState().ppfAccounts).toEqual([]);
  });
});
