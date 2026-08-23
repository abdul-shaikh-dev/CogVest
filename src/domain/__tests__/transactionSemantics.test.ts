import {
  getTradeCostBasisAcquisition,
  getTradeQuantityDelta,
  hasUnresolvedTransferCostBasis,
  isTradeCashPurchase,
} from "@/src/domain/transactionSemantics";
import type { BuyTrade, Trade } from "@/src/types";

function buyTransaction(overrides: Partial<BuyTrade> = {}): BuyTrade {
  return {
    assetId: "asset-1",
    date: "2026-08-01",
    id: "transaction-1",
    pricePerUnit: 100,
    quantity: 2,
    totalValue: 200,
    type: "buy",
    ...overrides,
  };
}

const transferIn: Trade = {
  assetId: "asset-1",
  date: "2026-08-01",
  id: "transfer-in-1",
  quantity: 2,
  type: "transferIn",
};

const transferOut: Trade = {
  assetId: "asset-1",
  date: "2026-08-01",
  id: "transfer-out-1",
  quantity: 2,
  type: "transferOut",
};

describe("transaction semantics", () => {
  it.each([
    [buyTransaction(), 2],
    [{ ...buyTransaction(), type: "sell" } as Trade, -2],
    [transferIn, 2],
    [transferOut, -2],
  ] as const)("returns the correct quantity delta for %s", (trade, expected) => {
    expect(getTradeQuantityDelta(trade)).toBe(expected);
  });

  it("includes only buys and costed transfer-ins in the applicable basis rules", () => {
    const buy = buyTransaction({ fees: 10 });
    const costedTransfer: Trade = {
      acquisitionCostPerUnit: 150,
      assetId: "asset-1",
      date: "2026-08-01",
      id: "costed-transfer-in-1",
      quantity: 2,
      type: "transferIn",
    };
    const uncostedTransfer = transferIn;

    expect(isTradeCashPurchase(buy)).toBe(true);
    expect(isTradeCashPurchase(costedTransfer)).toBe(false);
    expect(getTradeCostBasisAcquisition(buy)).toEqual({
      fees: 10,
      pricePerUnit: 100,
      quantity: 2,
    });
    expect(getTradeCostBasisAcquisition(costedTransfer)).toEqual({
      fees: 0,
      pricePerUnit: 150,
      quantity: 2,
    });
    expect(getTradeCostBasisAcquisition(uncostedTransfer)).toBeUndefined();
    expect(hasUnresolvedTransferCostBasis(uncostedTransfer)).toBe(true);
  });
});
