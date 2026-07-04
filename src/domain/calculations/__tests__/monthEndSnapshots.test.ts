import {
  buildGeneratedMonthEndSnapshot,
  getPreviousCompletedMonth,
} from "@/src/domain/calculations";
import { historicalQuoteCacheKey } from "@/src/store";
import type {
  Asset,
  CashEntry,
  HistoricalQuoteCache,
  MonthlySnapshot,
  OpeningPosition,
  QuoteCache,
  Trade,
} from "@/src/types";

const stockAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-stock",
  instrumentType: "stock",
  name: "Reliance Industries",
  sectorType: "energy",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const etfAsset: Asset = {
  assetClass: "etf",
  currency: "INR",
  id: "asset-etf",
  instrumentType: "etf",
  name: "Nifty ETF",
  sectorType: "diversified",
  symbol: "NIFTYETF",
  ticker: "NIFTYETF.NS",
};

const debtAsset: Asset = {
  assetClass: "debt",
  currency: "INR",
  id: "asset-debt",
  instrumentType: "ppf",
  name: "PPF",
  sectorType: "fixedIncome",
  symbol: "PPF",
  ticker: "PPF",
};

const cryptoAsset: Asset = {
  assetClass: "crypto",
  currency: "INR",
  id: "asset-crypto",
  instrumentType: "crypto",
  name: "Bitcoin",
  sectorType: "digitalAsset",
  symbol: "BTC",
  ticker: "bitcoin",
};

function openingPosition(overrides: Partial<OpeningPosition>): OpeningPosition {
  return {
    assetId: stockAsset.id,
    averageCostPrice: 100,
    currentPrice: 180,
    date: "2026-07-10T00:00:00.000Z",
    id: `opening-${Math.random()}`,
    quantity: 10,
    ...overrides,
  };
}

function trade(overrides: Partial<Trade>): Trade {
  return {
    assetId: stockAsset.id,
    date: "2026-07-11T00:00:00.000Z",
    id: `trade-${Math.random()}`,
    pricePerUnit: 110,
    quantity: 2,
    totalValue: 220,
    type: "buy",
    ...overrides,
  };
}

function cashEntry(overrides: Partial<CashEntry>): CashEntry {
  return {
    amount: 1000,
    date: "2026-07-05T00:00:00.000Z",
    id: `cash-${Math.random()}`,
    label: "Deposit",
    type: "addition",
    ...overrides,
  };
}

function buildInput(overrides: {
  assets?: Asset[];
  cashEntries?: CashEntry[];
  existingSnapshots?: MonthlySnapshot[];
  historicalQuotes?: HistoricalQuoteCache;
  now?: Date;
  openingPositions?: OpeningPosition[];
  quoteCache?: QuoteCache;
  trades?: Trade[];
} = {}) {
  return {
    assets: overrides.assets ?? [stockAsset],
    cashEntries: overrides.cashEntries ?? [],
    existingSnapshots: overrides.existingSnapshots ?? [],
    historicalQuotes: overrides.historicalQuotes ?? {},
    now: overrides.now ?? new Date("2026-08-15T10:00:00.000Z"),
    openingPositions: overrides.openingPositions ?? [],
    quoteCache: overrides.quoteCache ?? {},
    trades: overrides.trades ?? [],
  };
}

describe("getPreviousCompletedMonth", () => {
  it("returns the previous completed month for a mid-month date", () => {
    expect(
      getPreviousCompletedMonth(new Date("2026-08-15T10:00:00.000Z")),
    ).toBe("2026-07");
  });

  it("rolls back across years for a January date", () => {
    expect(
      getPreviousCompletedMonth(new Date("2026-01-01T10:00:00.000Z")),
    ).toBe("2025-12");
  });
});

