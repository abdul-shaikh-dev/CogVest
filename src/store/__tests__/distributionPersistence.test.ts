import { createHash } from "node:crypto";

import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioBackup, parsePortfolioBackup } from "@/src/domain/portfolioBackup";
import { buildMonthlyPerformanceBasis } from "@/src/domain/calculations/monthlyPerformance";
import type { DistributionInput } from "@/src/domain/distributions";
import type { Asset, BuyTrade, CashEntry } from "@/src/types";

const now = () => new Date("2026-10-05T10:00:00Z");
const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
const stock: Asset = { id: "stock", name: "Synthetic Bank", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };
const deposit: CashEntry = { id: "deposit", amount: 5000, date: "2026-01-01", label: "Deposit", purpose: "capitalContribution", type: "addition" };
const buy: BuyTrade = { id: "buy", assetId: "stock", type: "buy", date: "2026-01-05", quantity: 10, pricePerUnit: 100, totalValue: 1000 };
const payout = (overrides: Partial<DistributionInput> = {}): DistributionInput => ({
  id: "div", assetId: "stock", paidOn: "2026-06-01", grossAmount: 100, taxWithheld: 10, treatment: "paidToCash", ...overrides,
});

function harness() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addAsset(stock);
  store.getState().addCashEntry(deposit);
  store.getState().addTrade(buy);
  return { storage, store };
}

