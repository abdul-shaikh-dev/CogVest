import {
  filterHoldingReviewItems,
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
});
