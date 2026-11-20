import { calculateEpfLedger, changeEpfEvent } from "@/src/domain/epf";
import { buildEpfMonthlyHistory } from "@/src/domain/epf/history";
import type { EpfAccount, EpfBalance, EpfClaimTransfer, EpfEvent, EpfLedger } from "@/src/domain/epf";

// Synthetic example from #735. The old account holds 58,500 + 24,400. EPFO pays
// 1,500 + 600 interest inside the claim on 5 Sep, so the claim is 60,000 +
// 25,000. The new account receives the balance on 10 Aug, before the claim, and
// the interest on 20 Jan.
const today = "2023-06-30";
const balance = (employee: number, employer: number): EpfBalance => ({
  total: employee + employer, components: { employee, employer },
});
const account = (id: string, start: EpfBalance, capital: number | null): EpfAccount => ({
  id, nickname: id, provider: "epfo", status: "active", currency: "INR",
  checkpoint: { date: "2022-04-01", balance: start, capital, source: "epfoStatement", recordedAt: "2023-06-30T00:00:00Z" },
  historyCompleteThrough: today,
});
const claim = (overrides: Partial<EpfClaimTransfer> = {}): EpfClaimTransfer => ({
  id: "claim", type: "claimTransfer", recordedAt: "2023-06-30T00:00:00Z", evidence: "EPFO passbooks",
  effectiveDate: "2022-09-05", postedDate: "2022-09-05", sourceId: "old", destinationId: "new",
  payout: balance(60000, 25000), interest: balance(1500, 600), status: "completed",
  credits: [
    { date: "2022-08-10", postedDate: "2022-08-10", amount: balance(58500, 24400) },
    { date: "2023-01-20", postedDate: "2023-01-20", amount: balance(1500, 600) },
  ],
  ...overrides,
});
const ledger = (events: EpfEvent[], oldCapital: number | null = 50000, newCapital: number | null = 0): EpfLedger => ({
  accounts: [account("old", balance(58500, 24400), oldCapital), account("new", balance(0, 0), newCapital)],
  events,
});
const at = (input: EpfLedger, asOf: string) => calculateEpfLedger(input, asOf, today);
const errors = (input: EpfLedger) => {
  const result = at(input, today);
  return result.ok ? [] : result.errors;
};
const values = (input: EpfLedger, asOf: string) => {
  const result = at(input, asOf);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const byId = Object.fromEntries(result.accounts.map((item) => [item.accountId, item]));
  return { old: byId.old, new: byId.new, total: result.total, inTransit: result.inTransit,
    capital: result.capital, reasons: result.coverageReasons };
};

