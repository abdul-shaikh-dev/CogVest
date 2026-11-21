import { readFileSync } from "node:fs";

import { planPpfCsvMerge, ppfMergeState } from "../ppfCsvMerge";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

const now = new Date("2026-11-21T12:00:00Z");
const account: PpfAccount = {
  balanceAsOf: "2024-04-01", confirmedBalance: 30_000, createdAt: "2026-06-01T00:00:00Z", id: "ppf",
  nickname: "Synthetic PPF", opening: { kind: "financialYear", financialYearStart: 2020 }, provider: "Bank", status: "active",
};
const typed = (id: string, date: string, type: "contribution" | "withdrawal", amount: number, extra: Partial<PpfLedgerEntry> = {}) =>
  ({ accountId: "ppf", amount, date, id, recordedAt: "2026-06-01T00:00:00Z", type, ...extra }) as PpfLedgerEntry;

/** What the user typed in by hand: one deposit two days off, one with another amount. */
const ledger: PpfLedgerEntry[] = [
  typed("typed-may", "2024-05-10", "contribution", 50_000),
  typed("typed-dec", "2024-12-05", "contribution", 20_000),
];
const csv = [
  "date,type,amount,balance,note",
  "15/03/2024,deposit,10000,30000,Before the opening balance",
  "12/05/2024,deposit,\"50,000\",80000,Typed two days earlier",
  "05/12/2024,deposit,\"25,000\",105000,Typed as 20000",
  "31-Mar-2025,interest,\"6,500\",111500,",
  "10/04/2025,deposit,\"1,00,000\",211500,",
].join("\n");

