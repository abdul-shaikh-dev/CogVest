import { getAvailableQuantity, validateSellQuantity, validateTradeInput } from "@/src/domain/validators";
import type { OpeningPosition, StockSplitEvent, Trade } from "@/src/types";

const existingBuy: Trade = {
  assetId: "asset-1",
  date: "2026-04-20T00:00:00.000Z",
  id: "trade-1",
  pricePerUnit: 100,
  quantity: 5,
  totalValue: 500,
  type: "buy",
};

const existingOpeningPosition: OpeningPosition = {
  assetId: "asset-1",
  averageCostPrice: 100,
  currentPrice: 120,
  date: "2026-04-01T00:00:00.000Z",
  id: "opening-1",
  quantity: 10,
};

describe("trade validators", () => {
  const split: StockSplitEvent = {
    id: "split", kind: "split", effectiveDate: "2026-05-01",
    oldIsin: "INE040A01026", newIsin: "INE040A01034", newShares: 2, oldShares: 1,
    evidence: { url: "https://www.nseindia.com/split.pdf", publishedDate: "2026-04-01", verifiedDate: "2026-04-02" },
  };

  it("uses the split timeline without multiplying ex-date buys or future trades", () => {
    const trades: Trade[] = [existingBuy,
      { ...existingBuy, id: "ex-date", date: "2026-05-01", quantity: 3 },
      { ...existingBuy, id: "future", date: "2026-06-01", quantity: 100 },
    ];
    expect(getAvailableQuantity(trades, [], new Date("2026-04-30T12:00:00Z"), [split])).toBe(5);
    expect(validateSellQuantity(trades, 13, [], new Date("2026-05-02T12:00:00Z"), [split]))
      .toEqual({ availableQuantity: 13, isValid: true });
  });

  it("preserves measured cutovers and rejects unresolved fractional splits", () => {
    const now = new Date("2026-05-02T12:00:00Z");
    expect(getAvailableQuantity([existingBuy], [{ ...existingOpeningPosition, measuredAsOf: "2026-04-30" }], now, [split])).toBe(20);
    expect(validateSellQuantity([existingBuy], 1, [], now, [{ ...split, newShares: 1, oldShares: 2 }]))
      .toMatchObject({ isValid: false, availableQuantity: Number.NaN, message: expect.stringContaining("unavailable") });
    expect(validateSellQuantity([], 1, [existingOpeningPosition], now, [split]).isValid).toBe(false);
  });

  it("allows sell quantity within available units", () => {
    expect(validateSellQuantity([existingBuy], 3)).toEqual({
      availableQuantity: 5,
      isValid: true,
    });
  });

  it("rejects sell quantity above available units", () => {
    expect(validateSellQuantity([existingBuy], 6)).toEqual({
      availableQuantity: 5,
      isValid: false,
      message: "Sell quantity exceeds available units.",
    });
  });

  it("includes opening positions when validating sell quantity", () => {
    expect(validateSellQuantity([], 7, [existingOpeningPosition])).toEqual({
      availableQuantity: 10,
      isValid: true,
    });
  });

  it("subtracts prior sells from opening positions when validating sell quantity", () => {
    const priorSell: Trade = {
      ...existingBuy,
      id: "trade-sell",
      quantity: 3,
      totalValue: 360,
      type: "sell",
    };

    expect(validateSellQuantity([priorSell], 7, [existingOpeningPosition])).toEqual({
      availableQuantity: 7,
      isValid: true,
    });
    expect(validateSellQuantity([priorSell], 8, [existingOpeningPosition])).toEqual({
      availableQuantity: 7,
      isValid: false,
      message: "Sell quantity exceeds available units.",
    });
  });

  it("uses transfer direction when calculating available quantity", () => {
    const transferIn: Trade = {
      acquisitionCostPerUnit: 100,
      assetId: "asset-1",
      date: "2026-04-20T00:00:00.000Z",
      id: "transfer-in-1",
      quantity: 5,
      type: "transferIn",
    };
    const transferOut: Trade = {
      assetId: "asset-1",
      date: "2026-04-21T00:00:00.000Z",
      id: "transfer-out-1",
      quantity: 2,
      type: "transferOut",
    };

    expect(validateSellQuantity([transferIn, transferOut], 3)).toEqual({
      availableQuantity: 3,
      isValid: true,
    });
  });

  it("validates positive trade quantity and price", () => {
    expect(
      validateTradeInput({
        date: "2026-04-20T00:00:00.000Z",
        pricePerUnit: 100,
        quantity: 1,
        type: "buy",
      }),
    ).toEqual({ isValid: true });

    expect(
      validateTradeInput({
        date: "2026-04-20T00:00:00.000Z",
        pricePerUnit: 0,
        quantity: -1,
        type: "buy",
      }),
    ).toEqual({
      errors: ["Quantity must be greater than zero.", "Price must be greater than zero."],
      isValid: false,
    });
  });

  it("rejects future-dated trades", () => {
    expect(
      validateTradeInput(
        {
          date: "2026-04-21T00:00:00.000Z",
          pricePerUnit: 100,
          quantity: 1,
          type: "buy",
        },
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toEqual({
      errors: ["Date cannot be in the future."],
      isValid: false,
    });
  });
});
