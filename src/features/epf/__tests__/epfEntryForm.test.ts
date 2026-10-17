import { buildEpfEntry, buildEpfReversal, draftFromEpfEvent, emptyEpfEntryDraft, type EpfEntryDraft } from "../epfEntryForm";
import { calculateEpfLedger, type EpfAccount, type EpfEvent } from "@/src/domain/epf";

const now = new Date("2026-10-17T10:00:00Z");
const account = (id: string, total: number, employee = total, employer = 0): EpfAccount => ({
  id, nickname: id === "a" ? "Acme" : "Beta", provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
  checkpoint: { date: "2026-03-31", balance: { total, components: { employee, employer } }, capital: null,
    source: "epfoStatement", recordedAt: "2026-04-01T00:00:00Z" },
});
const acme = account("a", 140000, 100000, 40000);
const beta = account("b", 0);
const draft = (patch: Partial<EpfEntryDraft>): EpfEntryDraft => ({ ...emptyEpfEntryDraft(now), date: "2026-05-05", postedDate: "2026-05-05", ...patch });
const context = (events: EpfEvent[] = [], id = "e1") => ({ account: acme, accounts: [acme, beta], events, id, cashId: "cash-1", now });
function plan(patch: Partial<EpfEntryDraft>, events: EpfEvent[] = [], id = "e1") {
  const result = buildEpfEntry(draft(patch), context(events, id));
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.plan;
}

test("1,200 employee + 367 employer, then 1,000 official interest gives 142,567 with different capital roles", () => {
  const employee = plan({ kind: "employeeContribution", amount: "1200", voluntary: true }, [], "c1");
  expect(employee.event).toMatchObject({ type: "contribution", party: "employee", amount: 1200, voluntary: true });
  expect(employee.effect).toMatchObject({ totalBefore: 140000, totalAfter: 141200, cashChange: 0 });
  const employer = plan({ kind: "employerContribution", amount: "367", voluntary: true }, [employee.event], "c2");
  expect(employer.event).not.toHaveProperty("voluntary");
  const interest = plan({ kind: "interest", amount: "1000", date: "2026-05-31", postedDate: "2026-05-31" },
    [employee.event, employer.event], "i1");
  expect(interest.effect.totalAfter).toBe(142567);
  const ledger = calculateEpfLedger({ accounts: [acme, beta], events: [employee.event, employer.event, interest.event] }, "2026-10-17", "2026-10-17");
  expect(ledger.ok && ledger.accounts[0].balance).toEqual({ total: 142567, components: null });
  expect(ledger.ok && ledger.capital).toBeNull();
});

test("an interest split keeps the employee/employer breakdown; delayed credit keeps its effective date", () => {
  const interest = plan({ kind: "interest", amount: "1000", employee: "700", employer: "300", date: "2026-04-30", postedDate: "2026-06-15" }, [], "i1");
  const ledger = calculateEpfLedger({ accounts: [acme, beta], events: [interest.event] }, "2026-10-17", "2026-10-17");
  expect(ledger.ok && ledger.accounts[0].balance).toEqual({ total: 141000, components: { employee: 100700, employer: 40300 } });
  const delayed = buildEpfEntry(draft({ kind: "interest", amount: "1000", date: "2026-04-30", postedDate: "2026-07-15" }), context());
  expect(delayed.ok && delayed.plan.event).toMatchObject({ effectiveDate: "2026-04-30", postedDate: "2026-07-15" });
  const early = buildEpfEntry(draft({ kind: "interest", amount: "1000", date: "2026-05-31", postedDate: "2026-05-01" }), context());
  expect(!early.ok && early.errors.postedDate).toMatch(/before the period/);
});

test("rejects an entry inside the starting balance, a split that does not add up, and zero amounts", () => {
  const inside = buildEpfEntry(draft({ kind: "employeeContribution", amount: "10", date: "2026-03-31" }), context());
  expect(!inside.ok && inside.errors.date).toMatch(/already includes earlier activity/);
  const split = buildEpfEntry(draft({ kind: "withdrawal", amount: "1000", employee: "600", employer: "300" }), context());
  expect(!split.ok && split.errors.employer).toBe("The two parts must add up to the amount.");
  const zero = buildEpfEntry(draft({ kind: "employerContribution", amount: "0" }), context());
  expect(!zero.ok && zero.errors.amount).toBeDefined();
  const future = buildEpfEntry(draft({ kind: "employerContribution", amount: "1", date: "2026-11-01" }), context());
  expect(!future.ok && future.errors.date).toMatch(/future/);
});

