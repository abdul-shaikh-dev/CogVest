import { calculateHoldings } from "@/src/domain/calculations/holdings";
import { bonusShareCatalog } from "@/src/domain/stockSplitCatalog";
import { parseTransactionCsv, transactionCsvHeaders } from "@/src/domain/transactionCsv";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { Asset } from "@/src/types";
import { buildTransactionImportPlan } from "../transactionImport";

const asset: Asset = { id: "yahoo:HDFCBANK.NS", name: "HDFC Bank", symbol: "HDFCBANK", ticker: "HDFCBANK.NS", quoteSourceId: "HDFCBANK.NS", exchange: "NSE", currency: "INR", assetClass: "stock", isin: "INE040A01034" };
const now = () => new Date("2026-09-12T12:00:00Z");
const event = bonusShareCatalog.find((item) => item.id === "HDFCBANK-2025-08-26-bonus-v1")!;

function fixture() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addAsset(asset);
  const csv = `${transactionCsvHeaders.join(",")}\n${["1", "buy", "2025-01-02", asset.isin, "NSE", "HDFCBANK", "INR", "10", "100", "", "", "synthetic-hdfc-buy", "", "", "", "", ""].join(",")}`;
  const parsed = parseTransactionCsv(csv);
  expect(parsed.errors).toEqual([]);
  const resolutions = parsed.rows.map((row) => ({ row, asset, status: "ready" as const }));
  const build = () => buildTransactionImportPlan({ batchId: "original-batch", mode: "fullHistory", resolutions, state: store.getState(), now: now() });
  // Legacy saved execution: the purchase exists, but the catalog event did not yet.
  store.getState().addTrade(build().command!.transactions[0]);
  expect(store.getState().assets[0].stockSplits).toBeUndefined();
  return { storage, store, build, resolutions };
}

