import {
  calculateEpfLedger, changeEpfEvent, epfAccountSchema,
} from "@/src/domain/epf";
import type { EpfAccount, EpfBalance, EpfEvent, EpfLedger } from "@/src/domain/epf";

const today = "2026-10-05";
const balance = (employee: number, employer: number): EpfBalance => ({
  total: employee + employer, components: { employee, employer },
});
const account = (id = "a", employee = 100000, employer = 40000): EpfAccount => ({
  id, nickname: id, provider: "epfo", status: "active", currency: "INR",
  checkpoint: { date: "2026-01-01", balance: balance(employee, employer), capital: null,
    source: "epfoStatement", recordedAt: "2026-01-02T00:00:00Z" },
  historyCompleteThrough: today,
});
const base = { id: "event", recordedAt: "2026-03-01T00:00:00Z",
  effectiveDate: "2026-02-01", postedDate: "2026-02-02", evidence: "Confirmed statement entry" };
const contribution = (id = "contribution", amount = 1200): EpfEvent => ({
  ...base, id, accountId: "a", type: "contribution", party: "employee", amount,
});
const transfer = (): EpfEvent & { type: "transfer" } => ({
  ...base, type: "transfer", sourceId: "a", destinationId: "b",
  amount: balance(40000, 10000), capital: 30000, status: "completed", creditDate: "2026-02-03",
});
function value(ledger: EpfLedger, asOf = today) {
  const result = calculateEpfLedger(ledger, asOf, today);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result;
}
function knownAccount(id = "a", employee = 100000, employer = 40000, capital = 90000) {
  const result = account(id, employee, employer);
  result.checkpoint.capital = capital;
  return result;
}

