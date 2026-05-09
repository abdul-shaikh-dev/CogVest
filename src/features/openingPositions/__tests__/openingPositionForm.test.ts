import { validateOpeningPositionForm } from "@/src/features/openingPositions";

describe("validateOpeningPositionForm", () => {
  it("normalizes a valid opening-position form", () => {
    const result = validateOpeningPositionForm({
      assetClass: "stock",
      assetName: " Reliance Industries ",
      averageCostPrice: "1450",
      conviction: "4",
      currentPrice: "1678.25",
      date: "2026-04-15",
      notes: " Core holding ",
      quantity: "25",
      symbol: " reliance ",
      ticker: " reliance.ns ",
    });

    expect(result).toEqual({
      isValid: true,
      value: {
        assetClass: "stock",
        assetName: "Reliance Industries",
        averageCostPrice: 1450,
        conviction: 4,
        currentPrice: 1678.25,
        date: "2026-04-15",
        notes: "Core holding",
        quantity: 25,
        symbol: "RELIANCE",
        ticker: "RELIANCE.NS",
      },
    });
  });

  it("rejects missing identity and non-positive numbers", () => {
    const result = validateOpeningPositionForm({
      assetClass: "stock",
      assetName: "",
      averageCostPrice: "0",
      currentPrice: "-1",
      date: "15-04-2026",
      quantity: "0",
      symbol: "",
      ticker: "",
    });

    expect(result).toEqual({
      errors: {
        assetName: "Asset name is required.",
        averageCostPrice: "Average cost must be greater than zero.",
        currentPrice: "Current price must be greater than zero.",
        date: "Date must use YYYY-MM-DD.",
        quantity: "Quantity must be greater than zero.",
        symbol: "Symbol is required.",
        ticker: "Ticker is required.",
      },
      isValid: false,
    });
  });
});
