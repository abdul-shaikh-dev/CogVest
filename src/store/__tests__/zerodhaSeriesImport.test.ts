import { reconcileTransactions } from "@/src/domain/transactionReconciliation";
import {
  parseZerodhaTradebook,
  zerodhaTradebookHeaders,
} from "@/src/domain/zerodhaTradebook";
import {
  buildTransactionImportPlan,
  type TransactionCsvResolution,
} from "@/src/features/transactionImport/transactionImport";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { Asset } from "@/src/types";

const now = () => new Date("2025-02-01T00:00:00.000Z");
const nseAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "synthetic-nse",
  isin: "INE000000001",
  name: "Synthetic NSE",
  symbol: "SYNTHNSE",
  ticker: "SYNTHNSE.NS",
};
const bseAsset: Asset = {
  ...nseAsset,
  exchange: "BSE",
  id: "synthetic-bse",
  isin: "INE000000002",
  name: "Synthetic BSE",
  symbol: "SYNTHBSE",
  ticker: "SYNTHBSE.BO",
};

function csvRow(
  day: number,
  series: string,
  type: "buy" | "sell",
  quantity: number,
  asset = nseAsset,
) {
  const date = `2025-01-${String(day).padStart(2, "0")}`;
  return [
    asset.symbol, asset.isin, date, asset.exchange, "EQ", series, type,
    "false", quantity, 100, `synthetic-trade-${day}`,
    `synthetic-order-${day}`, `${date}T10:00:00`,
  ].join(",");
}

function resolutions(sellQuantity = 2): TransactionCsvResolution[] {
  const parsed = parseZerodhaTradebook([
    zerodhaTradebookHeaders.join(","),
    csvRow(1, "EQ", "buy", 1),
    csvRow(2, "BE", "buy", 2),
    csvRow(3, "EQ", "sell", sellQuantity),
    csvRow(4, "B", "buy", 1, bseAsset),
  ].join("\n"), { fileIndex: 0, fileName: "synthetic.csv" });
  expect(parsed.errors).toEqual([]);
  expect(parsed.unsupportedEvents).toEqual([]);
  expect(parsed.rows).toHaveLength(4);
  return parsed.rows.map((row) => ({
    asset: row.isin === nseAsset.isin ? nseAsset : bseAsset,
    row,
    status: "ready",
  }));
}

function plan(
  state: PortfolioStoreState,
  rows = resolutions(),
  batchId = "synthetic-series-batch",
) {
  return buildTransactionImportPlan({
    batchId,
    mode: "fullHistory",
    now: now(),
    resolutions: rows,
    sourceCoverageConfirmed: true,
    state,
    unsupportedCount: 0,
  });
}

describe("Zerodha delivery-series import persistence", () => {
  it("reconciles EQ buy 1, BE buy 2, EQ sell 2 to one unit", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const result = plan(store.getState());
    expect(result.errors).toEqual([]);
    expect(result.command).toBeDefined();
    expect(result.holdings.find((h) => h.asset.id === nseAsset.id)?.reconciliation)
      .toMatchObject({ quantity: 1, isExact: true, oversoldTransactionIds: [] });

    expect(store.getState().recordTransactionImport(result.command!).added).toBe(4);
    expect(reconcileTransactions({
      transactions: store.getState().trades.filter((t) => t.assetId === nseAsset.id),
    })).toMatchObject({ quantity: 1, isExact: true });
    expect(store.getState().trades.find((t) =>
      t.importProvenance?.externalId === "synthetic-trade-2",
    )?.importProvenance?.originalDescription).toBe("Zerodha NSE series BE");
  });

  it("persists BSE B and plans a duplicate no-op after reload", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    const result = plan(store.getState());
    expect(result.command).toBeDefined();
    store.getState().recordTransactionImport(result.command!);

    const reloaded = createPortfolioStore({ storage, now });
    expect(reloaded.getState().trades).toEqual(store.getState().trades);
    expect(reloaded.getState().trades.find((t) => t.assetId === bseAsset.id))
      .toMatchObject({
        quantity: 1,
        type: "buy",
        importProvenance: {
          sourceExchange: "BSE",
          originalDescription: "Zerodha BSE series B",
        },
      });
    const before = reloaded.getState();
    const duplicate = plan(before, resolutions(), "synthetic-reimport");
    expect(duplicate).toMatchObject({
      duplicates: 4,
      conflicts: 0,
      errors: [],
      summary: { additions: 0 },
    });
    expect(duplicate.command).toBeUndefined();
    expect(reloaded.getState().recordTransactionImport(result.command!).status)
      .toBe("alreadyApplied");
    expect(reloaded.getState()).toBe(before);
  });

  it("rejects a true oversell without writing any part of the batch", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    store.getState().addCashEntry({
      id: "synthetic-cash", amount: 500, date: "2025-01-01",
      label: "Existing cash", purpose: "capitalContribution", type: "addition",
    });
    const invalidPlan = plan(store.getState(), resolutions(4));
    expect(invalidPlan.errors.map((error) => error.code)).toEqual(["wouldOversell"]);
    expect(invalidPlan.command).toBeUndefined();

    const validPlan = plan(store.getState());
    expect(validPlan.command).toBeDefined();
    const command = validPlan.command!;
    const before = store.getState();
    const persistedBefore = createPortfolioStore({ storage, now }).getState();
    const writes = [
      jest.spyOn(storage, "setItem"),
      jest.spyOn(storage, "setRawItem"),
      jest.spyOn(storage, "removeItem"),
    ];
    // Bypass planning to verify the store's independent all-or-none guard.
    expect(() => store.getState().recordTransactionImport({
      ...command,
      transactions: command.transactions.map((trade) => trade.type === "sell"
        ? { ...trade, quantity: 4, totalValue: 4 * trade.pricePerUnit }
        : trade),
    })).toThrow("Transaction import would oversell a holding.");
    expect(store.getState()).toBe(before);
    for (const write of writes) {
      expect(write).not.toHaveBeenCalled();
      write.mockRestore();
    }
    const reloaded = createPortfolioStore({ storage, now }).getState();
    expect(reloaded.assets).toEqual(persistedBefore.assets);
    expect(reloaded.trades).toEqual(persistedBefore.trades);
    expect(reloaded.cashEntries).toEqual(persistedBefore.cashEntries);
    expect(reloaded.openingPositions).toEqual(persistedBefore.openingPositions);
    expect(reloaded.monthlySnapshots).toEqual(persistedBefore.monthlySnapshots);
  });
});
