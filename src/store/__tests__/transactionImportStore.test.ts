import {
  createPortfolioStore,
  historicalQuoteCacheStorageKey,
  portfolioSchemaVersion,
  portfolioStorageKey,
  type TransactionImportCommandInput,
} from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type {
  Asset,
  CashEntry,
  MonthlySnapshot,
  OpeningPosition,
  Trade,
} from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-1",
  isin: "INE000000001",
  name: "Example",
  symbol: "EXAMPLE",
  ticker: "EXAMPLE.NS",
};

const openingPosition: OpeningPosition = {
  assetId: asset.id,
  averageCostPrice: 100,
  date: null,
  id: "opening-1",
  quantity: 10,
  recordedAt: "2025-03-02T00:00:00.000Z",
  recordedOn: "2025-03-02",
};

const cashEntry: CashEntry = {
  amount: 50_000,
  date: "2025-01-01",
  id: "cash-1",
  label: "Existing cash",
  purpose: "capitalContribution",
  type: "addition",
};

function importedTrade(input: Partial<Trade> = {}): Trade {
  return {
    assetId: asset.id,
    date: "2025-04-01",
    id: "batch-1:row-2",
    importProvenance: {
      externalId: "order-1",
      fingerprint: "fingerprint-1",
      importBatchId: "batch-1",
      originalRowNumber: 2,
      sourceFormat: "cogvest-transactions",
      sourceVersion: "1",
    },
    pricePerUnit: 120,
    quantity: 2,
    totalValue: 240,
    type: "buy",
    ...input,
  } as Trade;
}

function seedStore() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({
    now: () => new Date("2026-08-23T00:00:00.000Z"),
    storage,
  });
  store.getState().addAsset(asset);
  store.getState().addCashEntry(cashEntry);
  store.getState().addOpeningPosition(openingPosition);
  return { storage, store };
}

