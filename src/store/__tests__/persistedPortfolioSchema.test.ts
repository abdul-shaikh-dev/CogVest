import {
  parsePersistedHistoricalQuoteCache,
  parsePersistedPortfolio,
  parsePersistedQuoteCache,
} from "@/src/store/persistedPortfolioSchema";

const validAsset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

function serialize(value: unknown) {
  return JSON.stringify(value);
}

describe("persisted portfolio schema", () => {
  it.each([1, 2, 3, 4, 5])(
    "accepts a valid V%s portfolio with legacy optional fields absent",
    (schemaVersion) => {
      const result = parsePersistedPortfolio(
        serialize({
          assets: [validAsset],
          cashEntries: [
            {
              amount: 10000,
              date: "2026-07-22",
              id: "cash-1",
              label: "Initial balance",
              type: "addition",
            },
          ],
          preferences: { maskWealthValues: false },
          schemaVersion,
          trades: [],
        }),
      );

      expect(result).toMatchObject({ success: true });
    },
  );

  it("returns a safe failure for malformed JSON", () => {
    expect(parsePersistedPortfolio("{ invalid")).toEqual({
      reason: "invalid-json",
      success: false,
    });
  });

  it("returns a safe failure for an unsupported schema version", () => {
    expect(parsePersistedPortfolio(serialize({ schemaVersion: 6 }))).toEqual({
      reason: "unsupported-schema",
      success: false,
    });
  });

  it("rejects invalid record values before migration", () => {
    const result = parsePersistedPortfolio(
      serialize({
        assets: [{ ...validAsset, name: "" }],
        schemaVersion: 5,
      }),
    );

    expect(result).toEqual({ reason: "invalid-shape", success: false });
  });

  it("rejects non-finite persisted values", () => {
    const result = parsePersistedPortfolio(
      '{"assets":[],"schemaVersion":5,"trades":[{"assetId":"asset-1","date":"2026-07-22","id":"trade-1","pricePerUnit":1e9999,"quantity":1,"totalValue":1,"type":"buy"}]}',
    );

    expect(result).toEqual({ reason: "invalid-shape", success: false });
  });

  it("validates current quote caches without exposing their content on failure", () => {
    expect(
      parsePersistedQuoteCache(
        serialize({
          "asset-reliance": {
            asOf: "2026-07-22T09:00:00.000Z",
            assetId: "asset-reliance",
            currency: "INR",
            price: 1450,
            source: "yahoo",
          },
        }),
      ),
    ).toMatchObject({ success: true });

    expect(
      parsePersistedQuoteCache(
        serialize({ "asset-reliance": { price: "not-a-number" } }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
  });

  it("validates historical quote caches independently", () => {
    expect(
      parsePersistedHistoricalQuoteCache(
        serialize({
          "asset-reliance:2026-06": {
            asOfMonth: "2026-06",
            assetId: "asset-reliance",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-07-01T00:00:00.000Z",
            price: 1442,
            source: "yahoo",
          },
        }),
      ),
    ).toMatchObject({ success: true });

    expect(parsePersistedHistoricalQuoteCache("{ invalid")).toEqual({
      reason: "invalid-json",
      success: false,
    });
  });
});