test("withdrawals never credit Cash silently; tracked Cash is an explicit linked record", () => {
  const out = plan({ kind: "withdrawal", amount: "5000", destination: "external" });
  expect(out.event).toMatchObject({ type: "withdrawal", destination: "external", capitalReduction: null });
  expect(out.cash).toBeNull();
  const toCash = plan({ kind: "withdrawal", amount: "5000", destination: "cash" });
  expect(toCash.event).toMatchObject({ destination: "unknown" });
  expect(toCash.cash).toEqual({ id: "cash-1", label: "From Acme EPF" });
  expect(toCash.effect.cashChange).toBe(5000);
  const tooMuch = buildEpfEntry(draft({ kind: "withdrawal", amount: "150000" }), context());
  expect(!tooMuch.ok && tooMuch.message).toMatch(/negative/);
});

test("a 50,000 transfer between tracked accounts leaves combined value unchanged, in transit or completed", () => {
  const moving = plan({ kind: "transferOut", amount: "50000", targetAccountId: "b", transferStatus: "inTransit" });
  expect(moving.event).toMatchObject({ type: "transfer", sourceId: "a", destinationId: "b", status: "inTransit", creditDate: null });
  expect(moving.effect).toMatchObject({ totalBefore: 140000, totalAfter: 140000, inTransitAfter: 50000,
    accounts: [{ accountId: "a", before: 140000, after: 90000 }, { accountId: "b", before: 0, after: 0 }] });
  const done = plan({ kind: "transferOut", amount: "50000", targetAccountId: "b", creditDate: "2026-05-09" });
  expect(done.event).toMatchObject({ status: "completed", creditDate: "2026-05-09", postedDate: "2026-05-09" });
  expect(done.effect).toMatchObject({ totalAfter: 140000, inTransitAfter: 0,
    accounts: [{ accountId: "a", after: 90000 }, { accountId: "b", after: 50000 }] });
  const missing = buildEpfEntry(draft({ kind: "transferOut", amount: "1" }), context());
  expect(!missing.ok && missing.errors.targetAccountId).toBeDefined();
  const backwards = buildEpfEntry(draft({ kind: "transferOut", amount: "1", targetAccountId: "b", creditDate: "2026-05-01" }), context());
  expect(!backwards.ok && backwards.errors.creditDate).toMatch(/before it left/);
});

test("transfer in from an untracked account adds value with unknown origin capital", () => {
  const inbound = plan({ kind: "transferIn", amount: "20000" });
  expect(inbound.event).toMatchObject({ type: "externalTransferIn", capital: null });
  expect(inbound.effect.totalAfter).toBe(160000);
});

test("editing keeps the entry identity and round-trips the draft", () => {
  const first = plan({ kind: "withdrawal", amount: "5000", employee: "5000", employer: "0", destination: "cash" });
  const restored = draftFromEpfEvent(first.event, "a", true, now);
  expect(restored).toMatchObject({ kind: "withdrawal", amount: "5000", employee: "5000", employer: "0", destination: "cash" });
  const edited = buildEpfEntry({ ...restored, amount: "4000", employee: "4000" }, { ...context([first.event]), existing: first.event, id: "ignored" });
  expect(edited.ok && edited.plan.event).toMatchObject({ id: "e1", amount: { total: 4000 } });
  expect(edited.ok && edited.plan.effect.totalAfter).toBe(136000);
  const transfer = plan({ kind: "transferOut", amount: "1", targetAccountId: "b", transferStatus: "inTransit" });
  expect(draftFromEpfEvent(transfer.event, "b", false, now)).toMatchObject({ targetAccountId: "a", transferStatus: "inTransit" });
});

test("a provider reversal references an earlier entry and cannot be duplicated", () => {
  const contribution = plan({ kind: "employerContribution", amount: "367" });
  const reversal = buildEpfReversal(contribution.event, { date: "2026-06-01", reason: "Provider correction" },
    { accounts: [acme, beta], events: [contribution.event], id: "r1", now });
  expect(reversal.ok && reversal.event).toMatchObject({ type: "reversal", reversesId: "e1", accountId: "a", effectiveDate: "2026-06-01" });
  if (!reversal.ok) throw new Error("setup");
  const twice = buildEpfReversal(contribution.event, { date: "2026-06-02", reason: "Again" },
    { accounts: [acme, beta], events: [contribution.event, reversal.event], id: "r2", now });
  expect(!twice.ok && twice.message).toMatch(/already been recorded/);
  const early = buildEpfReversal(contribution.event, { date: "2026-05-01", reason: "x" }, { accounts: [acme], events: [contribution.event], id: "r3", now });
  expect(!early.ok && early.errors.date).toMatch(/before the entry/);
  const blank = buildEpfReversal(contribution.event, { date: "2026-06-01", reason: " " }, { accounts: [acme], events: [contribution.event], id: "r4", now });
  expect(!blank.ok && blank.errors.reason).toBeDefined();
});