describe("adding a CogVest PPF CSV to existing entries (#748)", () => {
  test("sorts each row into recorded, differs, new or before the opening balance, changing nothing", () => {
    const before = JSON.stringify(ledger);
    const plan = planPpfCsvMerge({ accountId: "ppf", csv }, [account], ledger, now);
    expect(plan.errors).toEqual([]);
    expect(plan.rows.map(({ row, status, existing }) => [row.rowNumber, status, existing?.id])).toEqual([
      [2, "beforeOpening", undefined], [3, "recorded", "typed-may"], [4, "differs", "typed-dec"],
      [5, "new", undefined], [6, "new", undefined],
    ]);
    expect(plan.counts).toEqual({ beforeOpening: 1, differs: 1, new: 2, recorded: 1 });
    expect(plan.additions.map((entry) => [entry.date, entry.type, "amount" in entry ? entry.amount : null])).toEqual([
      ["2025-03-31", "interestCredit", 6500], ["2025-04-10", "contribution", 100_000],
    ]);
    expect(plan.corrections).toEqual([]);
    expect(JSON.stringify(ledger)).toBe(before);
  });

  test("a differing row keeps the user's amount unless they choose the file's", () => {
    const kept = planPpfCsvMerge({ accountId: "ppf", csv }, [account], ledger, now);
    // Keeping ₹20,000 means the records fall short of the file's printed balance.
    expect(kept.warnings).toContain("Row 4: the file shows a balance your records wouldn't reach once saved. An earlier entry may be missing or differ.");
    const chosen = planPpfCsvMerge({ accountId: "ppf", csv, useFileAmounts: [4] }, [account], ledger, now);
    expect(chosen.corrections).toEqual([{ ...ledger[1], amount: 25_000 }]);
    expect(chosen.warnings.filter((warning) => warning.startsWith("Row"))).toEqual([]);
  });

  test("an exact match is claimed before a typed entry a few days off", () => {
    const entries = [typed("near", "2024-06-02", "contribution", 5000), typed("exact", "2024-06-04", "contribution", 5000)];
    const plan = planPpfCsvMerge({ accountId: "ppf", csv: "date,type,amount\n2024-06-01,deposit,5000\n2024-06-04,deposit,5000\n" }, [account], entries, now);
    expect(plan.rows.map(({ row, existing }) => [row.rowNumber, existing?.id])).toEqual([[2, "near"], [3, "exact"]]);
  });

  test("an entry more than three days off is not treated as the same one", () => {
    const plan = planPpfCsvMerge({ accountId: "ppf", csv: "date,type,amount\n2024-06-10,deposit,5000\n" }, [account],
      [typed("far", "2024-06-05", "contribution", 5000)], now);
    expect(plan.rows[0].status).toBe("new");
  });

  test("a typed entry a few days off with another amount differs instead of being counted twice", () => {
    const plan = planPpfCsvMerge({ accountId: "ppf", csv: "date,type,amount\n2024-12-05,deposit,25000\n" }, [account],
      [typed("typed-dec", "2024-12-03", "contribution", 20_000)], now);
    expect(plan.rows[0]).toMatchObject({ existing: { id: "typed-dec" }, status: "differs" });
    expect(plan.additions).toEqual([]);
  });

  test("importing the same file twice adds nothing the second time", () => {
    const first = planPpfCsvMerge({ accountId: "ppf", csv }, [account], ledger, now);
    const saved = [...ledger, ...first.additions];
    const second = planPpfCsvMerge({ accountId: "ppf", csv }, [account], saved, now);
    expect(second.additions).toEqual([]);
    expect(second.counts.new).toBe(0);
  });

  test("a differing entry linked to Cash is locked and never corrected", () => {
    const linked = [typed("cash-dec", "2024-12-05", "contribution", 20_000, { fundingSource: "cash" } as Partial<PpfLedgerEntry>)];
    const plan = planPpfCsvMerge({ accountId: "ppf", csv: "date,type,amount\n05/12/2024,deposit,25000\n", useFileAmounts: [2] }, [account], linked, now);
    expect(plan.rows[0]).toMatchObject({ locked: true, status: "differs" });
    expect(plan.corrections).toEqual([]);
  });

  test("identical new rows are counted so the user confirms they are separate deposits", () => {
    const plan = planPpfCsvMerge({ accountId: "ppf", csv: "date,type,amount\n2024-06-01,deposit,500\n2024-06-01,deposit,500\n" }, [account], [], now);
    expect(plan.additions).toHaveLength(2);
    expect(plan.duplicateRows).toBe(2);
  });

  test("gives per-year totals and warns about the yearly limit and a missing interest credit", () => {
    const plan = planPpfCsvMerge({ accountId: "ppf", csv: "date,type,amount\n2024-05-01,deposit,\"1,00,000\"\n2024-06-01,deposit,\"60,000\"\n2025-05-01,deposit,1000\n" }, [account], [], now);
    expect(plan.years).toEqual([
      { closing: 190_000, contributions: 160_000, financialYearStart: 2024, interest: 0, withdrawals: 0 },
      { closing: 191_000, contributions: 1000, financialYearStart: 2025, interest: 0, withdrawals: 0 },
    ]);
    expect(plan.warnings).toEqual([
      "FY 2024-25: deposits total more than the ₹1.5 lakh yearly limit.",
      "FY 2024-25: no interest credit is recorded for this completed year.",
      "FY 2025-26: no interest credit is recorded for this completed year.",
    ]);
  });

  test("blocks rows that would take the balance below zero, and file errors, with nothing to add", () => {
    const overdrawn = planPpfCsvMerge({ accountId: "ppf", csv: "date,type,amount\n2024-06-01,withdrawal,40000\n" }, [account], [], now);
    expect(overdrawn.errors).toHaveLength(1);
    const broken = planPpfCsvMerge({ accountId: "ppf", csv: "date,type,amount\n31/02/2025,deposit,500\n" }, [account], [], now);
    expect(broken.errors[0]).toMatchObject({ column: "date", rowNumber: 2 });
    expect(broken.additions).toEqual([]);
  });

  test("the preview's state changes when the account's entries change", () => {
    expect(ppfMergeState(account, ledger, csv)).not.toBe(ppfMergeState(account, ledger.slice(1), csv));
    expect(ppfMergeState(account, [...ledger, { ...ledger[0], accountId: "other", id: "other" }], csv)).toBe(ppfMergeState(account, ledger, csv));
  });
  test("the Maestro passbook fixture adds four entries, then nothing on a second import", () => {
    const fixture = readFileSync("e2e/fixtures/ppf-merge.csv", "utf8");
    const opened = { ...account, balanceAsOf: "2024-11-21", confirmedBalance: 10_000 };
    const first = planPpfCsvMerge({ accountId: "ppf", csv: fixture }, [opened], [], now);
    expect(first.errors).toEqual([]);
    expect(first.warnings).toEqual([]);
    expect(first.counts.new).toBe(4);
    expect(first.years.at(-1)?.closing).toBe(16_850);
    const second = planPpfCsvMerge({ accountId: "ppf", csv: fixture }, [opened], first.additions, now);
    expect(second.counts).toEqual({ beforeOpening: 0, differs: 0, new: 0, recorded: 4 });
  });
});
