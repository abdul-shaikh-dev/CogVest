import {
  analyseConviction,
  analysePatienceFromSells,
  analyseTradeFrequency,
  generateInsights,
} from "@/src/domain/calculations";
import type { OpeningPosition, Trade } from "@/src/types";

function buy(
  id: string,
  date: string,
  overrides: Partial<Trade> = {},
): Trade {
  return {
    assetId: "asset-1",
    date,
    id,
    pricePerUnit: 100,
    quantity: 1,
    totalValue: 100,
    type: "buy",
    ...overrides,
  } as Trade;
}

function sell(
  id: string,
  date: string,
  quantity = 1,
): Trade {
  return {
    assetId: "asset-1",
    date,
    id,
    pricePerUnit: 120,
    quantity,
    totalValue: 120 * quantity,
    type: "sell",
  };
}

function opening(
  overrides: Partial<OpeningPosition> = {},
): OpeningPosition {
  return {
    assetId: "asset-1",
    averageCostPrice: 80,
    date: "2025-01-01",
    id: "opening-1",
    measuredAsOf: "2025-01-31",
    quantity: 1,
    ...overrides,
  };
}

describe("behaviour insight calculations", () => {
  describe("analyseConviction", () => {
    it("reuses the five-rating threshold and excludes transfer metadata", () => {
      const trades: Trade[] = [
        buy("buy-1", "2025-01-01", { conviction: 1 }),
        buy("buy-2", "2025-01-02", { conviction: 3 }),
        sell("sell-1", "2025-02-01"),
        buy("buy-3", "2025-02-02", { conviction: 4 }),
        buy("buy-4", "2025-02-03", { conviction: 5 }),
        {
          assetId: "asset-1",
          conviction: 5,
          date: "2025-02-04",
          id: "transfer-1",
          quantity: 1,
          type: "transferIn",
        },
      ];

      const analysis = analyseConviction(trades, [
        opening({ conviction: 2 }),
      ]);

      expect(analysis).toEqual({
        availability: "available",
        distribution: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
        eligibleDecisionCount: 6,
        highCount: 2,
        lowCount: 2,
        neutralCount: 1,
        ratedDecisionCount: 5,
        requiredDecisionCount: 5,
        unratedDecisionCount: 1,
      });
    });

    it("keeps the distribution visible below the threshold", () => {
      const analysis = analyseConviction([
        buy("buy-1", "2025-01-01", { conviction: 4 }),
      ]);

      expect(analysis.availability).toBe("insufficientData");
      expect(analysis.ratedDecisionCount).toBe(1);
      expect(analysis.distribution[4]).toBe(1);
    });
  });

  describe("analysePatienceFromSells", () => {
    it("does not classify floating-point dust as a second planned lot", () => {
      const analysis = analysePatienceFromSells([
        buy("first", "2025-01-01", { quantity: 0.3, intendedHoldDays: 1 }),
        buy("second", "2025-01-02", { quantity: 1, intendedHoldDays: 365 }),
        sell("partial", "2025-02-01", 0.1),
        sell("remainder", "2025-02-02", 0.2),
      ]);
      expect(analysis.metPlanCount).toBe(2);
      expect(analysis.mixedOutcomeCount).toBe(0);
      expect(analysis.plannedMatchedQuantity).toBe(0.3);
      expect(analysis.uncoveredSaleQuantity).toBe(0);
    });

    it("does not consume an opening position before its effective history date", () => {
      const analysis = analysePatienceFromSells(
        [
          buy("early-buy", "2025-01-01", { intendedHoldDays: 10 }),
          sell("early-sale", "2025-02-01"),
          sell("later-sale", "2025-04-01"),
        ],
        [opening({ date: "2025-03-01", measuredAsOf: undefined, intendedHoldDays: 365 })],
      );
      expect(analysis.observedSaleCount).toBe(2);
      expect(analysis.metPlanCount).toBe(1);
      expect(analysis.closedEarlierCount).toBe(1);
      expect(analysis.uncoveredSaleQuantity).toBe(0);
    });

    it.each([0, -1, 1.5])("does not infer a plan from legacy invalid days %s", (intendedHoldDays) => {
      const analysis = analysePatienceFromSells([
        buy("legacy", "2025-01-01", { intendedHoldDays }),
        sell("sale", "2025-02-01"),
      ]);
      expect(analysis.observedSaleCount).toBe(0);
      expect(analysis.uncoveredSaleQuantity).toBe(1);
    });

    it("uses acquisition FIFO among openings already effective at the sale", () => {
      const analysis = analysePatienceFromSells(
        [sell("sale", "2025-04-01")],
        [
          opening({ id: "newer", date: "2025-02-01", measuredAsOf: "2025-02-28", intendedHoldDays: 365 }),
          opening({ id: "older", date: "2025-01-01", measuredAsOf: "2025-03-31", intendedHoldDays: 10 }),
        ],
      );
      expect(analysis.metPlanCount).toBe(1);
      expect(analysis.closedEarlierCount).toBe(0);
    });

    it("uses FIFO lots and becomes available at three planned sale events", () => {
      const trades: Trade[] = [
        buy("buy-1", "2025-02-01", {
          intendedHoldDays: 30,
          quantity: 2,
        }),
        sell("sell-1", "2025-03-03"),
        sell("sell-2", "2025-03-10"),
        buy("buy-2", "2025-04-01", { intendedHoldDays: 60 }),
        sell("sell-3", "2025-04-30"),
      ];

      const analysis = analysePatienceFromSells(trades);

      expect(analysis).toEqual({
        availability: "available",
        closedEarlierCount: 1,
        metPlanCount: 2,
        mixedOutcomeCount: 0,
        observedSaleCount: 3,
        plannedMatchedQuantity: 3,
        requiredSaleCount: 3,
        uncoveredSaleQuantity: 0,
      });
    });

    it("counts one observation per sale even when a sale spans planned lots", () => {
      const analysis = analysePatienceFromSells([
        buy("buy-1", "2025-01-01", {
          intendedHoldDays: 10,
          quantity: 1,
        }),
        buy("buy-2", "2025-01-02", {
          intendedHoldDays: 100,
          quantity: 1,
        }),
        sell("sell-1", "2025-02-01", 2),
      ]);

      expect(analysis.observedSaleCount).toBe(1);
      expect(analysis.plannedMatchedQuantity).toBe(2);
      expect(analysis.mixedOutcomeCount).toBe(1);
      expect(analysis.availability).toBe("insufficientData");
    });

    it("does not guess unknown, transfer, unmatched, or pre-cutover evidence", () => {
      const analysis = analysePatienceFromSells(
        [
          buy("represented-buy", "2025-01-15", { intendedHoldDays: 1 }),
          {
            assetId: "asset-1",
            date: "2025-02-01",
            id: "transfer-in",
            quantity: 1,
            type: "transferIn",
          },
          sell("sell-1", "2025-03-01", 3),
        ],
        [opening({ date: null, intendedHoldDays: 30, quantity: 1 })],
      );

      expect(analysis.observedSaleCount).toBe(0);
      expect(analysis.uncoveredSaleQuantity).toBe(3);
      expect(analysis.availability).toBe("insufficientData");
    });

    it("uses corrected input and omits deleted records without stored conclusions", () => {
      const corrected = buy("buy-1", "2025-01-01", {
        intendedHoldDays: 20,
      });
      const sale = sell("sell-1", "2025-01-21");

      expect(analysePatienceFromSells([corrected, sale]).metPlanCount).toBe(1);
      expect(analysePatienceFromSells([sale]).observedSaleCount).toBe(0);
    });
  });

  describe("analyseTradeFrequency", () => {
    it("uses an inclusive rolling 90-day window and excludes transfers", () => {
      const analysis = analyseTradeFrequency({
        asOf: "2025-03-31",
        openingPositions: [
          opening({ measuredAsOf: "2024-12-01" }),
        ],
        trades: [
          buy("outside", "2024-12-31"),
          buy("boundary", "2025-01-01"),
          sell("sell-1", "2025-03-31"),
          {
            assetId: "asset-1",
            date: "2025-02-01",
            id: "transfer-1",
            quantity: 1,
            type: "transferOut",
          },
        ],
      });

      expect(analysis).toEqual({
        activeTradingDays: 2,
        availability: "available",
        buyCount: 1,
        minimumObservableDays: 30,
        observableDays: 90,
        sellCount: 1,
        tradesPer30Days: 0.67,
        transactionCount: 2,
        windowDays: 90,
        windowEnd: "2025-03-31",
        windowStart: "2025-01-01",
      });
    });

    it("requires 30 observable days but permits zero activity after tracking starts", () => {
      const below = analyseTradeFrequency({
        asOf: "2025-01-29",
        openingPositions: [opening({ measuredAsOf: "2025-01-01" })],
        trades: [],
      });
      const boundary = analyseTradeFrequency({
        asOf: "2025-01-30",
        openingPositions: [opening({ measuredAsOf: "2025-01-01" })],
        trades: [],
      });

      expect(below.observableDays).toBe(29);
      expect(below.availability).toBe("insufficientData");
      expect(boundary.observableDays).toBe(30);
      expect(boundary.availability).toBe("available");
      expect(boundary.transactionCount).toBe(0);
    });

    it("does not treat transfers as frequency history", () => {
      const analysis = analyseTradeFrequency({
        asOf: "2025-03-31",
        trades: [
          {
            assetId: "asset-1",
            date: "2025-01-01",
            id: "transfer-1",
            quantity: 1,
            type: "transferIn",
          },
        ],
      });

      expect(analysis.observableDays).toBe(0);
      expect(analysis.transactionCount).toBe(0);
      expect(analysis.availability).toBe("insufficientData");
    });

    it("rejects an invalid as-of date", () => {
      expect(() =>
        analyseTradeFrequency({ asOf: "not-a-date", trades: [] }),
      ).toThrow("valid as-of calendar date");
    });
  });

  it("generates deterministic reflective language only for available analyses", () => {
    const analyses = {
      conviction: analyseConviction(
        [1, 2, 3, 4, 5].map((conviction, index) =>
          buy(`buy-${index}`, `2025-01-0${index + 1}`, {
            conviction: conviction as 1 | 2 | 3 | 4 | 5,
          }),
        ),
      ),
      frequency: analyseTradeFrequency({
        asOf: "2025-03-31",
        openingPositions: [opening({ measuredAsOf: "2025-01-01" })],
        trades: [buy("buy-f", "2025-03-01"), sell("sell-f", "2025-03-02")],
      }),
      patience: analysePatienceFromSells([]),
    };

    expect(generateInsights(analyses)).toEqual([
      {
        evidence: "5 rated decisions",
        kind: "conviction",
        summary: "2 were rated 4-5, 1 were rated 3, and 2 were rated 1-2.",
        title: "Conviction pattern",
      },
      {
        evidence: "90 observable days",
        kind: "frequency",
        summary: "1 buy and 1 sell were recorded across 2 active days.",
        title: "Trading frequency",
      },
    ]);
    expect(generateInsights(analyses)).toEqual(generateInsights(analyses));
  });

  it("describes met, earlier, and mixed patience outcomes without judgment", () => {
    const patience = {
      ...analysePatienceFromSells([]),
      availability: "available" as const,
      closedEarlierCount: 1,
      metPlanCount: 1,
      mixedOutcomeCount: 1,
      observedSaleCount: 3,
    };
    const insights = generateInsights({
      conviction: analyseConviction([]),
      frequency: analyseTradeFrequency({ asOf: "2025-01-01", trades: [] }),
      patience,
    });

    expect(insights).toEqual([
      {
        evidence: "3 sales with planned lots",
        kind: "patience",
        summary:
          "1 met or passed the intended holding period and 1 closed earlier. 1 included both timings.",
        title: "Planned holding periods",
      },
    ]);
  });
});
