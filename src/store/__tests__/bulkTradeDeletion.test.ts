import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, BuyTrade, MonthlySnapshot, Trade } from "@/src/types";

const now = () => new Date("2026-09-14T10:00:00.000Z");
const asset = (id: string, name: string): Asset => ({
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id,
  instrumentType: "stock",
  name,
  sectorType: "other",
  symbol: id.toUpperCase(),
  ticker: `${id.toUpperCase()}.NS`,
});
const buy = (id: string, assetId: string, date: string, quantity = 2): BuyTrade => ({
  assetId,
  date,
  id,
  pricePerUnit: 100,
  quantity,
  totalValue: quantity * 100,
  type: "buy",
});
const snapshot = (id: string, month: string, automatic: boolean): MonthlySnapshot => ({
  cashValue: 0,
  cryptoValue: 0,
  debtValue: 0,
  equityValue: 200,
  generated: automatic ? {
    generatedAt: "2026-09-01T00:00:00.000Z",
    priceBasis: "latest-local-fallback",
    source: "auto",
    warnings: [],
  } : undefined,
  id,
  investedValue: 200,
  month,
  monthlyInvestment: 200,
  portfolioValue: 200,
});

describe("bulk transaction deletion", () => {
  it("previews and atomically removes selected trades, linked cash, and automatic history", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    const firstAsset = asset("first", "First Limited");
    const secondAsset = asset("second", "Second Limited");
    const firstBuy = buy("first-buy", firstAsset.id, "2026-04-10");
    const importedBuy: Trade = {
      ...buy("imported-buy", secondAsset.id, "2026-05-10", 3),
      importProvenance: {
        fingerprint: "synthetic-import",
        importBatchId: "batch-one",
        originalRowNumber: 2,
        sourceFormat: "zerodha-tradebook",
        sourceVersion: "eq-v1",
      },
    };
    const unrelated = buy("unrelated", secondAsset.id, "2026-06-10");
    store.getState().addAsset(firstAsset);
    store.getState().addAsset(secondAsset);
    store.getState().addCashEntry({ amount: 1000, date: "2026-04-01", id: "cash", label: "Cash", purpose: "capitalContribution", type: "addition" });
    store.getState().recordFundedBuy({ cashLabel: "First purchase", trade: firstBuy });
    store.getState().addTrade(importedBuy);
    store.getState().addTrade(unrelated);
    store.getState().addMonthlySnapshot(snapshot("auto-april", "2026-04", true));
    store.getState().addMonthlySnapshot(snapshot("manual-may", "2026-05", false));

    expect(store.getState().previewTradeDeletion([firstBuy.id, importedBuy.id])).toEqual({
      impact: expect.objectContaining({
        affectedHoldings: expect.arrayContaining([
          expect.objectContaining({ assetId: firstAsset.id, linkedCashEntries: 1, transactions: 1 }),
          expect.objectContaining({ assetId: secondAsset.id, linkedCashEntries: 0, transactions: 1 }),
        ]),
        automaticSnapshots: 1,
        earliestAffectedMonth: "2026-04",
        importedTransactions: 1,
        linkedCashEntries: 1,
        transactions: 2,
      }),
      status: "ready",
    });

    expect(store.getState().deleteTrades([firstBuy.id, importedBuy.id])).toMatchObject({ status: "applied" });
    expect(store.getState().trades).toEqual([unrelated]);
    expect(store.getState().cashEntries).toEqual([expect.objectContaining({ id: "cash" })]);
    expect(store.getState().monthlySnapshots).toContainEqual(expect.objectContaining({ id: "manual-may" }));

    const restarted = createPortfolioStore({ now, storage }).getState();
    expect(restarted.trades).toEqual([unrelated]);
    expect(restarted.cashEntries).toEqual([expect.objectContaining({ id: "cash" })]);

    const backup = store.getState().captureBackup().payload;
    const restored = createPortfolioStore({ now, storage: createMemoryJsonStorage() });
    restored.getState().replaceFromBackup(backup, restored.getState().getBackupRevision());
    expect(restored.getState().trades).toEqual([unrelated]);
    expect(restored.getState().cashEntries).toEqual([expect.objectContaining({ id: "cash" })]);
  });

  it("blocks the entire selection when removing an acquisition would oversell", () => {
    const store = createPortfolioStore({ now, storage: createMemoryJsonStorage() });
    const holding = asset("holding", "Holding Limited");
    const acquisition = buy("buy", holding.id, "2026-04-10", 5);
    const sale: Trade = { ...buy("sell", holding.id, "2026-05-10", 4), type: "sell" };
    store.getState().addAsset(holding);
    store.getState().addTrade(acquisition);
    store.getState().addTrade(sale);

    expect(store.getState().previewTradeDeletion([acquisition.id])).toEqual({
      blockingAssetIds: [holding.id],
      reason: "oversold",
      status: "rejected",
    });
    expect(store.getState().deleteTrades([acquisition.id])).toEqual({
      blockingAssetIds: [holding.id],
      reason: "oversold",
      status: "rejected",
    });
    expect(store.getState().trades).toEqual([acquisition, sale]);
  });

  it("leaves memory and durable data unchanged when persistence fails", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    const holding = asset("holding", "Holding Limited");
    const transaction = buy("buy", holding.id, "2026-04-10");
    store.getState().addAsset(holding);
    store.getState().addTrade(transaction);
    const before = store.getState();
    storage.setItem = () => { throw new Error("simulated bulk deletion failure"); };

    expect(() => store.getState().deleteTrades([transaction.id])).toThrow("simulated bulk deletion failure");
    expect(store.getState().trades).toEqual(before.trades);
    expect(store.getState().assets).toEqual(before.assets);
    expect(store.getState().cashEntries).toEqual(before.cashEntries);
    expect(store.getState().monthlySnapshots).toEqual(before.monthlySnapshots);
  });
});
