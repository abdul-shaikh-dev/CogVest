import { createHash } from "node:crypto";

import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { calculateEpfLedger, type EpfAccount, type EpfEvent } from "@/src/domain/epf";
import { type EpfChange, emptyEpfState } from "@/src/domain/epf/persistence";
import { createPortfolioBackup, parsePortfolioBackup } from "@/src/domain/portfolioBackup";
import { seedVisualQaPortfolio } from "@/src/testing/visualQaSeed";

const now = () => new Date("2026-10-05T10:00:00Z");
const digest = async (text: string) => createHash("sha256").update(text).digest("hex");
const account = (id = "a"): EpfAccount => ({
  id, nickname: "EPF", provider: "epfo", status: "active", currency: "INR",
  checkpoint: { date: "2026-01-01", balance: { total: 140000, components: { employee: 100000, employer: 40000 } },
    capital: null, source: "epfoStatement", recordedAt: "2026-01-02T00:00:00Z" },
  historyCompleteThrough: null,
});
const withdrawal: EpfEvent = { id: "withdrawal", type: "withdrawal", accountId: "a",
  effectiveDate: "2026-02-01", postedDate: "2026-02-01", recordedAt: "2026-02-02T00:00:00Z",
  evidence: "Statement", amount: { total: 5000, components: { employee: 5000, employer: 0 } },
  capitalReduction: null, destination: "unknown" };
function harness() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  let sequence = 0;
  const apply = (change: EpfChange, commandId = `command-${++sequence}`) => store.getState().applyEpfCommand(
    { commandId, reason: "Confirmed evidence", change }, store.getState().getBackupRevision());
  return { store, storage, apply };
}

