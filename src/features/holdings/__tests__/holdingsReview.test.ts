import {
  filterHoldingReviewItems,
  getExposureSegments,
  getHoldingReviewSummary,
  type HoldingReviewItem,
} from "@/src/features/holdings/holdingsReview";
import type { Asset, Holding } from "@/src/types";

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
    const second = createReviewItem({ allocationPct: 50, id: "second", pnl: 0 });
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
