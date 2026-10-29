import { createHash } from "node:crypto";

import { buildMonthlyPerformanceBasis } from "@/src/domain/calculations/monthlyPerformance";
import { createPortfolioBackup, parsePortfolioBackup } from "@/src/domain/portfolioBackup";
import { planPpfCsvImport } from "@/src/domain/ppfCsvImport";
import { measurementEvidenceDigest } from "@/src/domain/wholePortfolioXirr";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { Asset, BuyTrade, CashEntry, PpfAccount, PpfLedgerEntry } from "@/src/types";

const now = () => new Date("2026-10-05T10:00:00Z");
const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
const stock: Asset = { id: "stock", name: "Synthetic", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };
const deposit: CashEntry = { id: "deposit", amount: 5000, date: "2026-01-01", label: "Deposit", purpose: "capitalContribution", type: "addition" };
const buy: BuyTrade = { id: "buy", assetId: "stock", type: "buy", date: "2026-01-05", quantity: 10, pricePerUnit: 100, totalValue: 1000 };
const ppf: PpfAccount = { id: "ppf", nickname: "Family PPF", provider: "Post office", status: "active", balanceAsOf: "2025-12-31",
  confirmedBalance: 0, createdAt: "2025-12-31T00:00:00Z", opening: { kind: "date", openedOn: "2025-12-31" } };
const ppfDeposit = (overrides: Partial<Extract<PpfLedgerEntry, { type: "contribution" }>> = {}): PpfLedgerEntry =>
  ({ id: "ppf-dep", accountId: "ppf", date: "2026-02-01", recordedAt: "2026-02-01T00:00:00Z", type: "contribution", amount: 2000,
    fundingSource: "cash", ...overrides });

function harness() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addAsset(stock);
  store.getState().addCashEntry(deposit);
  store.getState().addTrade(buy);
  store.getState().addPpfAccount(ppf);
  return { storage, store };
}
const leg = (store: ReturnType<typeof harness>["store"]) => store.getState().cashEntries.find((entry) => entry.linkedPpf);

describe("measurement basis (D9)", () => {
  it("migrates a V17 portfolio once, adding no basis and changing nothing else", () => {
    const { store, storage } = harness();
    const current = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
    const legacy = { ...current, schemaVersion: 17 };
    delete legacy.measurementBasis;
    storage.setRawItem(portfolioStorageKey, JSON.stringify(legacy));
    const migrated = createPortfolioStore({ storage, now });
    expect(migrated.getState().measurementBasis).toBeNull();
    expect(migrated.getState().captureBackup().payload).toEqual(store.getState().captureBackup().payload);
  });

  it("rejects V17 data that already carries V18 fields", () => {
    const { storage } = harness();
    const current = JSON.parse(storage.getRawItem(portfolioStorageKey)!);
    delete current.measurementBasis;
    current.schemaVersion = 17;
    current.trades[0].fundingSource = "external";
    storage.setRawItem(portfolioStorageKey, JSON.stringify(current));
    expect(createPortfolioStore({ storage, now }).getState().storageRecovery).not.toBeNull();
  });

  it("confirms an opening value with the fingerprint of the records it stands on, and never touches other records", () => {
    const { store, storage } = harness();
    const before = store.getState().captureBackup().payload.portfolio;
    const result = store.getState().setMeasurementBasis({ startDate: "2026-01-05", kind: "openingValue",
      openingBreakdown: [{ label: " Holdings ", valueInr: 1000 }, { label: "Cash", valueInr: 4000.5 }] });
    expect(result).toEqual({ status: "applied", basis: {
      startDate: "2026-01-05", kind: "openingValue", openingValueInr: 5000.5,
      openingBreakdown: [{ label: "Holdings", valueInr: 1000 }, { label: "Cash", valueInr: 4000.5 }],
      confirmedAt: "2026-10-05T10:00:00.000Z", evidenceDigest: measurementEvidenceDigest(store.getState(), "2026-01-05"),
    } });
    expect({ ...store.getState().captureBackup().payload.portfolio, measurementBasis: null }).toEqual(before);
    expect(createPortfolioStore({ storage, now }).getState().measurementBasis).toEqual(store.getState().measurementBasis);
  });

  it("rejects an invalid basis without changing anything, and removes one", () => {
    const { store } = harness();
    expect(store.getState().setMeasurementBasis({ startDate: "2027-01-01", kind: "inception", openingBreakdown: [] }))
      .toEqual({ status: "rejected", reason: "invalidEntry", problems: ["Start date can't be in the future."] });
    expect(store.getState().measurementBasis).toBeNull();
    store.getState().setMeasurementBasis({ startDate: "2026-01-01", kind: "inception", openingBreakdown: [] });
    expect(store.getState().measurementBasis).toMatchObject({ kind: "inception", openingValueInr: null, evidenceDigest: null });
    expect(store.getState().setMeasurementBasis(null)).toEqual({ status: "applied", basis: null });
    expect(store.getState().measurementBasis).toBeNull();
  });

  it("round-trips through backup and rejects a tampered basis", async () => {
    const { store } = harness();
    store.getState().setMeasurementBasis({ startDate: "2026-01-05", kind: "openingValue", openingBreakdown: [{ label: "All", valueInr: 5000 }] });
    const payload = store.getState().captureBackup().payload;
    const text = await createPortfolioBackup(payload, { appVersion: "1.0.27", createdAt: now().toISOString() }, digest);
    const target = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    target.getState().replaceFromBackup((await parsePortfolioBackup(text, digest)).payload, target.getState().getBackupRevision());
    expect(target.getState().captureBackup().payload).toEqual(payload);
    const tampered = JSON.parse(JSON.stringify(payload));
    tampered.portfolio.measurementBasis.openingValueInr = 6000;
    const fresh = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const before = fresh.getState();
    expect(() => fresh.getState().replaceFromBackup(tampered, fresh.getState().getBackupRevision())).toThrow();
    expect(fresh.getState()).toBe(before);
  });
});

