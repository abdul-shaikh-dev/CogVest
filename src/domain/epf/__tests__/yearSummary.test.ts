import { calculateEpfLedger, changeEpfEvent } from "@/src/domain/epf";
import { buildEpfMonthlyHistory } from "@/src/domain/epf/history";
import type { EpfAccount, EpfEvent, EpfLedger } from "@/src/domain/epf";

const today = "2026-10-20";
const account = (capital: number | null = null, employee = 100000, employer = 40000): EpfAccount => ({
  id: "acme", nickname: "Acme", provider: "epfo", status: "active", currency: "INR",
  checkpoint: { date: "2024-03-31", balance: { total: employee + employer, components: { employee, employer } }, capital,
    source: "epfoStatement", recordedAt: "2026-10-20T00:00:00Z" },
  historyCompleteThrough: today,
});
const base = { recordedAt: "2026-10-20T00:00:00Z", evidence: "EPFO passbook", accountId: "acme" };
type Summary = Extract<EpfEvent, { type: "yearSummary" }>;
// FY 2024-25: 1,00,000 + 21,600 + 9,500 = 1,31,100 and 40,000 + 6,600 + 3,800 = 50,400.
const summary = (overrides: Partial<Summary> = {}): Summary => ({
  ...base, id: "fy24", type: "yearSummary", periodStart: "2024-04-01", effectiveDate: "2025-03-31", postedDate: "2025-03-31",
  contributions: { employee: 21600, employer: 6600 }, interest: { employee: 9500, employer: 3800 },
  closing: { employee: 131100, employer: 50400 }, ...overrides,
});
const ledger = (events: EpfEvent[], start = account()): EpfLedger => ({ accounts: [start], events });
const errors = (input: EpfLedger) => {
  const result = calculateEpfLedger(input, today, today);
  return result.ok ? [] : result.errors;
};

