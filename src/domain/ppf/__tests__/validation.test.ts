import {
  getFinancialYearStart,
  validatePpfLedgerEntryForAccount,
  validatePpfAccount,
  validatePpfLedgerEntry,
} from "@/src/domain/ppf";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

const now = new Date("2026-08-15T12:00:00+05:30");

function account(overrides: Partial<PpfAccount> = {}): PpfAccount {
  return {
    balanceAsOf: "2026-07-31",
    confirmedBalance: 100_000,
    createdAt: "2026-08-01T10:00:00.000Z",
    id: "ppf-1",
    nickname: "Primary PPF",
    opening: { kind: "financialYear", financialYearStart: 2020 },
    provider: "India Post",
    status: "active",
    ...overrides,
  };
}

function entry(overrides: Partial<PpfLedgerEntry> = {}): PpfLedgerEntry {
  return {
    accountId: "ppf-1",
    amount: 500,
    date: "2026-08-01",
    id: "entry-1",
    recordedAt: "2026-08-01T10:00:00.000Z",
    type: "contribution",
    ...overrides,
  } as PpfLedgerEntry;
}

describe("PPF validation", () => {
  it("accepts a valid account and identifies Indian financial years", () => {
    expect(validatePpfAccount(account(), now)).toEqual({ isValid: true });
    expect(getFinancialYearStart("2026-03-31")).toBe(2025);
    expect(getFinancialYearStart("2026-04-01")).toBe(2026);
  });

  it("rejects unsafe account identity, dates, and balances", () => {
    const result = validatePpfAccount(
      account({
        accountNumberSuffix: "123456",
        balanceAsOf: "2026-08-16",
        confirmedBalance: -1,
        createdAt: "invalid",
        nickname: " ",
        provider: " ",
      }),
      now,
    );

    expect(result).toMatchObject({ isValid: false });
    if (!result.isValid) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "Nickname is required.",
          "Provider is required.",
          "Account record time is invalid.",
          "Account suffix must contain the final 2 to 4 digits only.",
          "Confirmed balance must be zero or greater.",
          "Balance date must be a valid non-future date.",
        ]),
      );
    }
  });

  it("requires a confirmed block only for extension with contributions", () => {
    expect(
      validatePpfAccount(
        account({ status: "extendedWithContributions" }),
        now,
      ),
    ).toMatchObject({ isValid: false });
    expect(
      validatePpfAccount(
        account({ status: "continuedWithoutContributions" }),
        now,
      ),
    ).toEqual({ isValid: true });
    expect(
      validatePpfAccount(
        account({
          confirmedExtensionStartFinancialYear: 2036,
          status: "continuedWithoutContributions",
        }),
        new Date("2042-01-01T10:00:00.000Z"),
      ),
    ).toEqual({ isValid: true });
  });

  it("enforces exact opening dates and valid five-year extension blocks", () => {
    expect(
      validatePpfAccount(
        account({
          balanceAsOf: "2026-06-01",
          opening: { kind: "date", openedOn: "2026-07-01" },
        }),
        now,
      ),
    ).toMatchObject({ isValid: false });
    expect(
      validatePpfAccount(
        account({
          confirmedExtensionStartFinancialYear: 2021,
          status: "extendedWithContributions",
        }),
        now,
      ),
    ).toMatchObject({ isValid: false });
    expect(
      validatePpfAccount(
        account({
          confirmedExtensionStartFinancialYear: 2036,
          status: "extendedWithContributions",
        }),
        new Date("2037-01-01T10:00:00.000Z"),
      ),
    ).toEqual({ isValid: true });
  });

  it("rejects post-maturity contributions without a confirmed extension", () => {
    const matureContribution = entry({ date: "2036-04-01" });
    expect(
      validatePpfLedgerEntryForAccount(
        account(),
        matureContribution,
        new Date("2036-04-02T10:00:00.000Z"),
      ),
    ).toMatchObject({ isValid: false });
    expect(
      validatePpfLedgerEntryForAccount(
        account({
          confirmedExtensionStartFinancialYear: 2036,
          status: "extendedWithContributions",
        }),
        matureContribution,
        new Date("2036-04-02T10:00:00.000Z"),
      ),
    ).toEqual({ isValid: true });
  });

  it("rejects contributions before a later confirmed extension block starts", () => {
    expect(
      validatePpfLedgerEntryForAccount(
        account({
          confirmedExtensionStartFinancialYear: 2041,
          status: "extendedWithContributions",
        }),
        entry({ date: "2036-04-01" }),
        new Date("2042-01-01T10:00:00.000Z"),
      ),
    ).toMatchObject({ isValid: false });
    expect(
      validatePpfLedgerEntryForAccount(
        account({
          confirmedExtensionStartFinancialYear: 2041,
          status: "extendedWithContributions",
        }),
        entry({ date: "2041-04-01" }),
        new Date("2042-01-01T10:00:00.000Z"),
      ),
    ).toEqual({ isValid: true });
  });

  it("validates ledger amounts, contribution increments, and record time", () => {
    expect(validatePpfLedgerEntry(entry(), now)).toEqual({ isValid: true });

    const invalid = validatePpfLedgerEntry(
      entry({ amount: 525, recordedAt: "invalid" }),
      now,
    );
    expect(invalid).toMatchObject({ isValid: false });
    if (!invalid.isValid) {
      expect(invalid.errors).toEqual(
        expect.arrayContaining([
          "Entry record time is invalid.",
          "PPF contributions must be in multiples of ₹50.",
        ]),
      );
    }
  });

  it("requires matched interest years and explained reconciliations", () => {
    expect(
      validatePpfLedgerEntry(
        entry({
          financialYearStart: 2024,
          type: "interestCredit",
        }),
        now,
      ),
    ).toMatchObject({ isValid: false });
    expect(
      validatePpfLedgerEntry(
        entry({ confirmedBalance: 90_000, reason: " ", type: "reconciliation" }),
        now,
      ),
    ).toMatchObject({ isValid: false });
  });
});