describe("PPF entries paid from or into Cash (D11)", () => {
  it("creates, corrects and deletes the owned Cash leg with its entry, and protects it", () => {
    const { store } = harness();
    expect(store.getState().addPpfLedgerEntry(ppfDeposit())).toMatchObject({ status: "applied" });
    expect(leg(store)).toEqual({ id: "ppf:ppf-dep:cash", amount: 2000, date: "2026-02-01", label: "To PPF · Family PPF",
      linkedPpf: { accountId: "ppf", entryId: "ppf-dep" }, purpose: "ppfTransfer", type: "withdrawal" });
    expect(store.getState().deleteManualCashEntry("ppf:ppf-dep:cash")).toEqual({ reason: "linkedEntry", status: "rejected" });
    expect(() => store.getState().removeCashEntry("ppf:ppf-dep:cash")).toThrow();
    store.getState().correctPpfLedgerEntry(ppfDeposit({ amount: 2500, date: "2026-02-02" }));
    expect(leg(store)).toMatchObject({ amount: 2500, date: "2026-02-02" });
    store.getState().correctPpfLedgerEntry(ppfDeposit({ fundingSource: "external" }));
    expect(leg(store)).toBeUndefined();
    store.getState().correctPpfLedgerEntry(ppfDeposit());
    expect(store.getState().deletePpfLedgerEntry("ppf-dep")).toMatchObject({ status: "applied" });
    expect(leg(store)).toBeUndefined();
  });

  it("brings a withdrawal into Cash, and removes the account's legs with the account unless later spending needs them", () => {
    const { store } = harness();
    store.getState().addPpfLedgerEntry(ppfDeposit({ amount: 4000, fundingSource: "external" }));
    const withdrawal: PpfLedgerEntry = { id: "ppf-out", accountId: "ppf", date: "2026-03-01", recordedAt: "2026-03-01T00:00:00Z", type: "withdrawal", amount: 3000, fundingSource: "cash" };
    expect(store.getState().addPpfLedgerEntry(withdrawal)).toMatchObject({ status: "applied" });
    expect(store.getState().cashEntries.find((entry) => entry.id === "ppf:ppf-out:cash")).toMatchObject({ type: "addition", label: "From PPF · Family PPF" });
    store.getState().addCashEntry({ id: "spend", amount: 6000, date: "2026-03-02", label: "Out", purpose: "withdrawal", type: "withdrawal" });
    expect(store.getState().deletePpfAccount("ppf")).toEqual({ reason: "insufficientCash", status: "rejected" });
    store.getState().deleteManualCashEntry("spend");
    expect(store.getState().deletePpfAccount("ppf")).toMatchObject({ status: "applied" });
    expect(store.getState().cashEntries.some((entry) => entry.linkedPpf)).toBe(false);
  });

  it("rejects a deposit from Cash that Cash can't cover", () => {
    const { store } = harness();
    expect(store.getState().addPpfLedgerEntry(ppfDeposit({ amount: 9000 }))).toEqual({ reason: "insufficientCash", status: "rejected" });
    expect(store.getState().ppfLedgerEntries).toEqual([]);
  });

  it("keeps the Cash-to-PPF move out of monthly performance flows", () => {
    const { store } = harness();
    store.getState().addPpfLedgerEntry(ppfDeposit());
    const basis = buildMonthlyPerformanceBasis({ cashEntries: store.getState().cashEntries, openingPositions: [],
      ppfLedgerEntries: store.getState().ppfLedgerEntries, targetMonth: "2026-02" });
    expect(basis).toMatchObject({ status: "complete", netExternalFlow: 0 });
  });

  it("refuses to replace an account history that owns Cash legs", () => {
    const { store } = harness();
    store.getState().addPpfLedgerEntry(ppfDeposit());
    const input = { accountId: "ppf", balanceAsOf: "2025-12-31", baselineFyContribution: 0, completeThrough: "2026-10-05",
      csv: "date,type,amount,note\n2026-02-01,contribution,2000,Deposit\n", openingBalance: 0 };
    const plan = planPpfCsvImport(input, store.getState().ppfAccounts, store.getState().ppfLedgerEntries, now());
    expect(store.getState().importPpfCsv({ input, expectedState: plan.expectedState, confirmReplacement: true, confirmDuplicateRows: true }))
      .toMatchObject({ status: "rejected" });
    expect(leg(store)).toBeDefined();
  });

  it.each(["amount", "orphanLeg", "missingLeg"])("rejects a backup with a %s PPF Cash link", (kind) => {
    const { store } = harness();
    store.getState().addPpfLedgerEntry(ppfDeposit());
    const payload = JSON.parse(JSON.stringify(store.getState().captureBackup().payload));
    const cash = payload.portfolio.cashEntries.find((entry: CashEntry) => entry.linkedPpf);
    if (kind === "amount") cash.amount += 1;
    if (kind === "orphanLeg") payload.portfolio.ppfLedgerEntries = [];
    if (kind === "missingLeg") payload.portfolio.cashEntries = payload.portfolio.cashEntries.filter((entry: CashEntry) => !entry.linkedPpf);
    const target = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    const before = target.getState();
    expect(() => target.getState().replaceFromBackup(payload, target.getState().getBackupRevision())).toThrow();
    expect(target.getState()).toBe(before);
  });
});

