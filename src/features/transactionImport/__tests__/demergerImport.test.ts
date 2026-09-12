import { parseTransactionCsv, transactionCsvHeaders } from "@/src/domain/transactionCsv";
import { buildTransactionImportPlan } from "../transactionImport";
import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { calculateHoldings } from "@/src/domain/calculations/holdings";
import { projectDemergers } from "@/src/domain/demergers";
import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import type { Asset } from "@/src/types";

const now = () => new Date("2026-09-12T12:00:00Z");
const tata: Asset = { id: "yahoo:TMPV.NS", name: "Tata Motors Passenger Vehicles", symbol: "TMPV", ticker: "TMPV.NS", quoteSourceId: "TMPV.NS", exchange: "NSE", isin: "INE155A01022", currency: "INR", assetClass: "stock" };
function rows(asset = tata) {
  const parsed = parseTransactionCsv([transactionCsvHeaders.join(","),
    ["1", "buy", "2023-01-02", asset.isin, "NSE", asset.symbol, "INR", "10", "100", "", "", "synthetic-one", "", "", "", "", ""].join(",")].join("\n"));
  expect(parsed.errors).toEqual([]);
  return parsed.rows.map((row) => ({ row, asset, status: "ready" as const }));
}

describe("demerger import", () => {
  it("leaves neither successor nor source trades after a failed persistence write", () => {
    const memory = createMemoryJsonStorage();
    const storage = { ...memory, setItem: () => { throw new Error("synthetic disk failure"); } };
    const store = createPortfolioStore({ storage, now });
    const plan = buildTransactionImportPlan({ batchId: "failure", mode: "fullHistory", state: store.getState(), resolutions: rows(), now: now() });
    const before = store.getState();
    expect(() => store.getState().recordTransactionImport(plan.command!)).toThrow();
    expect(store.getState()).toBe(before);
    const restarted = createPortfolioStore({ storage: memory, now });
    expect(restarted.getState().assets).toEqual([]);
    expect(restarted.getState().trades).toEqual([]);
  });

  it("replaces a proven successor opening rather than adding its entitlement twice", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const child: Asset = { ...tata, id: "yahoo:TMCV.NS", name: "Tata Motors", symbol: "TMCV", ticker: "TMCV.NS", quoteSourceId: "TMCV.NS", isin: "INE1TAE01010" };
    store.getState().addAsset(child);
    store.getState().addOpeningPosition({ id: "child-opening", assetId: child.id, date: "2025-10-14", measuredAsOf: "2026-01-01", quantity: 10, averageCostPrice: 31.15 });
    const plan = buildTransactionImportPlan({ batchId: "mixed", mode: "fullHistory", state: store.getState(), resolutions: rows(), now: now() });
    expect(plan.errors).toEqual([]);
    expect(plan.command!.replaceOpeningPositionIds).toContain("child-opening");
    store.getState().recordTransactionImport(plan.command!);
    expect(store.getState().openingPositions).toEqual([]);
    expect(calculateHoldings({ ...store.getState(), now: now() }).find((holding) => holding.asset.id === child.id)).toMatchObject({ totalUnits: 10, totalInvested: 311.5 });
  });

  it("allocates Reliance cost before its later bonus without doubling the Jio entitlement", () => {
    const reliance: Asset = { ...tata, id: "yahoo:RELIANCE.NS", name: "Reliance", symbol: "RELIANCE", ticker: "RELIANCE.NS", quoteSourceId: "RELIANCE.NS", isin: "INE002A01018" };
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const plan = buildTransactionImportPlan({ batchId: "ril", mode: "fullHistory", state: store.getState(), resolutions: rows(reliance), now: now() });
    expect(plan.errors).toEqual([]);
    store.getState().recordTransactionImport(plan.command!);
    expect(calculateHoldings({ ...store.getState(), now: now() }).map((holding) => [holding.asset.symbol, holding.totalUnits, holding.totalInvested])).toEqual([["RELIANCE", 20, 953.2], ["JIOFIN", 10, 46.8]]);
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("previews both holdings, preserves source trades, and survives reimport/restart/restore", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    const build = () => buildTransactionImportPlan({ batchId: "demerger", mode: "fullHistory", state: store.getState(), resolutions: rows(), now: now() });
    const before = store.getState();
    const plan = build();
    expect(plan.errors).toEqual([]);
    expect(plan.holdings).toHaveLength(2);
    expect(plan.holdings.map((holding) => [holding.asset.symbol, holding.reconciliation.quantity, holding.reconciliation.averageCostPrice])).toEqual([["TMPV", 10, 68.85], ["TMCV", 10, 31.15]]);
    expect(store.getState()).toBe(before);
    store.getState().recordTransactionImport(plan.command!);
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().cashEntries).toEqual([]);
    expect(build().duplicates).toBe(1);
    expect(build().command).toBeUndefined();
    expect(store.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
    const restarted = createPortfolioStore({ storage, now });
    const backup = validateBackupPayload(restarted.getState().captureBackup().payload);
    const restored = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    restored.getState().replaceFromBackup(backup, restored.getState().getBackupRevision());
    expect(calculateHoldings({ ...restored.getState(), now: now() }).map((holding) => [holding.totalUnits, holding.totalInvested])).toEqual([[10, 688.5], [10, 311.5]]);
    expect(restored.getState().trades[0]).toMatchObject({ quantity: 10, pricePerUnit: 100, totalValue: 1000 });
    const corrupt = structuredClone(backup);
    corrupt.portfolio.assets = corrupt.portfolio.assets.filter((asset) => asset.symbol !== "TMCV");
    expect(() => validateBackupPayload(corrupt)).toThrow();
  });

  it("supports later successor purchases and disposals without assigning new investment to entitlement", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const plan = buildTransactionImportPlan({ batchId: "one", mode: "fullHistory", state: store.getState(), resolutions: rows(), now: now() });
    store.getState().recordTransactionImport(plan.command!);
    const child = store.getState().assets.find((asset) => asset.symbol === "TMCV")!;
    store.getState().addTrade({ id: "later", assetId: child.id, type: "buy", date: "2026-01-01", quantity: 10, pricePerUnit: 100, totalValue: 1000 });
    store.getState().addTrade({ id: "sale", assetId: child.id, type: "sell", date: "2026-02-01", quantity: 5, pricePerUnit: 100, totalValue: 500 });
    const holding = calculateHoldings({ ...store.getState(), now: now() }).find((item) => item.asset.id === child.id)!;
    expect(holding).toMatchObject({ totalUnits: 15, totalInvested: 983.63 });
    expect(store.getState().deleteAsset(child.id)).toMatchObject({ status: "rejected", reason: "linkedDemerger" });
  });

  it("rejects conflicting/missing successors and unsupported prelisting records atomically", () => {
    for (const fault of ["missing", "identity", "unknown", "prelisting"]) {
      const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
      const plan = buildTransactionImportPlan({ batchId: "one", mode: "fullHistory", state: store.getState(), resolutions: rows(), now: now() });
      const command = structuredClone(plan.command!);
      const parent = command.assets.find((asset) => asset.demerger)!;
      const child = command.assets.find((asset) => asset.id === parent.demerger!.childAssetId)!;
      if (fault === "missing") command.assets = [parent];
      if (fault === "identity") child.isin = "INE000000001";
      if (fault === "unknown") parent.demerger!.eventId = "unknown";
      if (fault === "prelisting") command.transactions.push({ ...command.transactions[0], id: "invalid", assetId: child.id, date: "2025-10-20", importProvenance: { ...command.transactions[0].importProvenance!, externalId: "invalid", originalRowNumber: 3 } });
      const before = store.getState();
      expect(() => store.getState().recordTransactionImport(command)).toThrow();
      expect(store.getState()).toBe(before);
    }
  });

  it("updates an already imported parent's entitlement once without adding transactions", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    store.getState().addAsset(tata);
    const build = () => buildTransactionImportPlan({ batchId: "legacy", mode: "supplemental", state: store.getState(), resolutions: rows(), now: now() });
    store.getState().addTrade(build().command!.transactions[0]);
    const plan = build();
    expect(plan.command?.transactions).toEqual([]);
    store.getState().recordTransactionImport(plan.command!);
    expect(projectDemergers(store.getState()).filter((event) => event.kind === "entitlement")).toHaveLength(1);
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
  });
});
