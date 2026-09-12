import { calculateHolding } from "../calculations/holdings";
import { orderedStockSplits, positionQuantity } from "../stockSplits";
import { assertCatalogSplits, withVerifiedStockSplits } from "../stockSplitCatalog";
import { parseTransactionCsv, transactionCsvHeaders } from "../transactionCsv";
import { validateBackupPayload } from "../portfolioBackup";
import { buildTransactionImportPlan } from "@/src/features/transactionImport/transactionImport";
import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { Asset, Trade } from "@/src/types";

const now = () => new Date("2026-09-12T12:00:00Z");
const listing = (symbol: string, isin: string): Asset => ({ id: `yahoo:${symbol}.NS`, name: symbol, symbol, ticker: `${symbol}.NS`, quoteSourceId: `${symbol}.NS`, currency: "INR", exchange: "NSE", assetClass: "stock", isin });
const easy = withVerifiedStockSplits(listing("EASEMYTRIP", "INE07O001026"));
const buy = (asset: Asset, date: string, quantity: number, price = 100): Extract<Trade, { type: "buy" }> => ({ id: date, assetId: asset.id, type: "buy", date, quantity, pricePerUnit: price, totalValue: quantity * price });

describe("verified bonus chains", () => {
  it.each([
    ["HDFCBANK", "INE040A01034", "2025-08-26"],
    ["RELIANCE", "INE002A01018", "2024-10-28"],
  ])("applies %s only to eligible shares without adding cost", (symbol, isin, date) => {
    const asset = withVerifiedStockSplits(listing(symbol, isin));
    const trades = [buy(asset, "2024-01-01", 10), buy(asset, date, 3)];
    expect(calculateHolding({ asset, trades, currentPrice: 100 })).toMatchObject({ totalUnits: 23, totalInvested: 1300 });
  });

  it("replays split then bonus before same-day purchases, independent of array order", () => {
    const trades = [buy(easy, "2022-06-01", 10), buy(easy, "2022-11-21", 3), buy(easy, "2023-05-01", 7)];
    const stockSplits = [...easy.stockSplits!].reverse();
    expect(positionQuantity({ trades: trades.filter((trade) => trade.date <= "2022-11-20"), stockSplits, through: "2022-11-20" }).toNumber()).toBe(10);
    expect(positionQuantity({ trades: trades.filter((trade) => trade.date <= "2022-11-21"), stockSplits, through: "2022-11-21" }).toNumber()).toBe(83);
    expect(positionQuantity({ trades, stockSplits, through: "2024-11-29" }).toNumber()).toBe(180);
    expect(calculateHolding({ asset: { ...easy, stockSplits }, trades, currentPrice: 100 })).toMatchObject({ totalUnits: 180, totalInvested: 2000 });
    const peers = stockSplits.filter((event) => event.effectiveDate === "2022-11-21");
    expect(() => orderedStockSplits(peers.map(({ sequence: _sequence, ...event }) => event))).toThrow(/ordering/);
    expect(() => assertCatalogSplits({ ...easy, stockSplits: stockSplits.filter((event) => event.kind !== "split") })).toThrow(/incomplete/);
    expect(() => assertCatalogSplits({ ...easy, stockSplits: stockSplits.filter((event) => event.effectiveDate !== "2024-11-29") })).toThrow(/incomplete/);
    expect(() => positionQuantity({ trades: [buy(easy, "2022-02-01", 10)], stockSplits })).toThrow(/earlier bonus/);
  });

  it("imports historical ISINs together and preserves adjustments through reimport and restore", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    const csv = [transactionCsvHeaders.join(","), ...[
      ["2022-06-01", "INE07O001018", 10], ["2023-05-01", "INE07O001026", 7],
    ].map(([date, isin, quantity], index) => ["1", "buy", date, isin, "NSE", "EASEMYTRIP", "INR", quantity, "100", "", "", `synthetic-${index}`, "", "", "", "", ""].join(","))].join("\n");
    const parsed = parseTransactionCsv(csv);
    expect(parsed.errors).toEqual([]);
    const resolutions = parsed.rows.map((row) => ({ row, asset: listing("EASEMYTRIP", "INE07O001026"), status: "ready" as const }));
    const build = () => buildTransactionImportPlan({ batchId: "chain", mode: "fullHistory", resolutions, state: store.getState(), now: now() });
    const plan = build();
    expect(plan.errors).toEqual([]);
    expect(plan.holdings[0].reconciliation).toMatchObject({ quantity: 174, isExact: true });
    store.getState().recordTransactionImport(plan.command!);
    expect(build().duplicates).toBe(2);
    expect(store.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
    const restarted = createPortfolioStore({ storage, now });
    const backup = validateBackupPayload(restarted.getState().captureBackup().payload);
    const restored = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    restored.getState().replaceFromBackup(backup, restored.getState().getBackupRevision());
    const state = restored.getState();
    expect(state.assets).toHaveLength(1);
    expect(state.cashEntries).toEqual([]);
    expect(state.trades.map((trade) => trade.quantity)).toEqual([10, 7]);
    expect(calculateHolding({ asset: state.assets[0], trades: state.trades, currentPrice: 100 })).toMatchObject({ totalUnits: 174, totalInvested: 1700 });
    const incomplete = structuredClone(backup);
    incomplete.portfolio.assets[0].stockSplits = incomplete.portfolio.assets[0].stockSplits!.filter((event) => event.effectiveDate !== "2024-11-29");
    expect(() => validateBackupPayload(incomplete)).toThrow();
  });

  it("blocks uncertain bonus availability without mutating the portfolio", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    store.getState().addAsset(easy);
    store.getState().addTrade(buy(easy, "2022-06-01", 10));
    const before = store.getState();
    const sale: Trade = { ...buy(easy, "2022-12-01", 1), type: "sell" };
    expect(() => store.getState().addTrade(sale)).toThrow(/before bonus/);
    expect(store.getState()).toBe(before);
    store.getState().addTrade({ ...sale, date: "2022-12-31" });
    expect(store.getState().trades).toHaveLength(2);
  });
});
