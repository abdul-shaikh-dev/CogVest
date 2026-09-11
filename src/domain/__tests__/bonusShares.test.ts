import { calculateHolding, calculatePositionAccounting } from "../calculations/holdings";
import { positionQuantity } from "../stockSplits";
import { bonusShareCatalog } from "../stockSplitCatalog";
import { parseTransactionCsv, transactionCsvHeaders } from "../transactionCsv";
import { buildTransactionImportPlan } from "@/src/features/transactionImport/transactionImport";
import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { validateBackupPayload } from "../portfolioBackup";
import type { Asset, Trade } from "@/src/types";

const event = bonusShareCatalog[0];
const asset: Asset = { id: "yahoo:BERGEPAINT.NS", name: "Berger Paints", symbol: "BERGEPAINT", ticker: "BERGEPAINT.NS", currency: "INR", exchange: "NSE", assetClass: "stock", isin: event.newIsin, stockSplits: [event] };
const buy: Trade = { id: "buy", assetId: asset.id, type: "buy", date: "2023-01-01", quantity: 100, pricePerUnit: 100, totalValue: 10000 };
const now = () => new Date("2026-09-11T12:00:00Z");

describe("bonus shares", () => {
  it("adds shares without adding invested cash or rewriting purchases", () => {
    expect(calculateHolding({ asset, trades: [buy], currentPrice: 100 })).toMatchObject({ totalUnits: 120, totalInvested: 10000 });
    expect(buy.quantity).toBe(100);
    expect(positionQuantity({ trades: [buy], stockSplits: [event], through: "2023-09-21" }).toNumber()).toBe(100);
  });

  it("orders eligibility before ex-date purchases and sells at the adjusted basis", () => {
    const exBuy = { ...buy, id: "ex", date: event.effectiveDate, quantity: 10, totalValue: 1000 };
    expect(positionQuantity({ trades: [buy, exBuy], stockSplits: [event] }).toNumber()).toBe(130);
    const sale: Trade = { ...buy, id: "sell", type: "sell", date: event.creditedDate!, quantity: 12, pricePerUnit: 100, totalValue: 1200 };
    const result = calculatePositionAccounting({ trades: [buy, sale], stockSplits: [event] });
    expect(result.saleGains.sell).toBe(200);
    expect(calculateHolding({ asset, trades: [buy, sale], currentPrice: 100 })).toMatchObject({ totalUnits: 108, totalInvested: 9000 });
    expect(() => positionQuantity({ trades: [buy, { ...sale, date: event.effectiveDate }], stockSplits: [event] })).toThrow(/before bonus/);
  });

  it("does not re-credit measured openings and rejects fractional or duplicate events", () => {
    expect(positionQuantity({ trades: [], stockSplits: [event], openingPositions: [{ id: "o", assetId: asset.id, date: "2020-01-01", measuredAsOf: event.effectiveDate, quantity: 120, averageCostPrice: 10000 / 120 }] }).toNumber()).toBe(120);
    expect(() => positionQuantity({ trades: [{ ...buy, quantity: 101 }], stockSplits: [event] })).toThrow(/fractional/);
    expect(() => positionQuantity({ trades: [buy], stockSplits: [event, event] })).toThrow();
    expect(positionQuantity({ trades: [buy], stockSplits: [{ ...event, newShares: 1, oldShares: 1 }] }).toNumber()).toBe(200);
  });

  it("imports, reimports, restarts and restores without creating a cash purchase", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    const csv = [transactionCsvHeaders.join(","),
      ["1", "buy", "2023-01-01", event.newIsin, "NSE", "BERGEPAINT", "INR", "100", "100", "", "", "synthetic", "", "", "", "", ""].join(",")].join("\n");
    const rows = parseTransactionCsv(csv).rows.map((row) => ({ row, asset: { ...asset, stockSplits: undefined }, status: "ready" as const }));
    const build = () => buildTransactionImportPlan({ batchId: "bonus", mode: "fullHistory", resolutions: rows, state: store.getState(), now: now() });
    const plan = build();
    expect(plan.errors).toEqual([]);
    expect(plan.holdings[0].reconciliation.quantity).toBe(120);
    expect(store.getState().trades).toEqual([]);
    store.getState().recordTransactionImport(plan.command!);
    expect(build().duplicates).toBe(1);
    expect(store.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
    const restarted = createPortfolioStore({ storage, now });
    const backup = validateBackupPayload(restarted.getState().captureBackup().payload);
    const replacement = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    replacement.getState().replaceFromBackup(backup, replacement.getState().getBackupRevision());
    const state = replacement.getState();
    expect(state.trades).toHaveLength(1);
    expect(state.cashEntries).toEqual([]);
    expect(state.assets[0].stockSplits).toEqual([event]);
    expect(calculateHolding({ asset: state.assets[0], trades: state.trades, currentPrice: 100 })).toMatchObject({ totalUnits: 120, totalInvested: 10000 });
  });

  it("does not interpret a zero-priced ordinary purchase as a bonus", () => {
    const csv = [transactionCsvHeaders.join(","),
      ["1", "buy", "2023-01-01", event.newIsin, "NSE", "BERGEPAINT", "INR", "100", "0", "", "", "synthetic", "", "", "", "", ""].join(",")].join("\n");
    const parsed = parseTransactionCsv(csv);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("rejects pre-credit disposals at the store boundary without writing", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    store.getState().addAsset(asset);
    store.getState().addTrade(buy);
    expect(() => store.getState().addTrade({ ...buy, id: "early-sale", type: "sell", date: event.effectiveDate, quantity: 1, totalValue: 100 })).toThrow(/before bonus/);
    expect(store.getState().trades).toEqual([buy]);
  });
});
