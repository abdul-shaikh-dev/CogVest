import {
  planPpfCsvImport,
  type PpfCsvImportInput,
} from "@/src/domain/ppfCsvImport";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

const now = new Date("2026-09-11T12:00:00.000Z");
const account: PpfAccount = {
  balanceAsOf: "2025-03-31",
  confirmedBalance: 10_000,
  createdAt: "2025-04-01T00:00:00.000Z",
  id: "ppf-primary",
  nickname: "Primary",
  opening: { financialYearStart: 2020, kind: "financialYear" },
  provider: "Synthetic provider",
  status: "active",
};

function input(overrides: Partial<PpfCsvImportInput> = {}): PpfCsvImportInput {
  return {
    accountId: account.id,
    balanceAsOf: "2025-03-31",
    baselineFyContribution: 0,
    completeThrough: "2026-09-11",
    csv: [
      "date,type,amount,note",
      "2025-04-02,contribution,500,April deposit",
      "2025-12-31,interest,100,Official credit",
      "2026-04-02,withdrawal,200,Need cash",
      "",
    ].join("\n"),
    openingBalance: 10_000,
    ...overrides,
  };
}

describe("PPF CSV import planning", () => {
  it("builds a replacement baseline without double-counting prior history", () => {
    const prior: PpfLedgerEntry = {
      accountId: account.id,
      amount: 500,
      date: "2025-04-02",
      id: "manual-prior-entry",
      recordedAt: "2025-04-02T09:00:00.000Z",
      type: "contribution",
    };
    const plan = planPpfCsvImport(input(), [account], [prior], now);

    expect(plan.errors).toEqual([]);
    expect(plan.requiresReplacement).toBe(true);
    expect(plan.summary).toMatchObject({
      closing: 10_400,
      contributions: 500,
      interest: 100,
      previousEntries: 1,
    });
    expect(plan.entries).toHaveLength(3);
    expect(plan.entries.map((entry) => entry.id)).toEqual([
      "ppf-csv:ppf-primary:0",
      "ppf-csv:ppf-primary:1",
      "ppf-csv:ppf-primary:2",
    ]);
  });

  it("marks an identical full reimport as already applied while preserving record identities", () => {
    const first = planPpfCsvImport(input(), [account], [], now);
    if (!first.account) throw new Error("Fixture plan is missing its account.");

    const repeated = planPpfCsvImport(input(), [first.account], first.entries, now);
    expect(repeated.errors).toEqual([]);
    expect(repeated.alreadyApplied).toBe(true);
    expect(repeated.requiresReplacement).toBe(false);
    expect(repeated.entries).toEqual(first.entries);
  });

  it("requires an explicit duplicate-row confirmation while retaining each legitimate transaction", () => {
    const plan = planPpfCsvImport(input({
      csv: "date,type,amount,note\n2025-04-02,contribution,500,Same day\n2025-04-02,contribution,500,Same day\n",
    }), [account], [], now);

    expect(plan.errors).toEqual([]);
    expect(plan.duplicateRows).toBe(1);
    expect(plan.entries).toHaveLength(2);
  });

  it("keeps value-date interest in its own financial year and does not consume current-year contribution", () => {
    const plan = planPpfCsvImport(input({
      csv: [
        "date,type,amount,note",
        "2026-03-31,interest,250,Value date credit",
        "2026-04-01,contribution,500,Current FY deposit",
        "",
      ].join("\n"),
    }), [account], [], now);

    expect(plan.errors).toEqual([]);
    expect(plan.summary).toMatchObject({ contributions: 500, interest: 250 });
    expect(plan.account?.baselineFinancialYearContributions).toEqual({
      amount: 0,
      financialYearStart: 2024,
    });
    expect(plan.entries[0]).toMatchObject({
      financialYearStart: 2025,
      type: "interestCredit",
    });
    expect(plan.entries[1]).toMatchObject({ type: "contribution" });
  });

  it.each([
    ["a closing mismatch", input({ expectedClosingBalance: 10_401 })],
    ["an invalid date", input({ csv: "date,type,amount,note\n2025-02-30,contribution,500,Bad date\n" })],
    ["an invalid row", input({ csv: "date,type,amount,note\n2025-04-02,contribution,501,Not valid\n" })],
  ])("rejects %s without changing the supplied portfolio records", (_label, invalid) => {
    const accounts = [structuredClone(account)];
    const ledger: PpfLedgerEntry[] = [];
    const before = structuredClone({ accounts, ledger });

    const plan = planPpfCsvImport(invalid, accounts, ledger, now);

    expect(plan.errors.length).toBeGreaterThan(0);
    expect({ accounts, ledger }).toEqual(before);
  });

  it("rejects a withdrawal that makes an intermediate balance negative", () => {
    const plan = planPpfCsvImport(input({
      csv: "date,type,amount,note\n2025-04-02,withdrawal,10001,Too much\n",
    }), [account], [], now);

    expect(plan.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: "This transaction produces an invalid or negative balance." }),
    ]));
  });

  it("rejects a cumulative balance that exceeds safe integer cents", () => {
    const plan = planPpfCsvImport(input({
      csv: "date,type,amount,note\n2025-04-02,contribution,500,Overflow guard\n",
      openingBalance: 90_071_992_547_409,
    }), [account], [], now);

    expect(plan.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: "This transaction produces an invalid or negative balance." }),
    ]));
  });
});
