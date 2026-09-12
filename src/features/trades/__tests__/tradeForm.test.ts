import { validateTradeForm } from "@/src/features/trades/tradeForm";
import type { DemergerAdjustment } from "@/src/domain/demergerEvents";
import type { StockSplitEvent, Trade } from "@/src/types";

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
  it("forwards derived successor units to sell validation", () => {
    const entitlement: DemergerAdjustment = {
      assetId: "asset-1",
      cost: "100",
      date: "2026-04-01",
      eventId: "demerger-1",
      firstAcquisitionDate: "2026-03-01",
      kind: "entitlement",
      quantity: 10,
      sourceAssetId: "parent-asset",
      sourceRecordIds: ["parent-buy"],
    };

    expect(validateTradeForm(
      { assetId: "asset-1", date: "2026-04-20", pricePerUnit: "100", quantity: "10", type: "sell" },
      [],
      [],
      new Date("2026-04-20T12:00:00Z"),
      undefined,
      [entitlement],
    )).toMatchObject({ isValid: true });
  });

  it("passes split terms to selected-asset validation and fails closed on unresolved terms", () => {
    const split: StockSplitEvent = {
      id: "split", kind: "split", effectiveDate: "2026-05-01",
      oldIsin: "INE040A01026", newIsin: "INE040A01034", newShares: 2, oldShares: 1,
      evidence: { url: "https://www.nseindia.com/split.pdf", publishedDate: "2026-04-01", verifiedDate: "2026-04-02" },
    };
    const values = { assetId: "asset-1", date: "2026-05-02", quantity: "10", pricePerUnit: "100", type: "sell" as const };
    const now = new Date("2026-05-02T12:00:00Z");
    expect(validateTradeForm(values, [existingBuy, otherAssetBuy], [], now, [split]).isValid).toBe(true);
    expect(validateTradeForm({ ...values, quantity: "11" }, [existingBuy, otherAssetBuy], [], now, [split]).isValid).toBe(false);
    expect(validateTradeForm(values, [existingBuy], [], now, [{ ...split, oldShares: 3 }]))
      .toMatchObject({ isValid: false, errors: { quantity: expect.stringContaining("unavailable") } });
  });

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

  it("accepts an optional planned holding period for buys", () => {
    const result = validateTradeForm(
      {
        assetId: "asset-1",
        conviction: "",
        date: "2026-04-15",
        intendedHoldDays: "365",
        pricePerUnit: "100",
        quantity: "2",
        type: "buy",
      },
      [],
    );

    expect(result).toMatchObject({
      isValid: true,
      value: { intendedHoldDays: 365 },
    });
  });

  it("ignores legacy planned holding input on sells", () => {
    const result = validateTradeForm(
      {
        assetId: "asset-1",
        conviction: "",
        date: "2026-04-15",
        intendedHoldDays: "365",
        pricePerUnit: "100",
        quantity: "1",
        type: "sell",
      },
      [
        {
          assetId: "asset-1",
          date: "2026-04-01",
          id: "buy-1",
          pricePerUnit: 90,
          quantity: 1,
          totalValue: 90,
          type: "buy",
        },
      ],
    );

    expect(result).toMatchObject({
      isValid: true,
      value: { intendedHoldDays: undefined },
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
