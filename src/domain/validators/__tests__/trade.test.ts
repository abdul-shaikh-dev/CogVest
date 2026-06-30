import { validateSellQuantity, validateTradeInput } from "@/src/domain/validators";
import type { OpeningPosition, Trade } from "@/src/types";

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
