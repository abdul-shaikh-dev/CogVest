import {
  filterHoldingReviewItems,
  getExposureSegments,
  getHoldingReviewSummary,
  getFirstRecordedPurchase,
  type HoldingReviewItem,
} from "@/src/features/holdings/holdingsReview";
import type { Asset, Holding } from "@/src/types";

describe("first recorded purchase", () => {
  const position = {
    id: "opening",
    assetId: "asset",
    quantity: 1,
    averageCostPrice: 100,
    date: "2025-06-01",
  };
  const buy = {
    id: "buy",
    assetId: "asset",
    type: "buy" as const,
    quantity: 1,
    pricePerUnit: 100,
    totalValue: 100,
    date: "2024-04-01",
  };
  it("uses the earliest purchase across opening positions and buys", () => {
    expect(getFirstRecordedPurchase([position], [buy])).toBe("2024-04-01");
  });
  it("does not invent a date when an opening acquisition is unknown", () => {
    expect(
      getFirstRecordedPurchase([{ ...position, date: null }], [buy]),
    ).toBeNull();
  });
  it("does not substitute a measurement date for a purchase date", () => {
    expect(
      getFirstRecordedPurchase(
        [{ ...position, date: null, measuredAsOf: "2026-01-01" }],
        [],
      ),
    ).toBeNull();
  });
  it("returns unknown for missing or invalid recorded dates", () => {
    expect(getFirstRecordedPurchase([], [])).toBeNull();
    expect(
      getFirstRecordedPurchase([], [{ ...buy, date: "invalid" }]),
    ).toBeNull();
  });
});

function createReviewItem({
  allocationPct,
  id,
  pnl,
}: {
  allocationPct: number;
  id: string;
  pnl: number;
}): HoldingReviewItem {
  const asset: Asset = {
    assetClass: "stock",
    currency: "INR",
    id,
    name: id,
    symbol: id,
    ticker: id,
  };
  const holding: Holding = {
    asset,
    averageCostPrice: 100,
    currentPrice: 100 + pnl,
    currentValue: 100 + pnl,
    totalInvested: 100,
    totalUnits: 1,
    unrealisedPnL: pnl,
    unrealisedPnLPct: pnl,
    valuation: {
      asOf: "2026-08-01T00:00:00.000Z",
      currency: "INR",
      price: 100 + pnl,
      source: "yahoo",
      status: "fetched",
    },
  };

  return {
    allocationPct,
    holding,
    initialAllocationPct: allocationPct,
  };
}

describe("holdings review helpers", () => {
  it("does not label a losing position as the best return", () => {
    const items = [
      createReviewItem({ allocationPct: 60, id: "larger-loss", pnl: -20 }),
      createReviewItem({ allocationPct: 40, id: "smaller-loss", pnl: -5 }),
    ];

    expect(getHoldingReviewSummary(items).bestReturn).toBeUndefined();
  });

  it("includes break-even positions in Winners", () => {
    const breakEven = createReviewItem({
      allocationPct: 100,
      id: "break-even",
      pnl: 0,
    });

    expect(filterHoldingReviewItems([breakEven], "winners", "")).toEqual([
      breakEven,
    ]);
  });

  it("aggregates precise exposure values before display rounding", () => {
    const first = createReviewItem({ allocationPct: 50, id: "first", pnl: 0 });
    const second = createReviewItem({
      allocationPct: 50,
      id: "second",
      pnl: 0,
    });
    first.holding.calculationBasis = {
      averageCostPrice: "1",
      currentValue: "0.005",
      totalInvested: "0.005",
      totalUnits: "0.005",
      unrealisedPnL: "0",
    };
    second.holding.calculationBasis = {
      ...first.holding.calculationBasis,
    };

    expect(getExposureSegments([first, second])).toEqual([
      {
        color: "green",
        count: 2,
        key: "equity",
        label: "Equity",
        percentage: 100,
        value: 0.01,
      },
    ]);
  });
});
