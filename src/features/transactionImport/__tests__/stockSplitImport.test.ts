import { parseTransactionCsv, transactionCsvHeaders } from "@/src/domain/transactionCsv";
import { calculateHoldings, calculateRecordedSaleGains } from "@/src/domain/calculations/holdings";
import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { buildTransactionImportPlan } from "../transactionImport";
import { stockSplitCatalog } from "@/src/domain/stockSplitCatalog";
import type { Asset } from "@/src/types";

const asset: Asset = { id: "yahoo:IRCTC.NS", quoteSourceId: "IRCTC.NS", ticker: "IRCTC.NS", symbol: "IRCTC", name: "IRCTC", exchange: "NSE", currency: "INR", assetClass: "stock" };
const now = () => new Date("2026-09-11T12:00:00Z");
function resolutions() {
  const csv = [transactionCsvHeaders.join(","),
    ["1", "buy", "2021-10-01", "INE335Y01012", "NSE", "IRCTC", "INR", "10", "100", "", "", "1", "", "", "", "", ""].join(","),
    ["1", "sell", "2021-11-01", "INE335Y01020", "NSE", "IRCTC", "INR", "5", "60", "", "", "2", "", "", "", "", ""].join(","),
  ].join("\n");
  const parsed = parseTransactionCsv(csv);
  expect(parsed.errors).toEqual([]);
  return parsed.rows.map((row) => ({ row, asset, status: "ready" as const }));
}

describe("verified split import", () => {
  it("plans automatically, commits once, and survives restart and backup validation", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    const build = () => buildTransactionImportPlan({ batchId: "split", mode: "fullHistory", resolutions: resolutions(), state: store.getState(), now: now() });
    const plan = build();
    expect(plan.errors).toEqual([]);
    expect(plan.holdings[0].reconciliation).toMatchObject({ quantity: 45, averageCostPrice: 20, isExact: true });
    expect(store.getState().trades).toHaveLength(0);
    store.getState().recordTransactionImport(plan.command!);
    expect(build().duplicates).toBe(2);
    expect(store.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().assets[0].stockSplits).toHaveLength(1);
    const restored = validateBackupPayload(restarted.getState().captureBackup().payload);
    expect(restored.portfolio.assets[0].stockSplits).toEqual(stockSplitCatalog);
    const replacement = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    replacement.getState().replaceFromBackup(restored, replacement.getState().getBackupRevision());
    const state = replacement.getState();
    expect(calculateHoldings({ ...state, now: now() })[0]).toMatchObject({ totalUnits: 45, totalInvested: 900, averageCostPrice: 20 });
    expect(Object.values(calculateRecordedSaleGains({ ...state, now: now() }))).toEqual([200]);
    expect(state.cashEntries).toEqual([]);
    expect(state.trades[0].quantity).toBe(10);
  });

  it("rejects changed event terms before any write", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const plan = buildTransactionImportPlan({ batchId: "split", mode: "fullHistory", resolutions: resolutions(), state: store.getState(), now: now() });
    const command = plan.command!;
    command.assets[0].stockSplits![0].newShares = 100;
    expect(() => store.getState().recordTransactionImport(command)).toThrow(/evidence/);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().assets).toEqual([]);
  });

  it("rejects a historical ISIN used after its verified cutover", () => {
    const rows = resolutions();
    rows[0].row.tradeDate = "2022-01-01";
    const plan = buildTransactionImportPlan({ batchId: "split", mode: "fullHistory", resolutions: rows, state: createPortfolioStore({ storage: createMemoryJsonStorage(), now }).getState(), now: now() });
    expect(plan.command).toBeUndefined();
    expect(plan.errors.some((error) => error.code === "conflictingIdentity")).toBe(true);
  });

  it.each(["INE335Y01020", "invalid"])("rejects contradictory source identity %s at commit and restore", (isin) => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const plan = buildTransactionImportPlan({ batchId: "split", mode: "fullHistory", resolutions: resolutions(), state: store.getState(), now: now() });
    const command = structuredClone(plan.command!);
    command.transactions[0].importProvenance!.sourceIsin = isin;
    expect(() => store.getState().recordTransactionImport(command)).toThrow();
    expect(store.getState().trades).toEqual([]);
    store.getState().recordTransactionImport(plan.command!);
    const backup = store.getState().captureBackup().payload;
    backup.portfolio.trades[0].importProvenance!.sourceIsin = isin;
    expect(() => validateBackupPayload(backup)).toThrow();
  });

  it("rejects null and extra event fields before persistence", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    expect(() => store.getState().addAsset({ ...asset, stockSplits: null } as unknown as Asset)).toThrow();
    expect(() => store.getState().addAsset({ ...asset, isin: "INE335Y01020", stockSplits: [{ ...stockSplitCatalog[0], extra: true }] } as unknown as Asset)).toThrow();
    expect(store.getState().assets).toEqual([]);
  });

  it("accepts a schema-9 backup without events and upgrades its version", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const backup = store.getState().captureBackup().payload;
    expect(validateBackupPayload({ ...backup, portfolio: { ...backup.portfolio, schemaVersion: 9 } }).portfolio.schemaVersion).toBe(10);
  });

  it("revisits old automatic snapshots when attaching a split but preserves manual snapshots", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    store.getState().addAsset({ ...asset, isin: "INE335Y01020" });
    store.getState().addTrade({ id: "legacy", assetId: asset.id, type: "buy", date: "2021-10-01", quantity: 10, pricePerUnit: 100, totalValue: 1000 });
    const base = { cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: 1000, investedValue: 1000, monthlyInvestment: 1000, portfolioValue: 1000 };
    store.getState().addMonthlySnapshot({ ...base, id: "auto", month: "2021-10", generated: { source: "auto", generatedAt: now().toISOString(), priceBasis: "historical-close", warnings: [] } });
    store.getState().addMonthlySnapshot({ ...base, id: "manual", month: "2021-11" });
    const row = resolutions()[1];
    row.row.tradeDate = "2026-01-01";
    const plan = buildTransactionImportPlan({ batchId: "later", mode: "supplemental", resolutions: [row], state: store.getState(), now: now() });
    expect(plan.errors).toEqual([]);
    store.getState().recordTransactionImport(plan.command!);
    expect(store.getState().monthlySnapshots.find((snapshot) => snapshot.id === "auto")).toBeUndefined();
    expect(store.getState().monthlySnapshots.find((snapshot) => snapshot.id === "manual")).toMatchObject({ portfolioValue: 1000 });
  });
});