describe("trade funding marks (D10)", () => {
  it("marks trades without a Cash leg, keeps the mark through a correction, and clears it", () => {
    const { store, storage } = harness();
    expect(store.getState().setTradeFundingSource(["buy"], "external")).toEqual({ status: "applied" });
    expect(createPortfolioStore({ storage, now }).getState().trades[0]).toMatchObject({ fundingSource: "external" });
    store.getState().correctTrade({ id: "buy", assetId: "stock", type: "buy", date: "2026-01-06", quantity: 10, pricePerUnit: 101 });
    expect(store.getState().trades[0]).toMatchObject({ fundingSource: "external", date: "2026-01-06" });
    store.getState().setTradeFundingSource(["buy"], null);
    expect(store.getState().trades[0]).not.toHaveProperty("fundingSource");
  });

  it("rejects unknown and Cash-linked trades without changing anything", () => {
    const { store } = harness();
    store.getState().addCashEntry({ id: "fund", amount: 500, date: "2026-01-07", label: "Buy", purpose: "purchaseFunding", type: "withdrawal", linkedTradeId: "buy" });
    const before = store.getState().trades;
    expect(store.getState().setTradeFundingSource(["missing"], "external")).toEqual({ reason: "notFound", status: "rejected" });
    expect(store.getState().setTradeFundingSource(["buy"], "external")).toEqual({ reason: "linkedCash", status: "rejected" });
    expect(store.getState().setTradeFundingSource([], "external")).toEqual({ reason: "invalidEntry", status: "rejected" });
    expect(store.getState().trades).toBe(before);
  });
});