describe("event-only transaction imports", () => {
  it.each(["fullHistory", "supplemental"] as const)("handles mixed new trades and a duplicate-only adjusted holding in %s mode", (mode) => {
    const { store, storage, resolutions } = fixture();
    store.getState().addOpeningPosition({ id: "measured-hdfc", assetId: asset.id, date: "2025-01-02", measuredAsOf: "2025-09-01", quantity: 20, averageCostPrice: 50 });
    const other: Asset = { ...asset, id: "synthetic-other", name: "Synthetic other", symbol: "OTHER", ticker: "OTHER.NS", quoteSourceId: "OTHER.NS", isin: "INE000000001" };
    const parsed = parseTransactionCsv(`${transactionCsvHeaders.join(",")}\n${["1", "buy", "2026-01-02", other.isin, "NSE", "OTHER", "INR", "3", "200", "", "", "synthetic-other-buy", "", "", "", "", ""].join(",")}`);
    expect(parsed.errors).toEqual([]);
    const mixed = [...resolutions, ...parsed.rows.map((row) => ({ row: { ...row, rowNumber: 3 }, asset: other, status: "ready" as const }))];
    const build = () => buildTransactionImportPlan({ batchId: "mixed-batch", mode, resolutions: mixed, state: store.getState(), now: now() });
    const before = store.getState();
    const plan = build();
    expect(plan.errors).toEqual([]);
    expect(plan.summary).toMatchObject({ additions: 1, affectedHoldings: 2 });
    expect(plan.duplicates).toBe(1);
    expect(plan.holdings.find((holding) => holding.asset.id === asset.id)).toMatchObject({ importedTransactions: 0, reconciliation: { quantity: 20, averageCostPrice: 50 } });
    expect(plan.command).toMatchObject({ cutovers: [], replaceOpeningPositionIds: [] });
    expect(plan.command!.transactions).toHaveLength(1);
    expect(store.getState().recordTransactionImport(plan.command!)).toMatchObject({ status: "applied", added: 1, removedOpeningPositions: 0, updatedCutovers: 0 });
    expect(store.getState().trades).toHaveLength(2);
    expect(store.getState().trades[0]).toEqual(before.trades[0]);
    expect(store.getState().cashEntries).toEqual(before.cashEntries);
    expect(store.getState().openingPositions).toEqual(before.openingPositions);
    expect(store.getState().assets.find((item) => item.id === asset.id)?.stockSplits).toEqual([event]);
    expect(store.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
    expect(build().command).toBeUndefined();
    const restarted = createPortfolioStore({ storage, now });
    const holdings = calculateHoldings({ ...restarted.getState(), now: now() });
    expect(holdings.find((holding) => holding.asset.id === asset.id)).toMatchObject({ totalUnits: 20, totalInvested: 1000 });
    expect(holdings.find((holding) => holding.asset.id === other.id)).toMatchObject({ totalUnits: 3, totalInvested: 600 });
    expect(restarted.getState().trades).toHaveLength(2);
    expect(restarted.getState().cashEntries).toEqual(before.cashEntries);
  });

  it("canonicalizes an event-only holding while retaining the original source ISIN and execution", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    const legacy: Asset = { ...asset, id: "yahoo:IRCTC.NS", name: "IRCTC", symbol: "IRCTC", ticker: "IRCTC.NS", quoteSourceId: "IRCTC.NS", isin: "INE335Y01012" };
    store.getState().addAsset(legacy);
    const parsed = parseTransactionCsv(`${transactionCsvHeaders.join(",")}\n${["1", "buy", "2021-10-01", legacy.isin, "NSE", "IRCTC", "INR", "10", "100", "", "", "synthetic-irctc-buy", "", "", "", "", ""].join(",")}`);
    expect(parsed.errors).toEqual([]);
    const resolutions = parsed.rows.map((row) => ({ row, asset: legacy, status: "ready" as const }));
    const build = () => buildTransactionImportPlan({ batchId: "irctc-original", mode: "fullHistory", resolutions, state: store.getState(), now: now() });
    store.getState().addTrade(build().command!.transactions[0]);
    const original = store.getState().trades[0];
    const plan = build();
    expect(plan.errors).toEqual([]);
    expect(plan.command!.transactions).toEqual([]);
    expect(plan.command!.assets[0].isin).toBe("INE335Y01020");
    store.getState().recordTransactionImport(plan.command!);
    expect(store.getState().assets[0].isin).toBe("INE335Y01020");
    expect(store.getState().trades[0]).toEqual(original);
    expect(original.importProvenance?.sourceIsin).toBe("INE335Y01012");
    expect(build().command).toBeUndefined();
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().assets[0].isin).toBe("INE335Y01020");
    expect(restarted.getState().trades).toEqual([original]);
    expect(restarted.getState().cashEntries).toEqual([]);
    expect(calculateHoldings({ ...restarted.getState(), now: now() })[0]).toMatchObject({ totalUnits: 50, totalInvested: 1000 });
    expect(restarted.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
  });

  it.each(["clearedIsin", "uncostedTransfer"])("rejects the entire mixed batch when the event-only holding becomes stale: %s", (change) => {
    const { store, storage, resolutions } = fixture();
    const other: Asset = { ...asset, id: "synthetic-other", symbol: "OTHER", ticker: "OTHER.NS", quoteSourceId: "OTHER.NS", isin: "INE000000001" };
    const parsed = parseTransactionCsv(`${transactionCsvHeaders.join(",")}\n${["1", "buy", "2026-01-02", other.isin, "NSE", "OTHER", "INR", "3", "200", "", "", "synthetic-other-buy", "", "", "", "", ""].join(",")}`);
    expect(parsed.errors).toEqual([]);
    const plan = buildTransactionImportPlan({
      batchId: "mixed-stale", mode: "fullHistory", now: now(), state: store.getState(),
      resolutions: [...resolutions, ...parsed.rows.map((row) => ({ row: { ...row, rowNumber: 3 }, asset: other, status: "ready" as const }))],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.command!.transactions).toHaveLength(1);
    if (change === "clearedIsin") {
      expect(store.getState().correctAsset({ ...store.getState().assets[0], isin: undefined }).status).toBe("applied");
    } else {
      store.getState().addTrade({ id: "uncosted-transfer", type: "transferIn", assetId: asset.id, date: "2026-01-03", quantity: 1 });
    }
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    expect(() => store.getState().recordTransactionImport(plan.command!)).toThrow(/Event-only import/);
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(store.getState().assets.some((item) => item.id === other.id)).toBe(false);
    expect(store.getState().trades.some((trade) => trade.assetId === other.id)).toBe(false);
    expect(store.getState().assets[0].stockSplits).toBeUndefined();
  });

  it("previews and atomically attaches a newly verified bonus once, including reuse of the original batch ID", () => {
    const { store, storage, build } = fixture();
    const before = store.getState();
    const plan = build();
    expect(plan.errors).toEqual([]);
    expect(plan.duplicates).toBe(1);
    expect(plan.summary).toMatchObject({ additions: 0, unplannedRows: 0, affectedHoldings: 1 });
    expect(plan.holdings[0]).toMatchObject({ importedTransactions: 0, reconciliation: { quantity: 20, averageCostPrice: 50, isExact: true } });
    expect(plan.command).toMatchObject({ transactions: [], cutovers: [], replaceOpeningPositionIds: [] });
    expect(store.getState()).toBe(before);
    expect(store.getState().recordTransactionImport(plan.command!)).toEqual({ added: 0, removedOpeningPositions: 0, updatedCutovers: 0, status: "applied" });
    expect(store.getState().trades).toBe(before.trades);
    expect(store.getState().cashEntries).toBe(before.cashEntries);
    expect(store.getState().assets[0]).toEqual({ ...before.assets[0], stockSplits: [event] });
    expect(build().command).toBeUndefined();
    expect(store.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().trades).toEqual(before.trades);
    expect(restarted.getState().cashEntries).toEqual(before.cashEntries);
    expect(restarted.getState().assets[0].stockSplits).toEqual([event]);
    expect(calculateHoldings({ ...restarted.getState(), now: now() })[0]).toMatchObject({ totalUnits: 20, totalInvested: 1000 });
    expect(restarted.getState().recordTransactionImport(plan.command!).status).toBe("alreadyApplied");
  });

  it("does not apply unrelated proposed metadata", () => {
    const { store, build } = fixture();
    const command = build().command!;
    const before = store.getState().assets[0];
    command.assets[0] = { ...command.assets[0], name: "Do not apply", ticker: "OTHER.NS", quoteSourceId: "OTHER.NS" };
    store.getState().recordTransactionImport(command);
    expect(store.getState().assets[0]).toEqual({ ...before, stockSplits: [event] });
  });

  it.each(["terms", "unknown", "duplicate", "cutover", "replacement", "empty", "implicit"])("rejects invalid event-only command: %s", (scenario) => {
    const { store, storage, build } = fixture();
    const command = structuredClone(build().command!);
    if (scenario === "terms") command.assets[0].stockSplits![0].newShares = 99;
    if (scenario === "unknown") command.assets[0].id = "missing";
    if (scenario === "duplicate") command.assets.push(command.assets[0]);
    if (scenario === "cutover") command.cutovers.push({ openingPositionId: "missing", measuredAsOf: "2025-01-01" });
    if (scenario === "replacement") command.replaceOpeningPositionIds.push("missing");
    if (scenario === "empty") command.assets = [];
    if (scenario === "implicit") command.assets[0].stockSplits = undefined;
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    expect(() => store.getState().recordTransactionImport(command)).toThrow();
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });

  it("revalidates changed identity and current disposal eligibility before writing", () => {
    for (const change of ["identity", "disposal"]) {
      const { store, storage, build } = fixture();
      const command = build().command!;
      if (change === "identity") store.setState({ assets: [{ ...store.getState().assets[0], isin: "INE000000001" }] });
      else store.getState().addTrade({ id: "early-sale", assetId: asset.id, type: "sell", date: event.effectiveDate, quantity: 1, pricePerUnit: 100, totalValue: 100 });
      const before = store.getState();
      const raw = storage.getRawItem(portfolioStorageKey);
      expect(() => store.getState().recordTransactionImport(command)).toThrow();
      expect(store.getState()).toBe(before);
      expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    }
  });

  it("rolls back a persistence failure without adding events or touching trades/cash", () => {
    const { store, storage, build } = fixture();
    const command = build().command!;
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    const write = storage.setItem;
    jest.spyOn(storage, "setItem").mockImplementation((key, value) => {
      if (key === portfolioStorageKey) throw new Error("synthetic disk failure");
      write(key, value);
    });
    expect(() => store.getState().recordTransactionImport(command)).toThrow();
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });

  it("blocks unsupported source rows rather than treating an event-only update as a bypass", () => {
    const { store, resolutions } = fixture();
    const plan = buildTransactionImportPlan({ batchId: "retry", mode: "supplemental", resolutions, state: store.getState(), now: now(), unsupportedCount: 1 });
    expect(plan.command).toBeUndefined();
    expect(plan.errors.some((error) => error.code === "unsupportedSourceEvents")).toBe(true);
  });
});