describe("transaction import persistence", () => {
  it("atomically persists supplemental history and never changes Cash Ledger", () => {
    const { storage, store } = seedStore();
    const command: TransactionImportCommandInput = {
      assets: [asset],
      commandId: "batch-1",
      cutovers: [
        { measuredAsOf: "2025-03-01", openingPositionId: openingPosition.id },
      ],
      mode: "supplemental",
      replaceOpeningPositionIds: [],
      transactions: [importedTrade()],
    };
    const cashBefore = store.getState().cashEntries;

    expect(store.getState().recordTransactionImport(command)).toEqual({
      added: 1,
      removedOpeningPositions: 0,
      status: "applied",
      updatedCutovers: 1,
    });
    expect(store.getState().cashEntries).toEqual(cashBefore);
    expect(store.getState().openingPositions[0].measuredAsOf).toBe("2025-03-01");
    expect(store.getState().trades).toEqual([importedTrade()]);
    expect(store.getState().recordTransactionImport(command).status).toBe(
      "alreadyApplied",
    );
    expect(() =>
      store.getState().recordTransactionImport({
        ...command,
        transactions: [importedTrade({ quantity: 3, totalValue: 360 })],
      }),
    ).toThrow("partial transaction import batch");
    expect(() =>
      store.getState().recordTransactionImport({
        ...command,
        transactions: [importedTrade({ notes: "Changed after import" })],
      }),
    ).toThrow("partial transaction import batch");

    const restarted = createPortfolioStore({ storage });
    expect(restarted.getState().schemaVersion).toBe(portfolioSchemaVersion);
    expect(restarted.getState().cashEntries).toEqual(cashBefore);
    expect(restarted.getState().trades).toEqual([importedTrade()]);
  });

  it("independently rejects supplemental transactions at or before the cutoff", () => {
    const { store } = seedStore();

    expect(() =>
      store.getState().recordTransactionImport({
        assets: [asset],
        commandId: "batch-1",
        cutovers: [
          { measuredAsOf: "2025-03-01", openingPositionId: openingPosition.id },
        ],
        mode: "supplemental",
        replaceOpeningPositionIds: [],
        transactions: [importedTrade({ date: "2025-03-01" })],
      }),
    ).toThrow("after the confirmed holdings cutoff");
    expect(store.getState().trades).toEqual([]);
  });

  it("invalidates automatic snapshots from the baseline's prior effective month", () => {
    const store = createPortfolioStore({
      now: () => new Date("2026-08-23T00:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });
    store.getState().addAsset(asset);
    store.getState().addCashEntry(cashEntry);
    store.getState().addOpeningPosition({
      ...openingPosition,
      date: "2025-03-02",
    });
    const staleApril: MonthlySnapshot = {
      cashValue: 0,
      cryptoValue: 0,
      debtValue: 0,
      equityValue: 1000,
      generated: {
        generatedAt: "2025-05-01T00:00:00.000Z",
        priceBasis: "manual-fallback",
        source: "auto",
        warnings: [],
      },
      id: "stale-april",
      investedValue: 1000,
      month: "2025-04",
      monthlyInvestment: 0,
      portfolioValue: 1000,
      salary: 0,
    };
    store.getState().addMonthlySnapshot(staleApril);

    store.getState().recordTransactionImport({
      assets: [asset],
      commandId: "batch-1",
      cutovers: [
        { measuredAsOf: "2025-05-01", openingPositionId: openingPosition.id },
      ],
      mode: "supplemental",
      replaceOpeningPositionIds: [],
      transactions: [importedTrade({ date: "2025-06-01" })],
    });

    expect(
      store.getState().monthlySnapshots.find(({ month }) => month === "2025-04"),
    ).toMatchObject({
      cashValue: 50000,
      equityValue: 0,
      id: staleApril.id,
      portfolioValue: 50000,
    });
  });

  it("independently rejects ambiguous same-day ordering across batches", () => {
    const { store } = seedStore();
    store.getState().addTrade({
      assetId: asset.id,
      date: "2025-04-01",
      id: "manual-buy",
      pricePerUnit: 100,
      quantity: 1,
      totalValue: 100,
      type: "buy",
    });

    expect(() =>
      store.getState().recordTransactionImport({
        assets: [asset],
        commandId: "batch-1",
        cutovers: [
          { measuredAsOf: "2025-03-01", openingPositionId: openingPosition.id },
        ],
        mode: "supplemental",
        replaceOpeningPositionIds: [],
        transactions: [
          importedTrade({
            date: "2025-04-01",
            id: "batch-1:row-3",
            pricePerUnit: 120,
            quantity: 1,
            totalValue: 120,
            type: "sell",
          }),
        ],
      }),
    ).toThrow("ambiguous same-day ordering");
    expect(store.getState().trades).toEqual([
      expect.objectContaining({ id: "manual-buy" }),
    ]);
  });

  it("replaces an opening baseline only when full history reconciles exactly", () => {
    const { store } = seedStore();
    const historical = importedTrade({
      date: "2024-01-01",
      pricePerUnit: 100,
      quantity: 10,
      totalValue: 1000,
    });

    expect(
      store.getState().recordTransactionImport({
        assets: [asset],
        commandId: "batch-1",
        cutovers: [
          { measuredAsOf: "2025-03-01", openingPositionId: openingPosition.id },
        ],
        mode: "fullHistory",
        replaceOpeningPositionIds: [openingPosition.id],
        transactions: [historical],
      }),
    ).toEqual(
      expect.objectContaining({ removedOpeningPositions: 1, status: "applied" }),
    );
    expect(store.getState().openingPositions).toEqual([]);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
  });

  it("rejects a full-history command that leaves an affected baseline in place", () => {
    const { store } = seedStore();

    expect(() =>
      store.getState().recordTransactionImport({
        assets: [asset],
        commandId: "batch-1",
        cutovers: [
          { measuredAsOf: "2025-03-01", openingPositionId: openingPosition.id },
        ],
        mode: "fullHistory",
        replaceOpeningPositionIds: [],
        transactions: [
          importedTrade({
            date: "2024-01-01",
            pricePerUnit: 100,
            quantity: 10,
            totalValue: 1000,
          }),
        ],
      }),
    ).toThrow("must exactly replace every affected opening position");
    expect(store.getState().openingPositions).toHaveLength(1);
    expect(store.getState().trades).toEqual([]);
  });

  it("rejects mismatched replacement and duplicate external identities", () => {
    const { store } = seedStore();
    const openingsBefore = store.getState().openingPositions;
    expect(() =>
      store.getState().recordTransactionImport({
        assets: [asset],
        commandId: "batch-1",
        cutovers: [
          { measuredAsOf: "2025-03-01", openingPositionId: openingPosition.id },
        ],
        mode: "fullHistory",
        replaceOpeningPositionIds: [openingPosition.id],
        transactions: [
          importedTrade({
            date: "2024-01-01",
            pricePerUnit: 100,
            quantity: 9,
            totalValue: 900,
          }),
        ],
      }),
    ).toThrow("no longer matches");
    expect(store.getState().openingPositions).toEqual(openingsBefore);
    expect(store.getState().trades).toEqual([]);

    const conflicting = importedTrade({ id: "batch-1:row-3" });
    conflicting.importProvenance = {
      ...conflicting.importProvenance!,
      fingerprint: "different",
      originalRowNumber: 3,
    };
    expect(() =>
      store.getState().recordTransactionImport({
        assets: [asset],
        commandId: "batch-1",
        cutovers: [],
        mode: "supplemental",
        replaceOpeningPositionIds: [],
        transactions: [importedTrade(), conflicting],
      }),
    ).toThrow("identity conflicts");
  });

  it("rolls back memory and durable state when journaled persistence fails", () => {
    const { storage, store } = seedStore();
    const openingsBefore = store.getState().openingPositions;
    const originalPortfolio = storage.getRawItem(portfolioStorageKey);
    const originalSetItem = storage.setItem;
    let failed = false;
    storage.setItem = (key, value) => {
      if (key === historicalQuoteCacheStorageKey && !failed) {
        failed = true;
        throw new Error("simulated transaction import failure");
      }
      originalSetItem(key, value);
    };

    expect(() =>
      store.getState().recordTransactionImport({
        assets: [asset],
        commandId: "batch-1",
        cutovers: [
          { measuredAsOf: "2025-03-01", openingPositionId: openingPosition.id },
        ],
        mode: "supplemental",
        replaceOpeningPositionIds: [],
        transactions: [importedTrade()],
      }),
    ).toThrow("simulated transaction import failure");
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().openingPositions).toEqual(openingsBefore);
    expect(store.getState().cashEntries).toEqual([cashEntry]);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(originalPortfolio);
  });
});