describe("buildGeneratedMonthEndSnapshot", () => {
  it("returns already-exists when the target month snapshot is present", () => {
    const existingSnapshot: MonthlySnapshot = {
      cashValue: 1200,
      cryptoValue: 0,
      debtValue: 0,
      equityValue: 4000,
      id: "snapshot-2026-07",
      investedValue: 3500,
      month: "2026-07",
      monthlyInvestment: 500,
      portfolioValue: 5200,
      salary: 0,
    };

    const result = buildGeneratedMonthEndSnapshot(
      buildInput({
        existingSnapshots: [existingSnapshot],
      }),
    );

    expect(result).toEqual({
      snapshot: existingSnapshot,
      status: "already-exists",
      warnings: [],
    });
  });

  it("returns insufficient-data when nothing can be derived", () => {
    const result = buildGeneratedMonthEndSnapshot(
      buildInput({
        assets: [stockAsset],
        cashEntries: [],
        openingPositions: [],
        trades: [],
      }),
    );

    expect(result.status).toBe("insufficient-data");
    expect(result.snapshot).toBeNull();
    expect(result.warnings).toEqual([
      "No holdings, trades, or cash entries were available to generate the previous month-end snapshot.",
    ]);
  });

  it("returns insufficient-data when all data is after the target month", () => {
    const result = buildGeneratedMonthEndSnapshot(
      buildInput({
        assets: [stockAsset],
        cashEntries: [
          cashEntry({
            date: "2026-08-05T00:00:00.000Z",
          }),
        ],
        openingPositions: [
          openingPosition({
            date: "2026-08-10T00:00:00.000Z",
          }),
        ],
        trades: [
          trade({
            date: "2026-08-11T00:00:00.000Z",
          }),
        ],
      }),
    );

    expect(result.status).toBe("insufficient-data");
    expect(result.snapshot).toBeNull();
    expect(result.warnings).toEqual([
      "No holdings, trades, or cash entries were available to derive for target month 2026-07.",
    ]);
  });

  it("prefers historical quotes over latest local quotes and manual opening prices", () => {
    const result = buildGeneratedMonthEndSnapshot(
      buildInput({
        historicalQuotes: {
          [historicalQuoteCacheKey(stockAsset.id, "2026-07")]: {
            assetId: stockAsset.id,
            asOfMonth: "2026-07",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-08-01T00:00:00.000Z",
            price: 250,
            source: "yahoo",
          },
        },
        openingPositions: [
          openingPosition({
            assetId: stockAsset.id,
            currentPrice: 175,
            quantity: 10,
          }),
        ],
        quoteCache: {
          [stockAsset.id]: {
            assetId: stockAsset.id,
            asOf: "2026-08-14T00:00:00.000Z",
            currency: "INR",
            price: 200,
            source: "yahoo",
          },
        },
      }),
    );

    expect(result.status).toBe("created");
    expect(result.warnings).toEqual([]);
    expect(result.snapshot).toMatchObject({
      equityValue: 2500,
      investedValue: 1000,
      portfolioValue: 2500,
      generated: {
        priceBasis: "historical-close",
        source: "auto",
        warnings: [],
      },
    });
  });

  it("summarises generated metadata and warnings for each pricing basis", () => {
    const now = new Date("2026-08-15T10:00:00.000Z");
    const targetMonth = "2026-07";
    const generatedAt = now.toISOString();

    const scenarios: Array<{
      expectedBasis: MonthlySnapshot["generated"] extends infer T
        ? T extends { priceBasis: infer P }
          ? P
          : never
        : never;
      expectedWarnings: string[];
      historicalQuotes: HistoricalQuoteCache;
      openingPositions: OpeningPosition[];
      quoteCache: QuoteCache;
    }> = [
      {
        expectedBasis: "latest-local-fallback",
        expectedWarnings: ["1 holding used latest local fallback."],
        historicalQuotes: {},
        openingPositions: [openingPosition({})],
        quoteCache: {
          [stockAsset.id]: {
            assetId: stockAsset.id,
            asOf: "2026-08-10T00:00:00.000Z",
            currency: "INR",
            price: 210,
            source: "yahoo",
          },
        },
      },
      {
        expectedBasis: "manual-fallback",
        expectedWarnings: ["1 holding used manual price fallback."],
        historicalQuotes: {},
        openingPositions: [openingPosition({ currentPrice: 190 })],
        quoteCache: {},
      },
      {
        expectedBasis: "unavailable",
        expectedWarnings: ["1 holding could not be priced."],
        historicalQuotes: {},
        openingPositions: [openingPosition({ currentPrice: undefined })],
        quoteCache: {},
      },
      {
        expectedBasis: "mixed",
        expectedWarnings: [
          "1 holding used latest local fallback.",
          "1 holding used manual price fallback.",
        ],
        historicalQuotes: {
          [historicalQuoteCacheKey(stockAsset.id, targetMonth)]: {
            assetId: stockAsset.id,
            asOfMonth: targetMonth,
            basis: "cached-historical-close",
            currency: "INR",
            fetchedAt: generatedAt,
            price: 250,
            source: "yahoo",
          },
        },
        openingPositions: [
          openingPosition({ assetId: stockAsset.id, currentPrice: 180 }),
          openingPosition({
            assetId: etfAsset.id,
            averageCostPrice: 50,
            currentPrice: 52,
            date: "2026-07-10T00:00:00.000Z",
            id: "opening-etf",
            quantity: 20,
          }),
          openingPosition({
            assetId: debtAsset.id,
            averageCostPrice: 1,
            currentPrice: 1.02,
            date: "2026-07-10T00:00:00.000Z",
            id: "opening-debt",
            quantity: 1000,
          }),
        ],
        quoteCache: {
          [etfAsset.id]: {
            assetId: etfAsset.id,
            asOf: "2026-08-10T00:00:00.000Z",
            currency: "INR",
            price: 55,
            source: "yahoo",
          },
        },
      },
    ];

    for (const scenario of scenarios) {
      const result = buildGeneratedMonthEndSnapshot(
        buildInput({
          assets: [stockAsset, etfAsset, debtAsset],
          historicalQuotes: scenario.historicalQuotes,
          now,
          openingPositions: scenario.openingPositions,
          quoteCache: scenario.quoteCache,
        }),
      );

      expect(result.status).toBe("created");
      expect(result.snapshot?.generated).toEqual({
        generatedAt,
        priceBasis: scenario.expectedBasis,
        source: "auto",
        warnings: scenario.expectedWarnings,
      });
      expect(result.warnings).toEqual(scenario.expectedWarnings);
    }
  });

  it("calculates monthly investment and groups asset values into snapshot buckets", () => {
    const result = buildGeneratedMonthEndSnapshot(
      buildInput({
        assets: [stockAsset, etfAsset, debtAsset, cryptoAsset],
        cashEntries: [
          cashEntry({ amount: 1500, type: "addition" }),
          cashEntry({ amount: 250, type: "withdrawal" }),
        ],
        historicalQuotes: {
          [historicalQuoteCacheKey(stockAsset.id, "2026-07")]: {
            assetId: stockAsset.id,
            asOfMonth: "2026-07",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-08-01T00:00:00.000Z",
            price: 250,
            source: "yahoo",
          },
          [historicalQuoteCacheKey(etfAsset.id, "2026-07")]: {
            assetId: etfAsset.id,
            asOfMonth: "2026-07",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-08-01T00:00:00.000Z",
            price: 80,
            source: "yahoo",
          },
          [historicalQuoteCacheKey(debtAsset.id, "2026-07")]: {
            assetId: debtAsset.id,
            asOfMonth: "2026-07",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-08-01T00:00:00.000Z",
            price: 1.1,
            source: "manual",
          },
          [historicalQuoteCacheKey(cryptoAsset.id, "2026-07")]: {
            assetId: cryptoAsset.id,
            asOfMonth: "2026-07",
            basis: "historical-close",
            currency: "INR",
            fetchedAt: "2026-08-01T00:00:00.000Z",
            price: 6000000,
            source: "coingecko",
          },
        },
        openingPositions: [
          openingPosition({
            assetId: stockAsset.id,
            averageCostPrice: 100,
            date: "2026-07-02T00:00:00.000Z",
            id: "opening-stock-july",
            quantity: 10,
          }),
          openingPosition({
            assetId: etfAsset.id,
            averageCostPrice: 50,
            date: "2026-07-03T00:00:00.000Z",
            id: "opening-etf-july",
            quantity: 5,
          }),
          openingPosition({
            assetId: debtAsset.id,
            averageCostPrice: 1,
            date: "2026-06-20T00:00:00.000Z",
            id: "opening-debt-june",
            quantity: 1000,
          }),
          openingPosition({
            assetId: cryptoAsset.id,
            averageCostPrice: 5000000,
            date: "2026-07-04T00:00:00.000Z",
            id: "opening-crypto-july",
            quantity: 0.01,
          }),
        ],
        trades: [
          trade({
            assetId: stockAsset.id,
            date: "2026-07-15T00:00:00.000Z",
            id: "buy-stock-july",
            pricePerUnit: 120,
            quantity: 2,
            totalValue: 240,
            type: "buy",
          }),
          trade({
            assetId: etfAsset.id,
            date: "2026-08-02T00:00:00.000Z",
            id: "buy-etf-august",
            pricePerUnit: 60,
            quantity: 10,
            totalValue: 600,
            type: "buy",
          }),
          trade({
            assetId: stockAsset.id,
            date: "2026-07-20T00:00:00.000Z",
            id: "sell-stock-july",
            pricePerUnit: 130,
            quantity: 1,
            totalValue: 130,
            type: "sell",
          }),
        ],
      }),
    );

    expect(result.status).toBe("created");
    expect(result.snapshot?.month).toBe("2026-07");
    expect(result.snapshot?.monthlyInvestment).toBe(51490);
    expect(result.snapshot?.equityValue).toBe(3150);
    expect(result.snapshot?.debtValue).toBe(1100);
    expect(result.snapshot?.cryptoValue).toBe(60000);
    expect(result.snapshot?.cashValue).toBe(1250);
    expect(result.snapshot?.investedValue).toBeCloseTo(52386.666666666664);
    expect(result.snapshot?.portfolioValue).toBe(65500);
    expect(result.snapshot?.salary).toBe(0);
  });
});