describe("EPF financial-year summary", () => {
  test("one entry reconciles a year to the passbook closing balance", () => {
    const result = calculateEpfLedger(ledger([summary()]), today, today);
    expect(result.ok && result.accounts[0].balance).toEqual({ total: 181500, components: { employee: 131100, employer: 50400 } });
    expect(result.ok && result.coverageReasons).toContain("fy24:summarizedFlows");
  });

  test("its flows land on the period end, not before", () => {
    const before = calculateEpfLedger(ledger([summary()]), "2025-03-30", today);
    expect(before.ok && before.total).toBe(140000);
  });

  test("contributions add to known capital; interest does not", () => {
    const result = calculateEpfLedger(ledger([summary()], account(90000)), today, today);
    expect(result.ok && result.capital).toBe(118200);
  });

  test("rejects a summary that does not match its closing balance, by component", () => {
    expect(errors(ledger([summary({ closing: { employee: 131000, employer: 50500 } })])))
      .toEqual(["A financial year summary must match its passbook closing balance."]);
  });

  test("a period ending 31 Mar needs the closing balance; a shorter one does not", () => {
    expect(errors(ledger([summary({ closing: null })])))
      .toContain("A financial year summary ending on 31 Mar needs the passbook closing balance.");
    expect(errors(ledger([summary({ closing: null, effectiveDate: "2024-09-30", postedDate: "2024-09-30" })]))).toEqual([]);
  });

  test("stays within one financial year and after the starting balance", () => {
    expect(errors(ledger([summary({ effectiveDate: "2025-04-30", postedDate: "2025-04-30", closing: null })])))
      .toContain("A financial year summary must start and end within one financial year.");
    expect(errors(ledger([summary({ periodStart: "2024-03-31" })])))
      .toContain("A financial year summary must start after the account's starting balance.");
  });

  test("rejects empty totals", () => {
    expect(errors(ledger([summary({ contributions: { employee: 0, employer: 0 }, interest: { employee: 0, employer: 0 }, closing: null,
      effectiveDate: "2024-09-30", postedDate: "2024-09-30" })]))).toContain("Event amounts must be positive.");
  });

  test("owns its period: individual contributions, interest and other summaries inside it are rejected", () => {
    const contribution: EpfEvent = { ...base, id: "may", type: "contribution", party: "employee", amount: 1800,
      effectiveDate: "2024-05-01", postedDate: "2024-05-01" };
    const owned = "A financial year summary owns its period; remove the contributions, interest, balance updates or summaries recorded inside it.";
    expect(errors(ledger([summary(), contribution]))).toContain(owned);
    const update: EpfEvent = { ...base, id: "update", type: "reconciliation", balance: { total: 150000, components: null }, capital: null,
      reason: "Statement", effectiveDate: "2024-10-01", postedDate: "2024-10-01" };
    expect(errors(ledger([summary(), update]))).toContain(owned);
    expect(errors(ledger([summary(), summary({ id: "overlap", periodStart: "2025-03-01", closing: null,
      effectiveDate: "2025-03-31" })]))).toContain(owned);
    // Contributions outside the period, and an adjacent summary, are fine.
    const after: EpfEvent = { ...contribution, id: "apr25", effectiveDate: "2025-04-01", postedDate: "2025-04-01" };
    const next = summary({ id: "fy25", periodStart: "2025-04-02", effectiveDate: "2025-09-30", postedDate: "2025-09-30", closing: null });
    expect(errors(ledger([summary(), after, next]))).toEqual([]);
  });

  test("a withdrawal inside the year is checked against the balance on its date; splitting the year fixes it", () => {
    const start = account(null, 20000, 10000);
    const withdrawal: EpfEvent = { ...base, id: "advance", type: "withdrawal", amount: { total: 40000, components: { employee: 28000, employer: 12000 } },
      capitalReduction: null, destination: "external", effectiveDate: "2024-10-15", postedDate: "2024-10-15" };
    const whole = summary({ contributions: { employee: 21600, employer: 6600 }, interest: { employee: 500, employer: 200 },
      closing: { employee: 14100, employer: 4800 } });
    expect(errors(ledger([whole, withdrawal], start))).toEqual(["An event would make an EPF balance negative."]);
    const first = summary({ id: "h1", effectiveDate: "2024-10-14", postedDate: "2024-10-14", closing: null,
      contributions: { employee: 10800, employer: 3300 }, interest: { employee: 0, employer: 0 } });
    const second = summary({ id: "h2", periodStart: "2024-10-16", contributions: { employee: 10800, employer: 3300 },
      interest: { employee: 500, employer: 200 }, closing: { employee: 14100, employer: 4800 } });
    expect(errors(ledger([first, withdrawal, second], start))).toEqual([]);
  });

  test("a settlement year is summarised up to the settlement date and then emptied", () => {
    const part = summary({ effectiveDate: "2024-09-14", postedDate: "2024-09-14", closing: null,
      contributions: { employee: 10800, employer: 3300 }, interest: { employee: 0, employer: 0 } });
    const settlement: EpfEvent = { ...base, id: "settle", type: "withdrawal", capitalReduction: null, destination: "external",
      amount: { total: 158600, components: { employee: 113800, employer: 44800 } },
      settlement: { interest: { total: 4500, components: { employee: 3000, employer: 1500 } } },
      effectiveDate: "2024-09-14", postedDate: "2024-09-14" };
    const result = calculateEpfLedger(ledger([part, settlement]), today, today);
    expect(result.ok && result.total).toBe(0);
    expect(errors(ledger([summary(), settlement]))).toContain("A final settlement must be the last entry in its account.");
  });

  test("cannot be reversed; it is corrected by editing, which replays everything", () => {
    const reversal: EpfEvent = { ...base, id: "rev", type: "reversal", reversesId: "fy24", reason: "Wrong",
      effectiveDate: "2025-04-02", postedDate: "2025-04-02" };
    expect(errors(ledger([summary(), reversal]))).toContain("Reversal needs an earlier contribution, interest credit or withdrawal in this account.");
    const edited = changeEpfEvent(ledger([summary()]), { type: "put", event: summary({ closing: { employee: 1, employer: 1 } }) }, today);
    expect(edited.ok).toBe(false);
  });

  test("a later edit that breaks a reconciled year is blocked", () => {
    const transferIn: EpfEvent = { ...base, id: "in", type: "externalTransferIn", amount: { total: 5000, components: { employee: 5000, employer: 0 } },
      capital: null, effectiveDate: "2024-06-01", postedDate: "2024-06-01" };
    expect(changeEpfEvent(ledger([summary()]), { type: "put", event: transferIn }, today).ok).toBe(false);
  });

  test("monthly history shows no value inside the period and the year's flows at its end", () => {
    const history = buildEpfMonthlyHistory({ ...ledger([summary()]), cashLinks: [], audit: [] }, today);
    if (!history.ok) throw new Error(history.errors.join());
    const month = (key: string) => history.months.find((item) => item.month === key);
    expect(month("2024-03")).toMatchObject({ status: "confirmed", value: 140000 });
    expect(month("2024-09")).toMatchObject({ status: "summarized", value: null, coveredValue: 0, coveredAccountCount: 0 });
    expect(month("2025-02")).toMatchObject({ status: "summarized", value: null });
    expect(month("2025-03")).toMatchObject({ status: "confirmed", value: 181500,
      flows: { contributions: 28200, interest: 13300, summarized: true } });
    expect(month("2025-04")).toMatchObject({ status: "confirmed", value: 181500, flows: { contributions: 0, summarized: false } });
  });
});
