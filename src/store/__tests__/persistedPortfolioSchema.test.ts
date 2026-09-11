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
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
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
    expect(parsePersistedPortfolio(serialize({ schemaVersion: 11 }))).toEqual({
      reason: "unsupported-schema",
      success: false,
    });
  });

  it("accepts V9 transfer records and normalizes optional ISIN identity", () => {
    const result = parsePersistedPortfolio(
      serialize({
        assets: [{ ...validAsset, isin: " ine040a01034 " }],
        openingPositions: [
          {
            assetId: validAsset.id,
            averageCostPrice: 100,
            date: "2026-07-10",
            id: "opening-1",
            measuredAsOf: "2026-07-31",
            quantity: 2,
          },
        ],
        schemaVersion: 9,
        trades: [
          {
            acquisitionCostPerUnit: 120,
            assetId: validAsset.id,
            date: "2026-08-01",
            id: "transfer-in-1",
            importProvenance: {
              fingerprint: "fingerprint-1",
              importBatchId: "batch-1",
              originalRowNumber: 2,
              settlementDate: "2026-08-03",
              sourceFormat: "cogvest-transaction-csv",
              sourceVersion: "1",
              taxes: 10,
            },
            quantity: 1,
            type: "transferIn",
          },
          {
            assetId: validAsset.id,
            date: "2026-08-02",
            id: "transfer-out-1",
            quantity: 0.5,
            type: "transferOut",
          },
        ],
      }),
    );

    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.assets?.[0]?.isin).toBe("INE040A01034");
      expect(result.data.openingPositions?.[0]?.measuredAsOf).toBe("2026-07-31");
      expect(result.data.trades).toEqual([
        expect.objectContaining({
          importProvenance: expect.objectContaining({
            settlementDate: "2026-08-03",
          }),
          type: "transferIn",
        }),
        expect.objectContaining({ type: "transferOut" }),
      ]);
    }
  });

  it("preserves legacy buy and sell records without new import fields", () => {
    const result = parsePersistedPortfolio(
      serialize({
        schemaVersion: 1,
        trades: [
          {
            assetId: "asset-1",
            date: "2026-07-22",
            id: "buy-1",
            pricePerUnit: 100,
            quantity: 2,
            totalValue: 200,
            type: "buy",
          },
          {
            assetId: "asset-1",
            date: "2026-07-23",
            id: "sell-1",
            pricePerUnit: 120,
            quantity: 1,
            totalValue: 120,
            type: "sell",
          },
        ],
      }),
    );

    expect(result).toMatchObject({ success: true });
  });

  it("accepts strict PPF accounts and account-scoped ledger entries in V8", () => {
    expect(
      parsePersistedPortfolio(
        serialize({
          ppfAccounts: [
            {
              balanceAsOf: "2026-07-31",
              confirmedBalance: 100000,
              createdAt: "2026-08-01T10:00:00.000Z",
              id: "ppf-1",
              nickname: "Primary PPF",
              opening: { financialYearStart: 2020, kind: "financialYear" },
              provider: "India Post",
              status: "active",
            },
          ],
          ppfLedgerEntries: [
            {
              accountId: "ppf-1",
              amount: 500,
              date: "2026-08-01",
              id: "ppf-entry-1",
              recordedAt: "2026-08-01T10:00:00.000Z",
              type: "contribution",
            },
          ],
          schemaVersion: 8,
        }),
      ),
    ).toMatchObject({ success: true });
  });

  it("rejects orphan or structurally loose PPF records", () => {
    const entry = {
      accountId: "missing-account",
      amount: 500,
      date: "2026-08-01",
      id: "ppf-entry-1",
      recordedAt: "2026-08-01T10:00:00.000Z",
      type: "contribution",
    };

    expect(
      parsePersistedPortfolio(
        serialize({ ppfLedgerEntries: [entry], schemaVersion: 8 }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
    expect(
      parsePersistedPortfolio(
        serialize({
          ppfAccounts: [
            {
              balanceAsOf: "2026-07-31",
              confirmedBalance: 100000,
              createdAt: "2026-08-01T10:00:00.000Z",
              extraField: "not persisted",
              id: "ppf-1",
              nickname: "Primary PPF",
              opening: { financialYearStart: 2020, kind: "financialYear" },
              provider: "India Post",
              status: "active",
            },
          ],
          schemaVersion: 8,
        }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
  });

  it("rejects duplicate and semantically invalid persisted PPF timelines", () => {
    const account = {
      balanceAsOf: "2026-07-31",
      confirmedBalance: 100000,
      createdAt: "2026-08-01T10:00:00.000Z",
      id: "ppf-1",
      nickname: "Primary PPF",
      opening: { financialYearStart: 2020, kind: "financialYear" },
      provider: "India Post",
      status: "active",
    };
    const hiddenEntry = {
      accountId: account.id,
      amount: 500,
      date: account.balanceAsOf,
      id: "entry-1",
      recordedAt: "2026-08-01T10:00:00.000Z",
      type: "contribution",
    };

    expect(
      parsePersistedPortfolio(
        serialize({
          ppfAccounts: [account, { ...account }],
          schemaVersion: 8,
        }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
    expect(
      parsePersistedPortfolio(
        serialize({
          ppfAccounts: [account],
          ppfLedgerEntries: [hiddenEntry],
          schemaVersion: 8,
        }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
    expect(
      parsePersistedPortfolio(
        serialize({
          ppfAccounts: [account],
          ppfLedgerEntries: [
            {
              ...hiddenEntry,
              amount: 100050,
              date: "2026-08-01",
              type: "withdrawal",
            },
          ],
          schemaVersion: 8,
        }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
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

  it("requires durable provenance for an unknown opening-position date", () => {
    const basePosition = {
      assetId: "asset-reliance",
      averageCostPrice: 100,
      currentPrice: 120,
      date: null,
      id: "opening-unknown",
      quantity: 2,
    };

    expect(
      parsePersistedPortfolio(
        serialize({
          openingPositions: [
            {
              ...basePosition,
              recordedAt: "2026-07-10T09:30:00.000Z",
            },
          ],
          schemaVersion: 6,
        }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
    expect(
      parsePersistedPortfolio(
        serialize({
          openingPositions: [
            {
              ...basePosition,
              recordedAt: "2026-07-10T09:30:00.000Z",
              recordedOn: "2026-07-10",
            },
          ],
          schemaVersion: 6,
        }),
      ),
    ).toMatchObject({ success: true });
  });

  it("preserves valid planned holding periods and rejects invalid values", () => {
    const basePosition = {
      assetId: "asset-reliance",
      averageCostPrice: 100,
      date: "2026-07-10",
      id: "opening-planned",
      quantity: 2,
    };
    const valid = parsePersistedPortfolio(
      serialize({
        openingPositions: [{ ...basePosition, intendedHoldDays: 365 }],
        schemaVersion: 9,
      }),
    );

    expect(valid).toMatchObject({ success: true });
    if (valid.success) {
      expect(valid.data.openingPositions?.[0]?.intendedHoldDays).toBe(365);
    }

    expect(
      parsePersistedPortfolio(
        serialize({
          openingPositions: [{ ...basePosition, intendedHoldDays: 0 }],
          schemaVersion: 9,
        }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
  });

  it("rejects contradictory or incomplete manual valuation provenance", () => {
    const basePosition = {
      assetId: "asset-reliance",
      averageCostPrice: 100,
      date: "2026-07-10",
      id: "opening-valued",
      quantity: 2,
    };

    for (const openingPosition of [
      {
        ...basePosition,
        currentPrice: 120,
        manualValuation: {
          asOf: "2026-08-09T10:00:00.000Z",
          currency: "INR",
          price: 120,
          provenance: "user",
          source: "manual",
        },
      },
      {
        ...basePosition,
        manualValuation: {
          asOf: null,
          currency: "INR",
          price: 120,
          provenance: "user",
          source: "manual",
        },
      },
    ]) {
      expect(
        parsePersistedPortfolio(
          serialize({ openingPositions: [openingPosition], schemaVersion: 7 }),
        ),
      ).toEqual({ reason: "invalid-shape", success: false });
    }
  });

  it("rejects a persisted manual valuation in a different currency from its asset", () => {
    expect(
      parsePersistedPortfolio(
        serialize({
          assets: [validAsset],
          openingPositions: [
            {
              assetId: validAsset.id,
              averageCostPrice: 100,
              date: "2026-07-10",
              id: "opening-valued-usd",
              manualValuation: {
                asOf: "2026-08-09T10:00:00.000Z",
                currency: "USD",
                price: 120,
                provenance: "user",
                source: "manual",
              },
              quantity: 2,
            },
          ],
          schemaVersion: 7,
        }),
      ),
    ).toEqual({ reason: "invalid-shape", success: false });
  });

  it("accepts snapshots with explicitly unknown income", () => {
    expect(
      parsePersistedPortfolio(
        serialize({
          monthlySnapshots: [
            {
              cashValue: 1000,
              cryptoValue: 0,
              debtValue: 0,
              equityValue: 0,
              id: "snapshot-2026-07",
              investedValue: 0,
              month: "2026-07",
              monthlyInvestment: 0,
              portfolioValue: 1000,
            },
          ],
          schemaVersion: 5,
        }),
      ),
    ).toMatchObject({ success: true });
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
