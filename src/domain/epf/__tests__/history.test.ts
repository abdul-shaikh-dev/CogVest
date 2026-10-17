import { buildEpfMonthlyHistory } from "../history";
import { emptyEpfState } from "../persistence";
import type { EpfAccount, EpfEvent } from "../model";
import type { EpfState } from "../persistence";

const account = (id: string, date: string, total: number,
  historyCompleteThrough: string | null = null): EpfAccount => ({
  id, nickname: id, provider: "epfo", status: "active", currency: "INR", historyCompleteThrough,
  checkpoint: { date, balance: { total, components: null }, capital: null,
    source: "epfoStatement", recordedAt: `${date}T10:00:00Z` },
});
const evidence = (id: string, effectiveDate: string, postedDate = effectiveDate) => ({
  id, accountId: "a", effectiveDate, postedDate, recordedAt: `${postedDate}T12:00:00Z`, evidence: "Statement",
});
const state = (accounts: EpfAccount[], events: EpfEvent[] = []): EpfState => ({ ...emptyEpfState(), accounts, events });
const months = (epf: EpfState, today: string) => {
  const result = buildEpfMonthlyHistory(epf, today);
  if (!result.ok) throw new Error(result.errors.join(", "));
  return result.months;
};

test("snapshot-only account starts at its checkpoint month and never claims confirmed carry-forward", () => {
  const history = months(state([account("a", "2026-03-15", 140000)]), "2026-07-10");
  expect(history.map((item) => item.month)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06"]);
  expect(history.every((item) => item.status === "lastRecorded" && item.value === 140000)).toBe(true);
  expect(history[0].coverageReasons).toContain("a:unknownCapital");
});

test("confirmed history coverage marks only covered month ends as confirmed", () => {
  const history = months(state([account("a", "2026-03-15", 140000, "2026-05-31")]), "2026-07-10");
  expect(history.map((item) => item.status)).toEqual(["confirmed", "confirmed", "confirmed", "lastRecorded"]);
});

test("an account without a checkpoint makes the total unavailable, never zero", () => {
  const history = months(state([account("a", "2026-03-15", 140000), account("b", "2026-05-10", 60000)]), "2026-07-01");
  expect(history.slice(0, 2)).toEqual([
    expect.objectContaining({ month: "2026-03", status: "partial", value: null, coveredValue: 140000, coveredAccountCount: 1, accountCount: 2 }),
    expect.objectContaining({ month: "2026-04", status: "partial", value: null, coveredValue: 140000 }),
  ]);
  expect(history[2]).toMatchObject({ month: "2026-05", value: 200000, coveredAccountCount: 2 });
});

test("contributions are capital flows, interest is return, and both reach the month-end value once", () => {
  const history = months(state([account("a", "2026-03-15", 140000)], [
    { ...evidence("employee", "2026-04-05"), type: "contribution", party: "employee", amount: 1200 },
    { ...evidence("employer", "2026-04-05"), type: "contribution", party: "employer", amount: 367 },
    { ...evidence("interest", "2026-04-30"), type: "interest", amount: { total: 1000, components: null } },
  ]), "2026-06-02");
  expect(history.find((item) => item.month === "2026-04")).toMatchObject({
    value: 142567, flows: { contributions: 1567, interest: 1000, withdrawals: 0, reconciled: false },
  });
  expect(history.find((item) => item.month === "2026-05")).toMatchObject({
    value: 142567, flows: { contributions: 0, interest: 0 },
  });
});

test("delayed official interest uses its evidenced effective month, not its posting month", () => {
  const history = months(state([account("a", "2026-01-10", 100000)], [
    { ...evidence("interest", "2026-03-31", "2026-06-15"), type: "interest", amount: { total: 8000, components: null } },
  ]), "2026-07-01");
  expect(history.find((item) => item.month === "2026-03")).toMatchObject({ value: 108000, flows: { interest: 8000 } });
  expect(history.find((item) => item.month === "2026-02")).toMatchObject({ value: 100000 });
  expect(history.find((item) => item.month === "2026-06")?.flows.interest).toBe(0);
});

test("tracked transfers keep combined value, are never a flow, and disclose money in transit", () => {
  const history = months(state([account("a", "2026-01-10", 140000), account("b", "2026-01-10", 0)], [{
    id: "move", type: "transfer", sourceId: "a", destinationId: "b", status: "completed",
    amount: { total: 50000, components: null }, capital: null, effectiveDate: "2026-02-20",
    creditDate: "2026-03-05", postedDate: "2026-03-05", recordedAt: "2026-03-05T12:00:00Z", evidence: "Transfer claim",
  }]), "2026-04-01");
  expect(history.map((item) => item.value)).toEqual([140000, 140000, 140000]);
  expect(history[1]).toMatchObject({ month: "2026-02", inTransit: 50000 });
  expect(history[1].coverageReasons).toContain("transferInTransit");
  expect(history[2]).toMatchObject({ inTransit: 0 });
  expect(history.every((item) => item.flows.contributions === 0 && item.flows.withdrawals === 0)).toBe(true);
});

test("reconciliation replaces the value but is not reported as contribution or interest", () => {
  const history = months(state([account("a", "2026-01-10", 100000)], [
    { ...evidence("reconcile", "2026-02-28"), type: "reconciliation", balance: { total: 104500, components: null },
      capital: null, reason: "Annual statement" },
  ]), "2026-03-15");
  expect(history[1]).toMatchObject({ value: 104500, flows: { contributions: 0, interest: 0, reconciled: true } });
});

test("reversals offset their original in the reversal month", () => {
  const history = months(state([account("a", "2026-01-10", 100000)], [
    { ...evidence("employer", "2026-02-05"), type: "contribution", party: "employer", amount: 5000 },
    { ...evidence("undo", "2026-03-02"), type: "reversal", reversesId: "employer", reason: "Provider correction" },
  ]), "2026-04-01");
  expect(history.map((item) => [item.value, item.flows.contributions])).toEqual([[100000, 0], [105000, 5000], [100000, -5000]]);
});

test("removing an event restates only months on or after its effective date", () => {
  const events: EpfEvent[] = [
    { ...evidence("old", "2026-02-05"), type: "contribution", party: "employee", amount: 1000 },
    { ...evidence("late", "2026-04-05"), type: "contribution", party: "employee", amount: 2000 },
  ];
  const before = months(state([account("a", "2026-01-10", 100000)], events), "2026-06-01");
  const after = months(state([account("a", "2026-01-10", 100000)], events.slice(0, 1)), "2026-06-01");
  expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
  expect(after.slice(3).map((item) => item.value)).toEqual([101000, 101000]);
  expect(before.slice(3).map((item) => item.value)).toEqual([103000, 103000]);
});

test("excludes the current month, handles January, empty state and invalid ledgers without mutation", () => {
  const epf = state([account("a", "2025-12-20", 1000)]);
  const snapshot = JSON.stringify(epf);
  expect(months(epf, "2026-01-05").map((item) => item.month)).toEqual(["2025-12"]);
  expect(months(epf, "2025-12-31")).toEqual([]);
  expect(JSON.stringify(epf)).toBe(snapshot);
  expect(buildEpfMonthlyHistory(emptyEpfState(), "2026-01-05")).toEqual({ ok: true, months: [] });
  expect(buildEpfMonthlyHistory(epf, "not-a-date").ok).toBe(false);
  expect(buildEpfMonthlyHistory(state([account("a", "2026-01-10", 1000)], [
    { ...evidence("before", "2026-01-01"), type: "contribution", party: "employee", amount: 10 },
  ]), "2026-03-01").ok).toBe(false);
});
