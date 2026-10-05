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
  };
}

describe("buildMonthlyPerformanceBasis", () => {
  it.each(["addition", "withdrawal"] as const)("treats EPF %s as crossing the current EPF-excluded history scope", (type) => {
    const basis = buildMonthlyPerformanceBasis({ cashEntries: [cashEntry({ amount: 1000, type, purpose: "epfTransfer",
      date: "2026-05-16", linkedEpf: { accountId: "epf", eventId: "event" } })], openingPositions: [], targetMonth: "2026-05" });
    expect(basis).toMatchObject({ status: "complete", netExternalFlow: type === "addition" ? 1000 : -1000 });
  });
  it.each([
    ["withdrawal", 9010, 20000, 10990, -9010],
    ["addition", 1795, 10990, 12785, 1795],
  ] as const)("classifies a linked Futures %s as crossing the historical boundary", (type, amount, before, after, flow) => {
    const basis = buildMonthlyPerformanceBasis({
      cashEntries: [cashEntry({
        amount, type, purpose: "futuresTransfer", date: "2026-05-16",
        linkedFutures: { accountId: "wallet", eventId: "transfer" },
      })],
      openingPositions: [], targetMonth: "2026-05",
    });
    expect(basis).toMatchObject({ status: "complete", netExternalFlow: flow });
    expect(calculateMonthlyPerformance(snapshot("2026-04", before), snapshot("2026-05", after, basis)))
      .toMatchObject({ marketMovement: 0, marketMovementPct: 0, netExternalFlow: flow, status: "available" });
  });

  it("does not assume a detached Futures Cash leg has verified flow semantics", () => {
    expect(buildMonthlyPerformanceBasis({
      cashEntries: [cashEntry({ purpose: "futuresTransfer", type: "withdrawal" })],
      openingPositions: [], targetMonth: "2026-05",
    })).toMatchObject({ reason: "ambiguous-cash-flow", status: "unavailable" });
  });

  it("uses the persisted Cash calendar month at a Futures UTC-month boundary", () => {
    const entry = cashEntry({
      date: "2026-06-01", amount: 9000, purpose: "futuresTransfer", type: "withdrawal",
      linkedFutures: { accountId: "wallet", eventId: "2026-05-31T20:30:00Z" },
    });
    expect(buildMonthlyPerformanceBasis({ cashEntries: [entry], openingPositions: [], targetMonth: "2026-05" }))
      .toMatchObject({ netExternalFlow: 0 });
    expect(buildMonthlyPerformanceBasis({ cashEntries: [entry], openingPositions: [], targetMonth: "2026-06" }))
      .toMatchObject({ netExternalFlow: -9000, weightedExternalFlow: -9000 });
  });

  it("counts typed external inflows and withdrawals but ignores linked trades", () => {
    const basis = buildMonthlyPerformanceBasis({
      cashEntries: [
        cashEntry({ purpose: "capitalContribution", type: "addition" }),
        cashEntry({
          amount: 20000,
          id: "capitalContribution",
          purpose: "capitalContribution",
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

  it("uses the confirmed baseline measurement date for performance flows", () => {
    const openingPosition: OpeningPosition = {
      assetId: "asset-one",
      averageCostPrice: 800,
      currentPrice: 900,
      date: "2020-01-10T00:00:00.000Z",
      id: "opening-one",
      measuredAsOf: "2026-05-10",
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
    expect(
      buildMonthlyPerformanceBasis({
        cashEntries: [],
        openingPositions: [openingPosition],
        targetMonth: "2020-01",
      }),
    ).toMatchObject({ netExternalFlow: 0, status: "complete" });
  });

  it("uses an explicit measurement date when first-purchase date is unknown", () => {
    const openingPosition: OpeningPosition = {
      assetId: "asset-one",
      averageCostPrice: 800,
      date: null,
      id: "opening-one",
      measuredAsOf: "2026-05-10",
      quantity: 100,
      recordedAt: "2026-06-01T00:00:00.000Z",
      recordedOn: "2026-06-01",
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

  it("rounds fractional opening-position flows only after aggregation", () => {
    const positions: OpeningPosition[] = ["one", "two"].map((id) => ({
      assetId: `asset-${id}`,
      averageCostPrice: 1.005,
      date: "2026-05-31T00:00:00.000Z",
      id: `opening-${id}`,
      quantity: 0.005,
    }));

    expect(
      buildMonthlyPerformanceBasis({
        cashEntries: [],
        openingPositions: positions,
        targetMonth: "2026-05",
      }),
    ).toEqual({
      netExternalFlow: 0.01,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 0,
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
  it("calculates percentage from unrounded legacy snapshot intermediates", () => {
    const previous = snapshot("2026-04", 100.004);
    const current = snapshot("2026-05", 100.009, {
      netExternalFlow: 0.001,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 0.001,
    });

    expect(calculateMonthlyPerformance(previous, current)).toEqual({
      denominator: 100.01,
      marketMovement: 0,
      marketMovementPct: 0,
      netExternalFlow: 0.001,
      reason: null,
      status: "available",
      totalValueChange: 0.01,
    });
  });

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
