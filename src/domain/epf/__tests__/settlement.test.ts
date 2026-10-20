import { calculateEpfLedger } from "@/src/domain/epf";
import { buildEpfMonthlyHistory } from "@/src/domain/epf/history";
import type { EpfAccount, EpfBalance, EpfEvent, EpfLedger } from "@/src/domain/epf";

const today = "2026-10-20";
const balance = (employee: number, employer: number): EpfBalance => ({
  total: employee + employer, components: { employee, employer },
});
const account = (employee: number, employer: number, capital: number | null): EpfAccount => ({
  id: "old", nickname: "Old job", provider: "epfo", status: "active", currency: "INR",
  checkpoint: { date: "2023-03-31", balance: balance(employee, employer), capital,
    source: "epfoStatement", recordedAt: "2026-10-20T00:00:00Z" },
  historyCompleteThrough: today,
});
const base = { recordedAt: "2026-10-20T00:00:00Z", evidence: "EPFO passbook", accountId: "old" };
const contributions: EpfEvent[] = [
  { ...base, id: "employee-apr", type: "contribution", party: "employee", amount: 1800, effectiveDate: "2023-04-01", postedDate: "2023-04-01" },
  { ...base, id: "employer-apr", type: "contribution", party: "employer", amount: 550, effectiveDate: "2023-04-01", postedDate: "2023-04-01" },
];
// Balance before settlement: 71,800 + 30,550 = 1,02,350. The claim also pays
// 3,000 + 1,000 interest that the passbook lists under the next year end.
const settlement = (amount = balance(74800, 31550)): EpfEvent => ({
  ...base, id: "settlement", type: "withdrawal", amount, capitalReduction: null, destination: "external",
  settlement: { interest: balance(3000, 1000) }, effectiveDate: "2023-09-14", postedDate: "2023-09-14",
});
const ledger = (events: EpfEvent[], start = account(70000, 30000, null)): EpfLedger => ({ accounts: [start], events });
const errors = (input: EpfLedger) => {
  const result = calculateEpfLedger(input, today, today);
  return result.ok ? [] : result.errors;
};

describe("EPF final settlement", () => {
  test("pays out the balance plus the interest paid with the claim and leaves nothing", () => {
    const result = calculateEpfLedger(ledger([...contributions, settlement()]), today, today);
    expect(result.ok && result.accounts[0]).toMatchObject({ balance: balance(0, 0), capital: 0 });
    const before = calculateEpfLedger(ledger([...contributions, settlement()]), "2023-09-13", today);
    expect(before.ok && before.total).toBe(102350);
  });

  test("reports the settlement interest as return in the settlement month", () => {
    const history = buildEpfMonthlyHistory({ ...ledger([...contributions, settlement()]), cashLinks: [], audit: [] }, today);
    const month = history.ok ? history.months.find((item) => item.month === "2023-09") : undefined;
    expect(month).toMatchObject({ value: 0, flows: { interest: 4000, withdrawals: 106350, contributions: 0 } });
  });

  test("rejects a payout that does not empty the account", () => {
    expect(errors(ledger([...contributions, settlement(balance(74800, 31551))])))
      .toEqual(["A final settlement must pay out the whole balance, including the interest paid with it."]);
  });

  test("rejects entries after the settlement, such as the passbook's year-end interest line", () => {
    const yearEndInterest: EpfEvent = { ...base, id: "year-end", type: "interest", amount: balance(3000, 1000),
      effectiveDate: "2024-03-31", postedDate: "2024-03-31" };
    expect(errors(ledger([...contributions, settlement(), yearEndInterest])))
      .toContain("A final settlement must be the last entry in its account.");
  });

  test("same-day entries replay before the settlement, whenever they were recorded", () => {
    const sameDay: EpfEvent = { ...base, id: "same-day", type: "contribution", party: "employer", amount: 50,
      recordedAt: "2026-10-21T00:00:00Z", effectiveDate: "2023-09-14", postedDate: "2023-09-14" };
    const result = calculateEpfLedger(ledger([...contributions, settlement(balance(74800, 31600)), sameDay]), today, today);
    expect(result.ok && result.accounts[0].balance).toEqual(balance(0, 0));
  });

  test("rejects a separate capital reduction", () => {
    expect(errors(ledger([...contributions, { ...settlement(), capitalReduction: 1000 } as EpfEvent])))
      .toContain("A final settlement empties the account; leave its capital reduction unset.");
  });

  test("a provider reversal restores the balance and makes capital unknown again", () => {
    const reversal: EpfEvent = { ...base, id: "reversal", type: "reversal", reversesId: "settlement", reason: "Claim returned",
      effectiveDate: "2023-10-01", postedDate: "2023-10-01" };
    const result = calculateEpfLedger(ledger([...contributions, settlement(), reversal]), today, today);
    expect(result.ok && result.accounts[0]).toMatchObject({ balance: balance(71800, 30550), capital: null });
  });

  test("an account started from zero keeps known capital until the settlement empties it", () => {
    const fromZero = account(0, 0, 0);
    const events: EpfEvent[] = [...contributions,
      { ...settlement(balance(4800, 1550)) }];
    const before = calculateEpfLedger(ledger(contributions, fromZero), today, today);
    expect(before.ok && before.capital).toBe(2350);
    const after = calculateEpfLedger(ledger(events, fromZero), today, today);
    expect(after.ok && after.capital).toBe(0);
  });
});
