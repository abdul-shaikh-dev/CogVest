import {
  calculatePpfAccountSummary,
  calculatePpfConfirmedBalance,
  calculatePpfFinancialYearContributions,
  estimatePpfInterest,
  getPpfExtensionEndDate,
  getPpfMaturityDate,
} from "@/src/domain/ppf";
import type {
  PpfAccount,
  PpfInterestRatePeriod,
  PpfLedgerEntry,
} from "@/src/types";

function account(overrides: Partial<PpfAccount> = {}): PpfAccount {
  return {
    balanceAsOf: "2026-04-01",
    confirmedBalance: 100_000,
    createdAt: "2026-04-01T10:00:00.000Z",
    id: "ppf-1",
    nickname: "Primary PPF",
    opening: { kind: "date", openedOn: "2020-04-01" },
    provider: "India Post",
    status: "active",
    ...overrides,
  };
}

function contribution(
  id: string,
  date: string,
  amount: number,
  recordedAt = `${date}T10:00:00.000Z`,
): PpfLedgerEntry {
  return {
    accountId: "ppf-1",
    amount,
    date,
    id,
    recordedAt,
    type: "contribution",
  };
}

const twelvePercentSchedule: readonly PpfInterestRatePeriod[] = [
  {
    annualRatePct: 12,
    effectiveFrom: "2026-04-01",
    effectiveTo: "2027-03-31",
    notificationDate: "2026-03-31",
    sourceLabel: "Test schedule",
    sourceUrl: "https://example.test/ppf",
  },
];

describe("PPF calculations", () => {
  it("replays contributions, official interest, withdrawals, and corrections", () => {
    const entries: PpfLedgerEntry[] = [
      contribution("contribution", "2026-04-05", 10_000),
      {
        accountId: "ppf-1",
        amount: 7_100,
        date: "2027-03-31",
        financialYearStart: 2026,
        id: "interest",
        recordedAt: "2027-03-31T10:00:00.000Z",
        type: "interestCredit",
      },
      {
        accountId: "ppf-1",
        amount: 5_000,
        date: "2027-04-01",
        id: "withdrawal",
        recordedAt: "2027-04-01T10:00:00.000Z",
        type: "withdrawal",
      },
    ];

    expect(calculatePpfConfirmedBalance(account(), entries, "2027-04-01")).toEqual({
      confirmedBalance: 112_100,
      investedBasis: 105_000,
    });

    entries.push({
      accountId: "ppf-1",
      confirmedBalance: 111_000,
      date: "2027-04-02",
      id: "correction",
      reason: "Matched passbook",
      recordedAt: "2027-04-02T10:00:00.000Z",
      type: "reconciliation",
    });
    expect(calculatePpfConfirmedBalance(account(), entries, "2027-04-02")).toEqual({
      confirmedBalance: 111_000,
      investedBasis: 105_000,
    });
  });

  it("does not count checkpoint-included history twice", () => {
    const baseline = account({
      balanceAsOf: "2026-07-31",
      baselineFinancialYearContributions: {
        amount: 20_000,
        financialYearStart: 2026,
      },
    });
    const entries = [
      contribution("old", "2026-07-01", 20_000),
      contribution("new", "2026-08-01", 5_000),
    ];

    expect(calculatePpfConfirmedBalance(baseline, entries, "2026-08-01")).toEqual({
      confirmedBalance: 105_000,
      investedBasis: 105_000,
    });
    expect(calculatePpfFinancialYearContributions(baseline, entries, 2026)).toBe(
      25_000,
    );
  });

  it("uses record time to order same-day corrections deterministically", () => {
    const entries: PpfLedgerEntry[] = [
      {
        accountId: "ppf-1",
        confirmedBalance: 90_000,
        date: "2026-04-10",
        id: "correction",
        reason: "Matched passbook",
        recordedAt: "2026-04-10T09:00:00.000Z",
        type: "reconciliation",
      },
      contribution(
        "later-contribution",
        "2026-04-10",
        5_000,
        "2026-04-10T10:00:00.000Z",
      ),
    ];

    expect(calculatePpfConfirmedBalance(account(), entries, "2026-04-10")).toEqual({
      confirmedBalance: 95_000,
      investedBasis: 105_000,
    });
  });

  it("derives maturity and confirmed contribution-extension boundaries", () => {
    expect(getPpfMaturityDate(account())).toBe("2036-03-31");
    expect(
      getPpfMaturityDate(
        account({ opening: { kind: "date", openedOn: "2021-03-31" } }),
      ),
    ).toBe("2036-03-31");
    expect(
      getPpfExtensionEndDate(
        account({ confirmedExtensionStartFinancialYear: 2036 }),
      ),
    ).toBe("2041-03-31");
  });

  it("uses the lowest fifth-to-month-end balance", () => {
    const entries: PpfLedgerEntry[] = [
      contribution("by-fifth", "2026-04-05", 10_000),
      contribution("after-fifth", "2026-04-06", 10_000),
      {
        accountId: "ppf-1",
        amount: 20_000,
        date: "2026-04-20",
        id: "withdrawal",
        recordedAt: "2026-04-20T10:00:00.000Z",
        type: "withdrawal",
      },
    ];

    expect(
      estimatePpfInterest({
        account: account(),
        asOf: "2026-05-01",
        entries,
        schedule: twelvePercentSchedule,
      }),
    ).toMatchObject({ amount: 1_000, estimatedThrough: "2026-04-30" });
  });

  it("rounds annual credits to the nearest rupee before compounding", () => {
    expect(
      estimatePpfInterest({
        account: account({ confirmedBalance: 1_001 }),
        asOf: "2027-04-01",
        entries: [],
        schedule: [
          { ...twelvePercentSchedule[0], annualRatePct: 7.1 },
        ],
      }),
    ).toMatchObject({ amount: 71, estimatedThrough: "2027-03-31" });
  });

  it("stops honestly when an official rate period is unavailable", () => {
    expect(
      estimatePpfInterest({
        account: account(),
        asOf: "2026-06-01",
        entries: [],
        schedule: [],
      }),
    ).toMatchObject({
      missingMonth: "2026-04",
      reason: "rate-unavailable",
      status: "unavailable",
    });
  });

  it("resets estimates after the latest official checkpoint", () => {
    const entries: PpfLedgerEntry[] = [
      {
        accountId: "ppf-1",
        amount: 7_100,
        date: "2027-03-31",
        financialYearStart: 2026,
        id: "interest",
        recordedAt: "2027-03-31T10:00:00.000Z",
        type: "interestCredit",
      },
    ];
    const result = estimatePpfInterest({
      account: account(),
      asOf: "2027-05-01",
      entries,
      schedule: [
        ...twelvePercentSchedule,
        { ...twelvePercentSchedule[0], effectiveFrom: "2027-04-01", effectiveTo: "2028-03-31" },
      ],
    });

    expect(result).toMatchObject({ amount: 1_071, estimatedThrough: "2027-04-30" });
  });

  it("reports contribution context without treating estimates as confirmed value", () => {
    const summary = calculatePpfAccountSummary({
      account: account({
        baselineFinancialYearContributions: {
          amount: 149_000,
          financialYearStart: 2026,
        },
      }),
      asOf: "2026-05-01",
      entries: [contribution("new", "2026-04-05", 2_000)],
    });

    expect(summary.confirmedBalance).toBe(102_000);
    expect(summary.contributionContext).toMatchObject({
      exceedsMaximum: true,
      financialYearContributions: 151_000,
      remainingTrackedCapacity: 0,
    });
    expect(summary.estimatedInterest.status).toBe("available");
  });
});