describe("EPF confirmed account accounting", () => {
  test("values EPF components only; unknown capital is not opening value", () => {
    const result = value({ accounts: [account()], events: [] });
    expect(result.total).toBe(140000);
    expect(result.capital).toBeNull();
    expect(result.coverageReasons).toContain("a:unknownCapital");
    expect(epfAccountSchema.safeParse({ ...account(), eps: 20000 }).success).toBe(false);
  });

  test("contributions and credited interest have different capital effects", () => {
    const events: EpfEvent[] = [contribution(),
      { ...base, id: "employer", type: "contribution", accountId: "a", party: "employer", amount: 367 },
      { ...base, id: "interest", type: "interest", accountId: "a", amount: balance(700, 300) }];
    const result = value({ accounts: [knownAccount()], events });
    expect(result.total).toBe(142567);
    expect(result.capital).toBe(91567);
    expect(result.accounts[0].balance.components).toEqual({ employee: 101900, employer: 40667 });
    expect(value({ accounts: [account()], events }).capital).toBeNull();
  });

  test("aggregate-only interest preserves total but makes component attribution unknown", () => {
    const result = value({ accounts: [knownAccount()], events: [{ ...base, type: "interest",
      accountId: "a", amount: { total: 1000, components: null } }] });
    expect(result.total).toBe(141000);
    expect(result.capital).toBe(90000);
    expect(result.accounts[0].balance.components).toBeNull();
  });

  test("single matched transfer preserves aggregate value and capital", () => {
    const ledger = { accounts: [knownAccount(), knownAccount("b", 0, 0, 0)], events: [transfer()] };
    const result = value(ledger);
    expect(result.total).toBe(140000);
    expect(result.capital).toBe(90000);
    expect(result.accounts.map((item) => item.balance.total)).toEqual([90000, 50000]);
    expect(result.accounts.map((item) => item.capital)).toEqual([60000, 30000]);
    expect(result.inTransit).toBe(0);
    const retry = changeEpfEvent(ledger, { type: "put", event: transfer() }, today);
    expect(retry.ok).toBe(true);
    if (retry.ok) expect(retry.ledger.events).toHaveLength(1);
  });

  test("confirmed debit remains in explicit transit until credit, without disappearing wealth", () => {
    const result = value({ accounts: [knownAccount(), knownAccount("b", 0, 0, 0)],
      events: [transfer()] }, "2026-02-02");
    expect(result.total).toBe(140000);
    expect(result.inTransit).toBe(50000);
    expect(result.capital).toBe(90000);
    expect(result.coverageReasons).toContain("transferInTransit");
  });

  test("requested transfers do not change balances or create transit value", () => {
    const result = value({ accounts: [account(), account("b", 0, 0)],
      events: [{ ...transfer(), status: "requested", creditDate: null }] });
    expect(result.total).toBe(140000);
    expect(result.inTransit).toBe(0);
  });

  test("in-transit status remains explicit at current date", () => {
    const result = value({ accounts: [account(), account("b", 0, 0)],
      events: [{ ...transfer(), status: "inTransit", creditDate: null }] });
    expect(result.total).toBe(140000);
    expect(result.inTransit).toBe(50000);
  });

  test("unknown source capital cannot become known at the destination", () => {
    const result = value({ accounts: [account(), knownAccount("b", 0, 0, 0)], events: [transfer()] });
    expect(result.capital).toBeNull();
    expect(result.accounts[1].capital).toBeNull();
  });

  test("reconciliation is not invented return or investment", () => {
    const result = value({ accounts: [knownAccount()], events: [{ ...base, type: "reconciliation",
      accountId: "a", balance: balance(120000, 45000), capital: null, reason: "New statement" }] });
    expect(result.total).toBe(165000);
    expect(result.capital).toBeNull();
    expect(result.coverageReasons).toContain("event:reconciliationNotReturn");
  });

  test("withdrawal needs evidenced capital allocation, and never writes Cash", () => {
    const ledger: EpfLedger = { accounts: [knownAccount()], events: [{ ...base, type: "withdrawal",
      accountId: "a", amount: balance(1000, 0), capitalReduction: null, destination: "unknown" }] };
    const original = JSON.stringify(ledger);
    const result = value(ledger);
    expect(result.total).toBe(139000);
    expect(result.capital).toBeNull();
    expect(result.coverageReasons).toContain("event:unknownWithdrawalDestination");
    expect(JSON.stringify(ledger)).toBe(original);
  });

  test("untracked transfer origin remains return-incomplete", () => {
    const result = value({ accounts: [knownAccount()], events: [{ ...base, type: "externalTransferIn",
      accountId: "a", amount: balance(10000, 5000), capital: null }] });
    expect(result.total).toBe(155000);
    expect(result.capital).toBeNull();
    expect(result.coverageReasons).toContain("event:untrackedTransferOrigin");
  });

  test("posting date and wage month do not replace effective date", () => {
    const event: EpfEvent = { ...contribution(), wageMonth: "2025-12" } as EpfEvent;
    const ledger = { accounts: [account()], events: [event] };
    expect(value(ledger, "2026-01-31").total).toBe(140000);
    expect(value(ledger, "2026-02-01").total).toBe(141200);
  });

  test("delayed interest restates evidenced effective period, not posting month", () => {
    const ledger: EpfLedger = { accounts: [account()], events: [{ ...base, type: "interest",
      accountId: "a", effectiveDate: "2026-03-31", postedDate: "2026-09-01",
      amount: balance(700, 300) }] };
    expect(value(ledger, "2026-03-30").total).toBe(140000);
    expect(value(ledger, "2026-03-31").total).toBe(141000);
  });

  test("same-day order is deterministic across input ordering", () => {
    const events: EpfEvent[] = [contribution("a"), { ...base, id: "z", type: "reconciliation",
      accountId: "a", balance: balance(10, 20), capital: null, reason: "Confirmed correction" }];
    expect(value({ accounts: [account()], events })).toEqual(value({ accounts: [account()], events: [...events].reverse() }));
  });

  test("closed account retains value; absent historical checkpoint is explicit", () => {
    const closed = { ...account(), status: "closed" as const, historyCompleteThrough: null };
    expect(value({ accounts: [closed], events: [] }).total).toBe(140000);
    expect(value({ accounts: [closed], events: [] }).coverageReasons).toContain("a:incompleteHistory");
    const before = value({ accounts: [closed], events: [] }, "2025-12-31");
    expect(before.coverageReasons).toContain("a:beforeCheckpoint");
    expect(before.total).toBeNull();
    expect(before.capital).toBeNull();
    expect(before.coveredTotal).toBe(0);
    expect(value({ accounts: [closed], events: [] }, "2026-01-01").accounts[0].historyComplete).toBe(true);
  });

  test("supports exact paise without floating-point accumulation", () => {
    expect(value({ accounts: [knownAccount("a", 0, 0, 0)],
      events: [contribution("a", 0.1), contribution("b", 0.2)] }).total).toBe(0.3);
  });

  test("edits/removals replay both transfer legs and reject broken dependent balances", () => {
    const ledger: EpfLedger = { accounts: [knownAccount(), knownAccount("b", 0, 0, 0)], events: [transfer()] };
    const removed = changeEpfEvent(ledger, { type: "remove", id: "event" }, today);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.result.accounts.map((item) => item.balance.total)).toEqual([140000, 0]);
    const edited = changeEpfEvent(ledger, { type: "put", event: { ...transfer(), amount: balance(20000, 0) } }, today);
    expect(edited.ok).toBe(true);
    if (edited.ok) expect(edited.result.total).toBe(140000);
    ledger.events.push({ ...base, id: "withdraw", type: "withdrawal", accountId: "b",
      effectiveDate: "2026-02-04", amount: balance(1000, 0), capitalReduction: 1000, destination: "external" });
    const before = JSON.stringify(ledger);
    expect(changeEpfEvent(ledger, { type: "remove", id: "event" }, today).ok).toBe(false);
    expect(JSON.stringify(ledger)).toBe(before);
  });

  test.each([
    { ...contribution(), amount: NaN },
    { ...contribution(), amount: Infinity },
    { ...contribution(), amount: -1 },
    { ...contribution(), amount: 0 },
    { ...contribution(), amount: 0.001 },
    { ...contribution(), effectiveDate: "2026-02-30" },
    { ...contribution(), effectiveDate: "2026-01-01" },
    { ...contribution(), effectiveDate: "2027-01-01" },
    { ...contribution(), accountId: "missing" },
    { ...contribution(), type: "epsContribution" },
    { ...contribution(), party: "employer", voluntary: true },
    { ...transfer(), sourceId: "b" },
    { ...transfer(), creditDate: "2026-01-31" },
    { ...transfer(), creditDate: null },
    { ...transfer(), status: "requested" },
    { ...transfer(), amount: balance(100001, 0) },
    { ...transfer(), capital: 90001 },
  ])("rejects invalid event %# atomically", (event) => {
    expect(calculateEpfLedger({ accounts: [knownAccount(), knownAccount("b", 0, 0, 0)],
      events: [event] }, today, today).ok).toBe(false);
  });

  test("rejects duplicate records and inconsistent components", () => {
    expect(calculateEpfLedger({ accounts: [account(), account()], events: [] }, today, today).ok).toBe(false);
    expect(calculateEpfLedger({ accounts: [account()], events: [contribution(), contribution()] }, today, today).ok).toBe(false);
    const broken = account();
    broken.checkpoint.balance.total = 1;
    expect(calculateEpfLedger({ accounts: [broken], events: [] }, today, today).ok).toBe(false);
    expect(changeEpfEvent({ accounts: [account()], events: [contribution(), contribution()] },
      { type: "put", event: contribution() }, today).ok).toBe(false);
  });

  test("partial historical coverage cannot masquerade as a whole-EPF total", () => {
    const earlier = knownAccount();
    earlier.checkpoint.date = "2025-01-01";
    const result = value({ accounts: [earlier, account("b")], events: [] }, "2025-12-31");
    expect(result.coveredTotal).toBe(140000);
    expect(result.total).toBeNull();
  });

  test("aggregate overflow fails instead of rounding a large portfolio", () => {
    const a = knownAccount("a", 90000000000000, 0, 0);
    const b = knownAccount("b", 90000000000000, 0, 0);
    expect(calculateEpfLedger({ accounts: [a, b], events: [] }, today, today).ok).toBe(false);
  });

  test("source/destination checkpoint overlap fails rather than duplicate a transfer", () => {
    const destination = account("b");
    destination.checkpoint.date = "2026-02-02";
    expect(calculateEpfLedger({ accounts: [account(), destination], events: [transfer()] }, today, today).ok).toBe(false);
  });

  test("same-day recorded timestamps compare actual instants across offsets", () => {
    const events: EpfEvent[] = [
      { ...contribution(), recordedAt: "2026-03-01T04:30:00+05:30" },
      { ...base, type: "reconciliation", id: "reset", accountId: "a", recordedAt: "2026-03-01T00:00:00Z",
        balance: balance(10, 20), capital: null, reason: "Final value" },
    ];
    expect(value({ accounts: [account()], events }).total).toBe(30);
  });

  test("no tracked-Cash linkage is accepted without a validated counterpart model", () => {
    expect(calculateEpfLedger({ accounts: [account()], events: [{ ...base, type: "withdrawal",
      accountId: "a", amount: balance(1000, 0), capitalReduction: null, destination: "trackedCash",
      cashEntryId: "unverified" }] }, today, today).ok).toBe(false);
  });

  test.each(["contribution", "interest", "withdrawal"] as const)("reverses an evidenced %s without inventing capital", (type) => {
    const original: EpfEvent = type === "contribution" ? contribution()
      : type === "interest" ? { ...base, accountId: "a", type, amount: balance(100, 0) }
        : { ...base, accountId: "a", type, amount: balance(100, 0), capitalReduction: 70, destination: "external" };
    const reversal: EpfEvent = { ...base, id: "reverse", accountId: "a", type: "reversal",
      reversesId: original.id, effectiveDate: "2026-02-10", reason: "Provider reversed entry" };
    const ledger = { accounts: [knownAccount()], events: [original, reversal] };
    expect(value(ledger).total).toBe(140000);
    expect(value(ledger).capital).toBe(90000);
    expect(calculateEpfLedger({ ...ledger, events: [...ledger.events, { ...reversal, id: "twice" }] }, today, today).ok).toBe(false);
    expect(changeEpfEvent(ledger, { type: "remove", id: original.id }, today).ok).toBe(false);
  });
});
