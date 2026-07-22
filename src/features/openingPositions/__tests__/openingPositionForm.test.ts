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
      instrumentType: "stock",
      notes: " Core holding ",
      quoteSourceId: " reliance-custom ",
      quantity: "25",
      sectorType: "energy",
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
        instrumentType: "stock",
        notes: "Core holding",
        quoteSourceId: "reliance-custom",
        quantity: 25,
        sectorType: "energy",
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
      instrumentType: "unsupported",
      quantity: "0",
      sectorType: "unsupported",
      symbol: "",
      ticker: "",
    });

    expect(result).toEqual({
      errors: {
        assetName: "Asset name is required.",
        averageCostPrice: "Average cost must be greater than zero.",
        currentPrice: "Current price must be greater than zero.",
        date: "Date must use YYYY-MM-DD.",
        instrumentType: "Instrument type is not supported.",
        quantity: "Quantity must be greater than zero.",
        sectorType: "Sector type is not supported.",
        symbol: "Symbol is required.",
        ticker: "Ticker is required.",
      },
      isValid: false,
    });
  });

  it.each(["2026-02-30", "2025-02-29"])(
    "rejects impossible acquisition date %s",
    (date) => {
      const result = validateOpeningPositionForm(
        {
          assetClass: "stock",
          assetName: "Reliance Industries",
          averageCostPrice: "100",
          currentPrice: "120",
          date,
          instrumentType: "stock",
          quantity: "2",
          sectorType: "energy",
          symbol: "RELIANCE",
          ticker: "RELIANCE.NS",
        },
        new Date(2026, 6, 22, 12),
      );

      expect(result).toMatchObject({
        errors: { date: "Date must use YYYY-MM-DD." },
        isValid: false,
      });
    },
  );

  it("rejects a future acquisition date", () => {
    const result = validateOpeningPositionForm(
      {
        assetClass: "stock",
        assetName: "Reliance Industries",
        averageCostPrice: "100",
        currentPrice: "120",
        date: "2026-07-23",
        instrumentType: "stock",
        quantity: "2",
        sectorType: "energy",
        symbol: "RELIANCE",
        ticker: "RELIANCE.NS",
      },
      new Date(2026, 6, 22, 12),
    );

    expect(result).toMatchObject({
      errors: { date: "Date cannot be in the future." },
      isValid: false,
    });
  });
});