describe("payout records", () => {
  it("saves a payout to Cash with exactly one linked net Cash addition, and protects it", () => {
    const { store, storage } = harness();
    expect(store.getState().saveDistribution(payout())).toMatchObject({ status: "applied" });
    const [distribution] = store.getState().distributions;
    expect(distribution).toEqual({
      id: "div", assetId: "stock", paidOn: "2026-06-01", grossAmount: 100, taxWithheld: 10, treatment: "paidToCash",
      linkedCashEntryId: "div:cash", recordedAt: "2026-10-05T10:00:00.000Z",
    });
    const cash = store.getState().cashEntries.find((entry) => entry.id === "div:cash");
    expect(cash).toEqual({ id: "div:cash", amount: 90, date: "2026-06-01", label: "Payout from Synthetic Bank",
      linkedDistributionId: "div", purpose: "distribution", type: "addition" });
    expect(store.getState().deleteManualCashEntry("div:cash")).toEqual({ reason: "linkedEntry", status: "rejected" });
    expect(() => store.getState().removeCashEntry("div:cash")).toThrow();
    // Survives a restart unchanged.
    expect(createPortfolioStore({ storage, now }).getState().distributions).toEqual([distribution]);
  });

  it("corrects the Cash leg with the payout and removes it when the payout no longer goes to Cash", () => {
    const { store } = harness();
    store.getState().saveDistribution(payout());
    store.getState().saveDistribution(payout({ grossAmount: 120, taxWithheld: 12, paidOn: "2026-06-03" }));
    expect(store.getState().cashEntries.find((entry) => entry.id === "div:cash")).toMatchObject({ amount: 108, date: "2026-06-03" });
    expect(store.getState().distributions[0].recordedAt).toBe("2026-10-05T10:00:00.000Z");
    store.getState().saveDistribution(payout({ treatment: "paidOutside" }));
    expect(store.getState().cashEntries.some((entry) => entry.id === "div:cash")).toBe(false);
    expect(store.getState().distributions[0]).not.toHaveProperty("linkedCashEntryId");
    expect(store.getState().deleteDistribution("div")).toEqual({ status: "applied" });
    expect(store.getState().distributions).toEqual([]);
    expect(store.getState().deleteDistribution("div")).toEqual({ reason: "notFound", status: "rejected" });
  });

  it("deletes payout Cash with its payout, unless later Cash spending depends on it", () => {
    const { store } = harness();
    store.getState().saveDistribution(payout({ id: "big", grossAmount: 5000, taxWithheld: 0 }));
    store.getState().addCashEntry({ id: "spend", amount: 9000, date: "2026-07-01", label: "Withdrawal", purpose: "withdrawal", type: "withdrawal" });
    const before = store.getState();
    expect(store.getState().deleteDistribution("big")).toEqual({ reason: "insufficientCash", status: "rejected" });
    expect(store.getState()).toBe(before);
  });

  it.each([
    ["tax not below gross", payout({ taxWithheld: 100 })],
    ["a zero amount", payout({ grossAmount: 0, taxWithheld: 0 })],
    ["a future date", payout({ paidOn: "2026-10-06" })],
    ["a malformed date", payout({ paidOn: "2026-6-1" })],
    ["an unknown asset", payout({ assetId: "missing" })],
    ["a reinvestment without a buy", payout({ treatment: "reinvested" })],
    ["a reinvestment into an earlier buy", payout({ treatment: "reinvested", linkedTradeId: "buy" })],
  ])("rejects %s without writing anything", (_name, input) => {
    const { store, storage } = harness();
    const raw = storage.getRawItem(portfolioStorageKey);
    expect(store.getState().saveDistribution(input)).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(store.getState().distributions).toEqual([]);
  });

  it("links a reinvested payout to its buy and protects that buy", () => {
    const { store } = harness();
    store.getState().addTrade({ ...buy, id: "reinvest", date: "2026-06-02", quantity: 1, pricePerUnit: 90, totalValue: 90 });
    expect(store.getState().saveDistribution(payout({ treatment: "reinvested", linkedTradeId: "reinvest" }))).toMatchObject({ status: "applied" });
    expect(store.getState().deleteTrade("reinvest")).toEqual({ reason: "linkedPayout", status: "rejected" });
    expect(store.getState().correctTrade({ id: "reinvest", assetId: "stock", type: "buy", date: "2026-05-30", quantity: 1, pricePerUnit: 90 }))
      .toEqual({ reason: "linkedPayout", status: "rejected" });
    expect(store.getState().deleteAsset("stock")).toEqual({ reason: "linkedPayout", status: "rejected" });
    expect(store.getState().trades.map((trade) => trade.id)).toEqual(["buy", "reinvest"]);
  });

  it("rejects asset corrections that would strand payouts, without writing", () => {
    const { store, storage } = harness();
    store.getState().saveDistribution(payout());
    const raw = storage.getRawItem(portfolioStorageKey);
    expect(store.getState().correctAsset({ ...stock, currency: "USD" })).toEqual({ reason: "linkedPayout", status: "rejected" });
    expect(store.getState().correctAsset({ ...stock, assetClass: "cash" })).toEqual({ reason: "linkedPayout", status: "rejected" });
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(store.getState().correctAsset({ ...stock, name: "Synthetic Bank Ltd" })).toMatchObject({ status: "applied" });
  });

  it("records ongoing coverage and removes it only on request", () => {
    const { store, storage } = harness();
    expect(store.getState().setDistributionCoverage("stock", "2026-01-05")).toEqual({ status: "applied" });
    expect(store.getState().distributionCoverage).toEqual([{ assetId: "stock", from: "2026-01-05", confirmedAt: "2026-10-05T10:00:00.000Z" }]);
    // Adding a payout is the expected upkeep and leaves coverage in place.
    store.getState().saveDistribution(payout());
    expect(store.getState().distributionCoverage).toHaveLength(1);
    expect(store.getState().setDistributionCoverage("stock", "2026-10-06")).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(store.getState().setDistributionCoverage("missing", "2026-01-05")).toEqual({ reason: "notFound", status: "rejected" });
    expect(store.getState().setDistributionCoverage("stock", null)).toEqual({ status: "applied" });
    expect(createPortfolioStore({ storage, now }).getState().distributionCoverage).toEqual([]);
  });

  it("round trips payouts, their Cash and coverage through a backup", async () => {
    const { store } = harness();
    store.getState().saveDistribution(payout());
    store.getState().setDistributionCoverage("stock", "2026-01-05");
    const payload = store.getState().captureBackup().payload;
    const text = await createPortfolioBackup(payload, { appVersion: "1.0.27", createdAt: now().toISOString() }, digest);
    const target = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    target.getState().replaceFromBackup((await parsePortfolioBackup(text, digest)).payload, target.getState().getBackupRevision());
    expect(target.getState().captureBackup().payload).toEqual(payload);
  });

  it.each(["amount", "orphanCash", "danglingCash", "duplicateCoverage", "privateField"])("rejects a %s backup without replacing anything", (kind) => {
    const { store } = harness();
    store.getState().saveDistribution(payout());
    store.getState().setDistributionCoverage("stock", "2026-01-05");
    const payload = JSON.parse(JSON.stringify(store.getState().captureBackup().payload));
    const cash = payload.portfolio.cashEntries.find((entry: CashEntry) => entry.id === "div:cash");
    if (kind === "amount") cash.amount += 1;
    if (kind === "orphanCash") payload.portfolio.distributions = [];
    if (kind === "danglingCash") payload.portfolio.cashEntries = payload.portfolio.cashEntries.filter((entry: CashEntry) => entry.id !== "div:cash");
    if (kind === "duplicateCoverage") payload.portfolio.distributionCoverage.push(payload.portfolio.distributionCoverage[0]);
    if (kind === "privateField") payload.portfolio.distributions[0].bankAccount = "not-collected";
    const target = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const before = target.getState();
    expect(() => target.getState().replaceFromBackup(payload, target.getState().getBackupRevision())).toThrow();
    expect(target.getState()).toBe(before);
  });

  it("migrates a V16 portfolio once, adding empty payout records and changing nothing else", () => {
    const { store, storage } = harness();
    const current = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
    const legacy = { ...current, schemaVersion: 16 };
    delete legacy.distributions;
    delete legacy.distributionCoverage;
    storage.setRawItem(portfolioStorageKey, JSON.stringify(legacy));
    const migrated = createPortfolioStore({ storage, now });
    expect(migrated.getState().captureBackup().payload).toEqual(store.getState().captureBackup().payload);
    expect(JSON.parse(storage.getRawItem(portfolioStorageKey)!)).toEqual(current);
  });

  it("rejects V16 data that already contains payout records", () => {
    const { storage } = harness();
    const current = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
    storage.setRawItem(portfolioStorageKey, JSON.stringify({ ...current, schemaVersion: 16 }));
    const reopened = createPortfolioStore({ storage, now });
    expect(reopened.getState().storageRecovery?.incidents[0]?.reason).toBe("invalid-shape");
  });

  it("treats payout Cash as return earned, not new money, in monthly Progress", () => {
    const { store } = harness();
    store.getState().saveDistribution(payout());
    const basis = buildMonthlyPerformanceBasis({ cashEntries: store.getState().cashEntries, openingPositions: [], targetMonth: "2026-06" });
    expect(basis).toMatchObject({ status: "complete", netExternalFlow: 0 });
  });
});
