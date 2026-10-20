import {
  buildEpfEntry, buildEpfReversal, draftFromEpfEvent, emptyEpfEntryDraft, eventAmountLabel, eventTitle,
  financialYearOptions, financialYearPeriod, type EpfEntryDraft,
} from "../epfEntryForm";
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
  expect(!tooMuch.ok && tooMuch.message).toBe("On 05 May 2026 Acme has a recorded balance of ₹1,40,000.00, less than this " +
    "₹1,50,000.00 withdrawal. If the payout closed the account and included interest, mark it as a final settlement.");
});

describe("final settlement", () => {
  // Acme holds 1,00,000 + 40,000. The claim also pays 3,000 + 1,000 interest.
  const settle = (patch: Partial<EpfEntryDraft> = {}) => draft({ kind: "withdrawal", amount: "144000", employee: "103000",
    employer: "41000", settlement: true, settlementInterest: "4000", settlementInterestEmployee: "3000",
    settlementInterestEmployer: "1000", ...patch });

  test("records the payout and the interest paid with it as one entry that empties the account", () => {
    const result = buildEpfEntry(settle(), context());
    expect(result.ok && result.plan.event).toMatchObject({ type: "withdrawal", capitalReduction: null,
      amount: { total: 144000, components: { employee: 103000, employer: 41000 } },
      settlement: { interest: { total: 4000, components: { employee: 3000, employer: 1000 } } } });
    expect(result.ok && result.plan.effect).toMatchObject({ totalBefore: 140000, totalAfter: 0 });
    expect(result.ok && draftFromEpfEvent(result.plan.event, "a", false, now)).toMatchObject({ settlement: true,
      settlementInterest: "4000", settlementInterestEmployee: "3000", settlementInterestEmployer: "1000" });
  });

  test("names the shortfall when balance plus interest is not what was paid", () => {
    const result = buildEpfEntry(settle({ amount: "145000", employee: "104000" }), context());
    expect(!result.ok && result.message).toBe("On 05 May 2026 the recorded balance is ₹1,40,000.00. With ₹4,000.00 interest " +
      "that makes ₹1,44,000.00, but ₹1,45,000.00 was paid. Check for missing contributions, the interest amount or the split.");
  });

  test("points to a later entry, such as interest the passbook lists under the year end", () => {
    const yearEnd = plan({ kind: "interest", amount: "4000", date: "2026-06-30", postedDate: "2026-06-30" }, [], "late");
    const result = buildEpfEntry(settle(), context([yearEnd.event]));
    expect(!result.ok && result.message).toBe("A final settlement must be the last entry in this account. Remove the " +
      "official interest on 30 Jun 2026: the settlement already pays interest up to its own date.");
  });

  test("requires the interest amount and a split that adds up", () => {
    const blank = buildEpfEntry(settle({ settlementInterest: "" }), context());
    expect(!blank.ok && blank.errors.settlementInterest).toBe("Enter the interest paid with the settlement, or 0 if none.");
    const split = buildEpfEntry(settle({ settlementInterestEmployer: "900" }), context());
    expect(!split.ok && split.errors.settlementInterestEmployer).toBe("The two parts must add up to the interest.");
  });
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

describe("financial year summary", () => {
  const old: EpfAccount = { ...acme, checkpoint: { ...acme.checkpoint, date: "2024-03-31" } };
  const summaryContext = (events: EpfEvent[] = []) => ({ ...context(events, "s1"), account: old, accounts: [old] });
  const year = (patch: Partial<EpfEntryDraft> = {}) => draft({ kind: "yearSummary", periodStart: "2024-04-01", date: "2025-03-31",
    contributionEmployee: "21600", contributionEmployer: "6600", interestEmployee: "9500", interestEmployer: "3800",
    closingEmployee: "131100", closingEmployer: "50400", ...patch });

  test("offers each year after the starting balance and trims the current one to today", () => {
    expect(financialYearOptions(old, now).map((item) => item.label)).toEqual(["2026-27", "2025-26", "2024-25"]);
    expect(financialYearPeriod("2024-04-01", old, now)).toEqual({ periodStart: "2024-04-01", date: "2025-03-31" });
    expect(financialYearPeriod("2026-04-01", old, now)).toEqual({ periodStart: "2026-04-01", date: "2026-10-17" });
    expect(financialYearPeriod("2026-04-01", acme, now).periodStart).toBe("2026-04-01");
  });

  test("records one year that matches the passbook closing balance", () => {
    const result = buildEpfEntry(year(), summaryContext());
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(result.plan.event).toMatchObject({ type: "yearSummary", periodStart: "2024-04-01", effectiveDate: "2025-03-31",
      contributions: { employee: 21600, employer: 6600 }, interest: { employee: 9500, employer: 3800 },
      closing: { employee: 131100, employer: 50400 }, evidence: "EPFO passbook" });
    expect(result.plan.effect).toMatchObject({ totalBefore: 140000, totalAfter: 181500, cashChange: 0 });
    expect(eventTitle(result.plan.event)).toBe("FY 2024-25 summary");
    expect(eventAmountLabel(result.plan.event, "a")).toBe("+₹41,500.00");
    expect(draftFromEpfEvent(result.plan.event, "a", false, now)).toMatchObject({ kind: "yearSummary", periodStart: "2024-04-01",
      date: "2025-03-31", contributionEmployee: "21600", closingEmployer: "50400" });
  });

  test("names the mismatch by part instead of saving", () => {
    const result = buildEpfEntry(year({ closingEmployee: "131550" }), summaryContext());
    expect(!result.ok && result.message).toBe("The closing balance on 31 Mar 2025 does not match: employee ₹1,31,100.00 calculated, " +
      "₹1,31,550.00 in the passbook. Check the totals, and any withdrawal or transfer recorded in this period.");
  });

  test("needs the closing balance at 31 Mar, every part, and a period inside one year", () => {
    const missing = buildEpfEntry(year({ closingEmployee: "", closingEmployer: "" }), summaryContext());
    expect(!missing.ok && missing.errors.closingEmployee).toBe("Enter the passbook closing balance for this part.");
    const shorter = buildEpfEntry(year({ date: "2024-09-30", closingEmployee: "", closingEmployer: "", interestEmployee: "0", interestEmployer: "0" }), summaryContext());
    expect(shorter.ok && shorter.plan.event).toMatchObject({ closing: null });
    const blank = buildEpfEntry(year({ interestEmployer: "" }), summaryContext());
    expect(!blank.ok && blank.errors.interestEmployer).toMatch(/or 0/);
    const zero = buildEpfEntry(year({ contributionEmployee: "0", contributionEmployer: "0", interestEmployee: "0", interestEmployer: "0",
      date: "2024-09-30", closingEmployee: "", closingEmployer: "" }), summaryContext());
    expect(!zero.ok && zero.errors.contributionEmployee).toBe("Enter the contributions or interest for the period.");
    const across = buildEpfEntry(year({ date: "2025-04-30" }), summaryContext());
    expect(!across.ok && across.errors.date).toBe("End within the same financial year, by 31 Mar 2025.");
    const early = buildEpfEntry(year({ periodStart: "2024-03-31" }), summaryContext());
    expect(!early.ok && early.errors.periodStart).toMatch(/after the starting balance/);
  });

  test("explains entries already recorded inside the period, in both directions", () => {
    const may: EpfEvent = { id: "c1", accountId: "a", type: "contribution", party: "employee", amount: 1800,
      effectiveDate: "2024-05-01", postedDate: "2024-05-01", recordedAt: "2026-10-17T10:00:00Z", evidence: "EPFO passbook" };
    const blocked = buildEpfEntry(year(), summaryContext([may]));
    expect(!blocked.ok && blocked.message).toBe("1 entry is already recorded in this period, starting with the Employee contribution " +
      "on 01 May 2024. Delete them, or shorten the period so it does not overlap them.");
    const saved = buildEpfEntry(year(), summaryContext());
    if (!saved.ok) throw new Error("summary");
    const inside = buildEpfEntry(draft({ kind: "employeeContribution", amount: "1800", date: "2024-06-01" }),
      { ...summaryContext([saved.plan.event]), id: "c2" });
    expect(!inside.ok && inside.message).toBe("The FY 2024-25 summary already includes 01 Apr 2024 to 31 Mar 2025. " +
      "Correct the summary instead, or shorten its period first.");
  });
});
