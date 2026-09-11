import { calculateHolding, calculatePositionAccounting } from "../calculations/holdings";
import { reconcileTransactions } from "../transactionReconciliation";
import { positionQuantity, StockSplitError } from "../stockSplits";
import type { Asset, OpeningPosition, StockSplitEvent, Trade } from "@/src/types";

const split: StockSplitEvent = {
  id: "synthetic-2-for-1", kind: "split", effectiveDate: "2025-02-01",
  oldIsin: "INE000000001", newIsin: "INE000000002", newShares: 2, oldShares: 1,
  evidence: { url: "https://example.com/synthetic", publishedDate: "2025-01-01", verifiedDate: "2025-02-01" },
};
const asset: Asset = { id: "a", name: "Synthetic", symbol: "TEST", ticker: "TEST.NS", currency: "INR", assetClass: "stock", stockSplits: [split] };
const buy: Trade = { id: "buy", assetId: "a", type: "buy", date: "2025-01-01", quantity: 10, pricePerUnit: 100, totalValue: 1000 };
const sale: Trade = { id: "sale", assetId: "a", type: "sell", date: "2025-02-01", quantity: 5, pricePerUnit: 60, totalValue: 300 };

describe("stock split accounting", () => {
  it("preserves total cost and applies the event before ex-date sales", () => {
    const result = calculateHolding({ asset, trades: [buy, sale], currentPrice: 60 });
    expect(result).toMatchObject({ totalUnits: 15, averageCostPrice: 50, totalInvested: 750 });
    expect(calculatePositionAccounting({ trades: [buy, sale], stockSplits: [split] }).saleGains.sale).toBe(50);
    expect(reconcileTransactions({ transactions: [buy, sale], stockSplits: [split] }))
      .toMatchObject({ isExact: true, quantity: 15, averageCostPrice: 50 });
    expect(buy.quantity).toBe(10);
  });
  it("does not apply a future event to a historical valuation", () => {
    expect(calculateHolding({ asset, trades: [buy], currentPrice: 100, through: "2025-01-31" }))
      .toMatchObject({ totalUnits: 10, totalInvested: 1000, currentValue: 1000 });
    expect(calculateHolding({ asset, trades: [buy], currentPrice: 50, through: "2025-02-01" }))
      .toMatchObject({ totalUnits: 20, totalInvested: 1000, currentValue: 1000 });
  });
  it("does not split an ex-date purchase or a post-event measured opening again", () => {
    expect(positionQuantity({ trades: [{ ...buy, date: split.effectiveDate }], stockSplits: [split] }).toNumber()).toBe(10);
    const opening: OpeningPosition = { id: "o", assetId: "a", date: "2024-01-01", measuredAsOf: "2025-02-01", quantity: 20, averageCostPrice: 50 };
    expect(calculateHolding({ asset, trades: [], openingPositions: [opening], currentPrice: 50 }))
      .toMatchObject({ totalUnits: 20, totalInvested: 1000 });
    expect(() => calculateHolding({ asset, trades: [], openingPositions: [{ ...opening, measuredAsOf: undefined }], currentPrice: 50 })).toThrow(StockSplitError);
  });
  it("supports exact reverse splits but blocks fractional entitlements", () => {
    const reverse = { ...split, newShares: 1, oldShares: 2 };
    expect(reconcileTransactions({ transactions: [buy], stockSplits: [reverse] }))
      .toMatchObject({ isExact: true, quantity: 5, averageCostPrice: 200 });
    expect(reconcileTransactions({ transactions: [{ ...buy, quantity: 3 }], stockSplits: [reverse] }))
      .toMatchObject({ isExact: false, unresolvedTransactionIds: [split.id] });
  });
  it("rejects duplicate or ambiguous events instead of compounding twice", () => {
    expect(() => positionQuantity({ trades: [buy], stockSplits: [split, split] })).toThrow(StockSplitError);
    expect(() => positionQuantity({ trades: [buy], stockSplits: [split, { ...split, id: "other" }] })).toThrow(StockSplitError);
  });
});