describe("EPF durable account records", () => {
  test("migrates a populated V15 record once without changing other financial records", () => {
    const { store, storage } = harness();
    seedVisualQaPortfolio(store);
    store.getState().addPpfAccount({ id: "ppf", nickname: "PPF", provider: "Post", balanceAsOf: "2026-01-01", confirmedBalance: 1000,
      createdAt: "2026-01-01T00:00:00Z", opening: { kind: "financialYear", financialYearStart: 2025 }, status: "active" });
    store.getState().saveFuturesAccount({ id: "futures", settlementAsset: "USDT", marginMode: "cross", positionMode: "one-way",
      openingAt: "2026-01-01T00:00:00Z", openingWalletUsdt: "100", events: [] });
    const original = createPortfolioStore({ storage, now }).getState().captureBackup().payload;
    const legacy = JSON.parse(JSON.stringify(original.portfolio));
    delete legacy.epf;
    legacy.schemaVersion = 15;
    const backupTarget = harness();
    backupTarget.store.getState().replaceFromBackup({ ...original, portfolio: legacy }, backupTarget.store.getState().getBackupRevision());
    expect(backupTarget.store.getState().captureBackup().payload).toEqual(original);
    storage.setRawItem(portfolioStorageKey, JSON.stringify(legacy));
    const write = jest.spyOn(storage, "setItem");
    const migrated = createPortfolioStore({ storage, now });
    expect(migrated.getState().captureBackup().payload).toEqual(original);
    expect(migrated.getState().epf).toEqual(emptyEpfState());
    expect(write.mock.calls.filter(([key]) => key === portfolioStorageKey)).toHaveLength(1);
    expect(createPortfolioStore({ storage, now }).getState().captureBackup().payload).toEqual(original);
    expect(write.mock.calls.filter(([key]) => key === portfolioStorageKey)).toHaveLength(1);
  });

  test("saves snapshots, corrections and audit history without caller aliases", () => {
    const { store, storage, apply } = harness();
    const input = account();
    apply({ type: "accountPut", account: input });
    input.checkpoint.balance.total = 1;
    expect(store.getState().epf.accounts[0].checkpoint.balance.total).toBe(140000);
    apply({ type: "eventPut", event: withdrawal, cash: null });
    apply({ type: "eventPut", event: { ...withdrawal, amount: { total: 1000, components: null } }, cash: null });
    expect(store.getState().epf.audit[2].previousEvent).toEqual(withdrawal);
    expect(store.getState().epf.accounts[0].checkpoint.capital).toBeNull();
    expect(createPortfolioStore({ storage, now }).getState().epf).toEqual(store.getState().epf);
    apply({ type: "eventRemove", id: withdrawal.id });
    apply({ type: "accountRemove", id: "a" });
    expect(store.getState().epf.accounts).toEqual([]);
    expect(store.getState().epf.audit).toHaveLength(5);
  });

  test("linked withdrawal saves both records atomically, protects Cash, and corrects/deletes both", () => {
    const { store, storage, apply } = harness();
    apply({ type: "accountPut", account: account() });
    const write = jest.spyOn(storage, "setItem");
    apply({ type: "eventPut", event: withdrawal, cash: { id: "cash-epf", label: "From EPF" } });
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.getState().cashEntries[0]).toMatchObject({ amount: 5000, purpose: "epfTransfer", type: "addition" });
    expect(store.getState().deleteManualCashEntry("cash-epf")).toMatchObject({ status: "rejected", reason: "linkedEntry" });
    expect(() => store.getState().removeCashEntry("cash-epf")).toThrow();
    apply({ type: "eventPut", event: { ...withdrawal, amount: { total: 6000, components: null } }, cash: { id: "cash-epf", label: "From EPF" } });
    expect(store.getState().cashEntries[0].amount).toBe(6000);
    const epf = store.getState().epf;
    const result = calculateEpfLedger({ accounts: epf.accounts, events: epf.events }, "2026-10-05", "2026-10-05");
    expect(result.ok && result.total! + store.getState().cashEntries[0].amount).toBe(140000);
    apply({ type: "eventRemove", id: withdrawal.id });
    expect(store.getState().cashEntries).toEqual([]);
    expect(store.getState().epf.cashLinks).toEqual([]);
    expect(store.getState().epf.audit.at(-1)?.previousCash?.amount).toBe(6000);
  });

  test("Cash funding is explicit, reconciles direction, and cannot spend unavailable historical cash", () => {
    const { store, apply } = harness();
    apply({ type: "accountPut", account: account() });
    const contribution: EpfEvent = { id: "contribution", accountId: "a", type: "contribution", party: "employee", amount: 1000,
      effectiveDate: withdrawal.effectiveDate, postedDate: withdrawal.postedDate, recordedAt: withdrawal.recordedAt, evidence: "Statement" };
    expect(() => apply({ type: "eventPut", event: contribution, cash: { id: "cash-funding", label: "To EPF" } })).toThrow(/insufficient/);
    store.getState().addCashEntry({ id: "deposit", label: "Deposit", amount: 2000, date: "2026-01-15", purpose: "capitalContribution", type: "addition" });
    apply({ type: "eventPut", event: contribution, cash: { id: "cash-funding", label: "To EPF" } });
    expect(store.getState().cashEntries.at(-1)).toMatchObject({ type: "withdrawal", amount: 1000 });
    const before = store.getState();
    expect(() => apply({ type: "eventPut", event: { ...contribution, party: "employer" }, cash: { id: "cash-funding", label: "Wrong" } })).toThrow();
    expect(store.getState()).toBe(before);
  });

  test("cannot remove linked funding needed by later Cash spending", () => {
    const { store, apply } = harness();
    apply({ type: "accountPut", account: account() });
    apply({ type: "eventPut", event: withdrawal, cash: { id: "cash-epf", label: "From EPF" } });
    store.getState().addCashEntry({ id: "spent", type: "withdrawal", purpose: "withdrawal", date: "2026-02-10", amount: 4000, label: "Withdrawal" });
    expect(() => apply({ type: "eventRemove", id: withdrawal.id })).toThrow(/insufficient/);
    expect(store.getState().epf.events).toHaveLength(1);
  });

  test("rejects stale reviews, conflicts, and repeats no commands after restart", () => {
    const { store, storage } = harness();
    const command = { commandId: "once", reason: "Setup", change: { type: "accountPut" as const, account: account() } };
    const revision = store.getState().getBackupRevision();
    expect(store.getState().applyEpfCommand(command, revision)).toBe("applied");
    expect(store.getState().applyEpfCommand(command, revision)).toBe("alreadyApplied");
    expect(createPortfolioStore({ storage, now }).getState().applyEpfCommand(command, revision)).toBe("alreadyApplied");
    expect(() => store.getState().applyEpfCommand({ ...command, reason: "Different" }, revision)).toThrow(/different/);
    expect(() => store.getState().applyEpfCommand({ ...command, commandId: "new" }, revision)).toThrow(/changed/);
    expect(store.getState().epf.audit).toHaveLength(1);
  });

  test("account deletion exposes dependencies and never removes a counterpart or linked Cash", () => {
    const { store, apply } = harness();
    apply({ type: "accountPut", account: account() });
    apply({ type: "accountPut", account: account("b") });
    const transfer: EpfEvent = { id: "transfer", type: "transfer", sourceId: "a", destinationId: "b", amount: { total: 50000, components: null },
      capital: null, status: "completed", effectiveDate: "2026-02-01", creditDate: "2026-02-02", postedDate: "2026-02-02", recordedAt: "2026-02-03T00:00:00Z", evidence: "Transfer evidence" };
    apply({ type: "eventPut", event: transfer, cash: null });
    apply({ type: "eventPut", event: withdrawal, cash: { id: "cash", label: "From EPF" } });
    expect(store.getState().previewEpfAccountDeletion("a")).toMatchObject({ canDelete: false, eventIds: ["transfer", "withdrawal"], counterpartAccountIds: ["b"], cashEntryIds: ["cash"] });
    const before = store.getState();
    expect(() => apply({ type: "accountRemove", id: "a" })).toThrow(/linked events/);
    expect(store.getState()).toBe(before);
    const corrected = account();
    corrected.checkpoint.date = "2026-02-05";
    expect(() => apply({ type: "accountPut", account: corrected })).toThrow();
    expect(store.getState()).toBe(before);
  });

  test("storage failure preserves live state and original bytes", () => {
    const { store, storage, apply } = harness();
    apply({ type: "accountPut", account: account() });
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    storage.setItem = () => { throw new Error("Disk full"); };
    expect(() => apply({ type: "eventPut", event: withdrawal, cash: { id: "cash", label: "From EPF" } })).toThrow("Disk full");
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });

  test("backup round trip preserves transfer history, unknown basis and linked Cash exactly", async () => {
    const { store, apply } = harness();
    apply({ type: "accountPut", account: account() });
    apply({ type: "accountPut", account: { ...account("b"), historyCompleteThrough: "2026-10-05",
      checkpoint: { ...account("b").checkpoint, capital: 140000 } } });
    apply({ type: "eventPut", cash: null, event: { id: "transfer", type: "transfer", sourceId: "a", destinationId: "b",
      amount: { total: 10000, components: null }, capital: null, status: "completed",
      effectiveDate: "2026-02-01", creditDate: "2026-02-02", postedDate: "2026-02-02",
      recordedAt: "2026-02-03T00:00:00Z", evidence: "Confirmed transfer" } });
    apply({ type: "eventPut", event: withdrawal, cash: { id: "cash", label: "From EPF" } });
    const payload = store.getState().captureBackup().payload;
    const text = await createPortfolioBackup(payload, { appVersion: "1.0.24", createdAt: now().toISOString() }, digest);
    const parsed = await parsePortfolioBackup(text, digest);
    expect(parsed.payload).toEqual(payload);
    const destination = harness();
    destination.store.getState().replaceFromBackup(parsed.payload, destination.store.getState().getBackupRevision());
    destination.store.getState().replaceFromBackup(parsed.payload, destination.store.getState().getBackupRevision());
    expect(destination.store.getState().captureBackup().payload).toEqual(payload);
    expect(createPortfolioStore({ storage: destination.storage, now }).getState().epf).toEqual(payload.portfolio.epf);
  });

  test.each(["missing", "future", "dangling", "amount", "audit", "privateField", "orphanCash"])("rejects %s restore without replacing any records", (kind) => {
    const { store, storage, apply } = harness();
    apply({ type: "accountPut", account: account() });
    apply({ type: "eventPut", event: withdrawal, cash: { id: "cash", label: "From EPF" } });
    const payload = JSON.parse(JSON.stringify(store.getState().captureBackup().payload));
    if (kind === "missing") delete payload.portfolio.epf;
    if (kind === "future") payload.portfolio.schemaVersion = 17;
    if (kind === "dangling") payload.portfolio.epf.cashLinks[0].eventId = "missing";
    if (kind === "amount") payload.portfolio.cashEntries[0].amount += 1;
    if (kind === "audit") payload.portfolio.epf.audit.push(payload.portfolio.epf.audit[0]);
    if (kind === "privateField") payload.portfolio.epf.accounts[0].uan = "not-collected";
    if (kind === "orphanCash") payload.portfolio.epf.cashLinks = [];
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    expect(() => store.getState().replaceFromBackup(payload, store.getState().getBackupRevision())).toThrow();
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });

  test("malformed persisted EPF is quarantined, preserved, and resets only with explicit recovery action", () => {
    const { store, storage, apply } = harness();
    apply({ type: "accountPut", account: account() });
    const payload = store.getState().captureBackup().payload.portfolio;
    const raw = JSON.stringify({ ...payload, epf: { ...payload.epf, accounts: [account(), account()] } });
    storage.setRawItem(portfolioStorageKey, raw);
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().storageRecovery).toBeDefined();
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(() => restarted.getState().applyEpfCommand({ commandId: "blocked", reason: "Setup", change: { type: "accountPut", account: account() } }, "")).toThrow(/recovery/);
    restarted.getState().resetAffectedStorage();
    expect(restarted.getState().epf).toEqual(emptyEpfState());
  });
});
