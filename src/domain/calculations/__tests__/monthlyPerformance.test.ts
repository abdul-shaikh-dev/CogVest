import {
  buildMonthlyPerformanceBasis,
  calculateMonthlyPerformance,
} from "@/src/domain/calculations/monthlyPerformance";
import type {
  CashEntry,
  MonthlySnapshot,
  OpeningPosition,
} from "@/src/types";

function cashEntry(
  overrides: Partial<CashEntry> & Pick<CashEntry, "purpose" | "type">,
): CashEntry {
  return {
    amount: 100000,
    date: "2026-05-01T00:00:00.000Z",
    id: "cash-entry",
    label: "Cash entry",
    ...overrides,
  };
}

function snapshot(
  month: string,
  portfolioValue: number,
  performanceBasis?: MonthlySnapshot["performanceBasis"],
): MonthlySnapshot {
  return {
    cashValue: portfolioValue,
    cryptoValue: 0,
    debtValue: 0,
    equityValue: 0,
    id: `snapshot-${month}`,
    investedValue: 0,
    month,
    monthlyInvestment: 0,
    performanceBasis,
    portfolioValue,
    salary: 0,
  };
}

describe("buildMonthlyPerformanceBasis", () => {
  it("counts typed external inflows and withdrawals but ignores linked trades", () => {
    const basis = buildMonthlyPerformanceBasis({
      cashEntries: [
        cashEntry({ purpose: "capitalContribution", type: "addition" }),
        cashEntry({
          amount: 20000,
          id: "income",
          purpose: "income",
          type: "addition",
        }),
        cashEntry({
          amount: 80000,
          id: "buy",
          purpose: "purchaseFunding",
          type: "withdrawal",
        }),
        cashEntry({
          amount: 30000,
          id: "sale",
          purpose: "saleProceeds",
          type: "addition",
        }),
        cashEntry({
          amount: 10000,
          id: "withdrawal",
          purpose: "withdrawal",
          type: "withdrawal",
        }),
      ],
      openingPositions: [],
      targetMonth: "2026-05",
    });

    expect(basis).toMatchObject({
      netExternalFlow: 110000,
      status: "complete",
      warnings: [],
    });
  });

  it("treats a new opening position cost as contributed baseline capital", () => {
    const openingPosition: OpeningPosition = {
      assetId: "asset-one",
      averageCostPrice: 800,
      currentPrice: 900,
      date: "2026-05-10T00:00:00.000Z",
      id: "opening-one",
      quantity: 100,
    };

    expect(
      buildMonthlyPerformanceBasis({
        cashEntries: [],
        openingPositions: [openingPosition],
        targetMonth: "2026-05",
      }),
    ).toMatchObject({
      netExternalFlow: 80000,
      status: "complete",
    });
  });

  it("weights intramonth external flow by its time in the portfolio", () => {
    expect(
      buildMonthlyPerformanceBasis({
        cashEntries: [
          cashEntry({
            amount: 31000,
            date: "2026-05-16T00:00:00.000Z",
            purpose: "capitalContribution",
            type: "addition",
          }),
        ],
        openingPositions: [],
        targetMonth: "2026-05",
      }),
    ).toEqual({
      netExternalFlow: 31000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 16000,
    });
  });

  it("marks legacy or inconsistent cash semantics unavailable", () => {
    expect(
      buildMonthlyPerformanceBasis({
        cashEntries: [
          cashEntry({
            purpose: "legacyUncategorized",
            type: "addition",
          }),
        ],
        openingPositions: [],
        targetMonth: "2026-05",
      }),
    ).toMatchObject({
      reason: "ambiguous-cash-flow",
      status: "unavailable",
    });

    expect(
      buildMonthlyPerformanceBasis({
        cashEntries: [
          cashEntry({
            purpose: "capitalContribution",
            type: "withdrawal",
          }),
        ],
        openingPositions: [],
        targetMonth: "2026-05",
      }),
    ).toMatchObject({
      reason: "ambiguous-cash-flow",
      status: "unavailable",
    });
  });
});

describe("calculateMonthlyPerformance", () => {
  it("removes external contribution from total value change", () => {
    const previous = snapshot("2026-04", 500000);
    const current = snapshot("2026-05", 600000, {
      netExternalFlow: 100000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 100000,
    });

    expect(calculateMonthlyPerformance(previous, current)).toEqual({
      denominator: 600000,
      marketMovement: 0,
      marketMovementPct: 0,
      netExternalFlow: 100000,
      reason: null,
      status: "available",
      totalValueChange: 100000,
    });
  });

  it("reports market-only movement when no external flow occurred", () => {
    const previous = snapshot("2026-04", 500000);
    const current = snapshot("2026-05", 510000, {
      netExternalFlow: 0,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 0,
    });

    expect(calculateMonthlyPerformance(previous, current)).toEqual({
      denominator: 500000,
      marketMovement: 10000,
      marketMovementPct: 2,
      netExternalFlow: 0,
      reason: null,
      status: "available",
      totalValueChange: 10000,
    });
  });

  it("handles withdrawals without treating them as losses", () => {
    const previous = snapshot("2026-04", 500000);
    const current = snapshot("2026-05", 480000, {
      netExternalFlow: -20000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: -20000,
    });

    expect(calculateMonthlyPerformance(previous, current)).toEqual({
      denominator: 480000,
      marketMovement: 0,
      marketMovementPct: 0,
      netExternalFlow: -20000,
      reason: null,
      status: "available",
      totalValueChange: -20000,
    });
  });

  it("keeps movement but withholds percentage for a non-positive denominator", () => {
    const previous = snapshot("2026-04", 100000);
    const current = snapshot("2026-05", 0, {
      netExternalFlow: -100000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: -100000,
    });

    expect(calculateMonthlyPerformance(previous, current)).toEqual({
      denominator: 0,
      marketMovement: 0,
      marketMovementPct: null,
      netExternalFlow: -100000,
      reason: "invalid-denominator",
      status: "partial",
      totalValueChange: -100000,
    });
  });

  it("does not invent performance for the first, legacy, or ambiguous snapshot", () => {
    const previous = snapshot("2026-04", 500000);
    const legacy = snapshot("2026-05", 600000);
    const ambiguous = snapshot("2026-05", 600000, {
      reason: "ambiguous-cash-flow",
      status: "unavailable",
      warnings: ["Cash flow purpose is unknown."],
    });

    expect(calculateMonthlyPerformance(undefined, previous)).toMatchObject({
      marketMovement: null,
      reason: "missing-previous-snapshot",
      status: "unavailable",
    });
    expect(calculateMonthlyPerformance(previous, legacy)).toMatchObject({
      marketMovement: null,
      reason: "legacy-snapshot",
      status: "unavailable",
    });
    expect(calculateMonthlyPerformance(previous, ambiguous)).toMatchObject({
      marketMovement: null,
      reason: "ambiguous-cash-flow",
      status: "unavailable",
    });
  });
});
