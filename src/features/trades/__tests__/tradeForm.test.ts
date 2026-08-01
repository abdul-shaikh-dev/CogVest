import { validateTradeForm } from "@/src/features/trades/tradeForm";
import type { Trade } from "@/src/types";

const existingBuy: Trade = {
  assetId: "asset-1",
  date: "2026-04-20T00:00:00.000Z",
  id: "trade-1",
  pricePerUnit: 100,
  quantity: 5,
  totalValue: 500,
  type: "buy",
};

const otherAssetBuy: Trade = {
  ...existingBuy,
  assetId: "asset-2",
  id: "trade-2",
};

describe("trade form validation", () => {
  it("accepts valid buy values without conviction", () => {
    expect(
      validateTradeForm(
        {
          assetId: "asset-1",
          conviction: "",
          date: "2026-04-20",
          pricePerUnit: "100",
          quantity: "2",
          type: "buy",
        },
        [],
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toEqual({
      isValid: true,
      value: {
        assetId: "asset-1",
        conviction: undefined,
        date: "2026-04-20",
        pricePerUnit: 100,
        quantity: 2,
        type: "buy",
      },
    });
  });

  it("normalizes quantity and unit price to the V1 precision contract", () => {
    expect(
      validateTradeForm(
        {
          assetId: "asset-1",
          date: "2026-04-20",
          pricePerUnit: "0.123456785",
          quantity: "0.123456785",
          type: "buy",
        },
        [],
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toMatchObject({
      isValid: true,
      value: {
        pricePerUnit: 0.12345679,
        quantity: 0.12345679,
      },
    });
  });

  it("rejects positive values below the supported quantity and price quantum", () => {
    expect(
      validateTradeForm(
        {
          assetId: "asset-1",
          date: "2026-04-20",
          pricePerUnit: "0.000000001",
          quantity: "0.000000001",
          type: "buy",
        },
        [],
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toEqual({
      errors: {
        pricePerUnit: "Price precision is limited to 8 decimals.",
        quantity: "Quantity precision is limited to 8 decimals.",
      },
      isValid: false,
    });
  });

  it("returns actionable field errors for invalid buy values", () => {
    expect(
      validateTradeForm(
        {
          assetId: "",
          date: "2026-04-21",
          pricePerUnit: "0",
          quantity: "-1",
          type: "buy",
        },
        [],
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toEqual({
      errors: {
        assetId: "Asset is required.",
        date: "Date cannot be in the future.",
        pricePerUnit: "Price must be greater than zero.",
        quantity: "Quantity must be greater than zero.",
      },
      isValid: false,
    });
  });

  it("returns field-specific errors for non-numeric quantity and price", () => {
    expect(
      validateTradeForm(
        {
          assetId: "asset-1",
          date: "2026-04-20",
          pricePerUnit: "market",
          quantity: "",
          type: "buy",
        },
        [],
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toEqual({
      errors: {
        pricePerUnit: "Price must be a valid number.",
        quantity: "Quantity must be a valid number.",
      },
      isValid: false,
    });
  });

  it("rejects conviction outside the supported optional score range", () => {
    expect(
      validateTradeForm(
        {
          assetId: "asset-1",
          conviction: "6",
          date: "2026-04-20",
          pricePerUnit: "100",
          quantity: "2",
          type: "buy",
        },
        [],
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toEqual({
      errors: {
        conviction: "Conviction must be between 1 and 5.",
      },
      isValid: false,
    });
  });

  it("rejects sell values above available quantity", () => {
    expect(
      validateTradeForm(
        {
          assetId: "asset-1",
          date: "2026-04-20",
          pricePerUnit: "100",
          quantity: "6",
          type: "sell",
        },
        [existingBuy],
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toEqual({
      errors: {
        quantity: "Sell quantity exceeds available units.",
      },
      isValid: false,
    });
  });

  it("does not count other assets when validating sell quantity", () => {
    expect(
      validateTradeForm(
        {
          assetId: "asset-1",
          date: "2026-04-20",
          pricePerUnit: "100",
          quantity: "1",
          type: "sell",
        },
        [otherAssetBuy],
        new Date("2026-04-20T12:00:00.000Z"),
      ),
    ).toEqual({
      errors: {
        quantity: "Sell quantity exceeds available units.",
      },
      isValid: false,
    });
  });
});