describe("EPF transfer settled as a claim (#735)", () => {
  test("records the whole move as one entry and both accounts reconcile", () => {
    const after = values(ledger([claim()]), today);
    expect(after.old).toMatchObject({ balance: balance(0, 0), capital: 0 });
    expect(after.new).toMatchObject({ balance: balance(60000, 25000), capital: 50000 });
    expect(after).toMatchObject({ total: 85000, inTransit: 0, capital: 50000 });
  });

  test("counts a credit posted before the claim once, in the new account", () => {
    const gap = values(ledger([claim()]), "2022-08-31");
    expect(gap.old.balance).toEqual(balance(0, 0));
    expect(gap.new).toMatchObject({ balance: balance(58500, 24400), capital: 50000 });
    expect(gap).toMatchObject({ total: 82900, inTransit: 0, capital: 50000 });
  });

  test("holds the interest paid inside the claim in transit until it is credited", () => {
    const waiting = values(ledger([claim()]), "2022-10-31");
    expect(waiting.old.balance).toEqual(balance(0, 0));
    expect(waiting.new.balance).toEqual(balance(58500, 24400));
    expect(waiting).toMatchObject({ total: 85000, inTransit: 2100, capital: 50000 });
    expect(waiting.reasons).toContain("transferInTransit");
  });

  test("month-end history never counts the money twice and reports the claim interest as return", () => {
    const history = buildEpfMonthlyHistory({ ...ledger([claim()]), cashLinks: [], audit: [] }, today);
    if (!history.ok) throw new Error(history.errors.join(" "));
    const month = (key: string) => history.months.find((item) => item.month === key)!;
    expect(month("2022-07").value).toBe(82900);
    expect(month("2022-08").value).toBe(82900);
    expect(month("2022-09")).toMatchObject({ value: 85000, inTransit: 2100,
      flows: { interest: 2100, withdrawals: 0, contributions: 0, externalTransfersIn: 0 } });
    expect(month("2023-01")).toMatchObject({ value: 85000, inTransit: 0, flows: { interest: 0 } });
  });

  test("moves capital with a first credit that arrives after the claim", () => {
    const late = claim({ credits: [
      { date: "2022-10-03", postedDate: "2022-10-03", amount: balance(58500, 24400) },
      { date: "2023-01-20", postedDate: "2023-01-20", amount: balance(1500, 600) },
    ] });
    const waiting = values(ledger([late]), "2022-09-30");
    expect(waiting).toMatchObject({ total: 85000, inTransit: 85000, capital: 50000 });
    expect(waiting.old).toMatchObject({ balance: balance(0, 0), capital: 0 });
    expect(values(ledger([late]), today).new).toMatchObject({ balance: balance(60000, 25000), capital: 50000 });
  });

  test("keeps capital unknown unless both accounts know it and the first credit covers it", () => {
    expect(values(ledger([claim()], 50000, null), today).new.capital).toBeNull();
    expect(values(ledger([claim()], null, 0), today).new.capital).toBeNull();
    const small = claim({ credits: [
      { date: "2022-08-10", postedDate: "2022-08-10", amount: balance(20000, 10000) },
      { date: "2022-08-20", postedDate: "2022-08-20", amount: balance(38500, 14400) },
      { date: "2023-01-20", postedDate: "2023-01-20", amount: balance(1500, 600) },
    ] });
    const result = values(ledger([small]), today);
    expect(result.new.capital).toBeNull();
    expect(result.capital).toBeNull();
  });

  test("a credit on the new account's year-end is inside that year's closing balance", () => {
    const yearEnd = claim({ credits: [claim().credits[0],
      { date: "2023-03-31", postedDate: "2023-03-31", amount: balance(1500, 600) }] });
    const summary: EpfEvent = { id: "fy", type: "yearSummary", accountId: "new", periodStart: "2022-04-02",
      effectiveDate: "2023-03-31", postedDate: "2023-03-31", recordedAt: "2023-06-30T00:00:00Z", evidence: "EPFO passbook",
      contributions: { employee: 10000, employer: 3000 }, interest: { employee: 0, employer: 0 },
      closing: { employee: 70000, employer: 28000 } };
    expect(values(ledger([yearEnd, summary]), today).new.balance).toEqual(balance(70000, 28000));
  });

  test("a credit on the claim date replays after the claim", () => {
    const sameDay = claim({ credits: [claim().credits[0],
      { date: "2022-09-05", postedDate: "2022-09-05", amount: balance(1500, 600) }] });
    expect(values(ledger([sameDay]), "2022-09-05")).toMatchObject({ total: 85000, inTransit: 0 });
  });

  test("an in-transit record may be waiting for credits", () => {
    const waiting = claim({ status: "inTransit", credits: [claim().credits[0]] });
    expect(values(ledger([waiting]), today)).toMatchObject({ total: 85000, inTransit: 2100 });
  });

  test("rejects credits that do not add up to the claim, in total or by part", () => {
    const short = claim({ credits: [claim().credits[0]] });
    expect(errors(ledger([short]))).toContain("The new account's credits must add up to the claim, by part.");
    const swapped = claim({ credits: [claim().credits[0],
      { date: "2023-01-20", postedDate: "2023-01-20", amount: balance(1600, 500) }] });
    expect(errors(ledger([swapped]))).toContain("The new account's credits must add up to the claim, by part.");
    const over = claim({ status: "inTransit", credits: [...claim().credits,
      { date: "2023-02-01", postedDate: "2023-02-01", amount: balance(1, 0) }] });
    expect(errors(ledger([over]))).toContain("The new account's credits cannot add up to more than the claim.");
  });

  test("rejects a claim that does not pay out the old balance plus its interest", () => {
    const wrong = claim({ payout: balance(60000, 25100), credits: [claim().credits[0],
      { date: "2023-01-20", postedDate: "2023-01-20", amount: balance(1500, 700) }] });
    expect(errors(ledger([wrong])))
      .toEqual(["The claim must pay out the old account's whole balance, including the interest paid with it."]);
  });

  test("rejects a credit before the claim that is more than the old balance then", () => {
    const early = claim({ credits: [
      { date: "2022-08-10", postedDate: "2022-08-10", amount: balance(60000, 25000) },
    ] });
    expect(errors(ledger([early])))
      .toEqual(["A credit before the claim cannot be more than the old account's balance on that date."]);
  });

  test("rejects entries on the old account after the claim", () => {
    const yearEnd: EpfEvent = { id: "year-end", type: "interest", accountId: "old", amount: balance(1500, 600),
      recordedAt: "2023-06-30T00:00:00Z", evidence: "EPFO passbook", effectiveDate: "2023-03-31", postedDate: "2023-03-31" };
    expect(errors(ledger([claim(), yearEnd])))
      .toContain("The claim closes the old account; remove entries recorded on it after the claim date.");
  });

  test("rejects a claim or credit on or before an account's starting balance", () => {
    const beforeStart = claim({ credits: [
      { date: "2022-04-01", postedDate: "2022-04-01", amount: balance(58500, 24400) },
      { date: "2023-01-20", postedDate: "2023-01-20", amount: balance(1500, 600) },
    ] });
    expect(errors(ledger([beforeStart])))
      .toContain("The claim and its credits must follow the new account's starting balance.");
  });

  test("rejects the same account on both sides and credits out of date order", () => {
    expect(errors(ledger([claim({ destinationId: "old" })]))).toContain("Transfer accounts must differ.");
    const unordered = claim({ credits: [...claim().credits].reverse() });
    expect(errors(ledger([unordered]))).toContain("List the new account's credits in date order.");
  });

  test("a correction replaces the whole record and a removal deletes it", () => {
    const original = ledger([claim()]);
    const edited = changeEpfEvent(original, { type: "put", event: claim({ status: "inTransit", credits: [claim().credits[0]] }) }, today);
    expect(edited.ok && edited.ledger.events).toHaveLength(1);
    expect(edited.ok && edited.result.inTransit).toBe(2100);
    const removed = changeEpfEvent(original, { type: "remove", id: "claim" }, today);
    expect(removed.ok && removed.ledger.events).toEqual([]);
    expect(removed.ok && removed.result.total).toBe(82900);
  });
});
