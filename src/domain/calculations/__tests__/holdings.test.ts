import {
  calculateAllocation,
  calculateCashBalance,
  calculateCashMonthlyMetrics,
  calculateConsolidatedHoldingRows,
  calculateHolding,
  calculateHoldings,
  calculateInstrumentAllocation,
  calculateMonthlyProgressSummaries,
  calculatePortfolioDayChange,
  calculatePortfolioRollupTotals,
  calculatePortfolioTotal,
  calculateSectorAllocation,
  daysHeld,
  getConvictionReadiness,
} from "@/src/domain/calculations";
import type { Asset, CashEntry, OpeningPosition, Quote, Trade } from "@/src/types";
import type { MonthlySnapshot } from "@/src/types";

const reliance: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-reliance",
  instrumentType: "stock",
  name: "Reliance Industries",
  sectorType: "energy",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const bitcoin: Asset = {
  assetClass: "crypto",
  currency: "INR",
  exchange: "CRYPTO",
  id: "asset-btc",
  instrumentType: "crypto",
  name: "Bitcoin",
  sectorType: "digitalAsset",
  symbol: "BTC",
  ticker: "bitcoin",
};

const unsupportedForeignAsset: Asset = {
  assetClass: "stock",
  currency: "USD",
  id: "asset-aapl",
  instrumentType: "stock",
  name: "Apple",
  sectorType: "technology",
  symbol: "AAPL",
  ticker: "AAPL",
};

const ppf: Asset = {
  assetClass: "debt",
  currency: "INR",
  id: "asset-ppf",
  instrumentType: "ppf",
  name: "Public Provident Fund",
  sectorType: "fixedIncome",
  symbol: "PPF",
  ticker: "PPF",
};

function trade(overrides: Partial<Trade>): Trade {
  return {
    assetId: reliance.id,
    date: "2026-04-20T00:00:00.000Z",
    id: `trade-${Math.random()}`,
    pricePerUnit: 100,
    quantity: 1,
    totalValue: 100,
    type: "buy",
    ...overrides,
  };
}

function openingPosition(
  overrides: Partial<OpeningPosition>,
): OpeningPosition {
  return {
    assetId: reliance.id,
    averageCostPrice: 1400,
    currentPrice: 1678.25,
    date: "2026-04-15T00:00:00.000Z",
    id: `opening-${Math.random()}`,
    quantity: 25,
    ...overrides,
  };
}

describe("holding calculations", () => {
  it("keeps ownership and invested value explicit while valuation is pending", () => {
    const position = openingPosition({ currentPrice: undefined });
    const pendingHoldings = calculateHoldings({
      assets: [reliance],
      openingPositions: [position],
      quoteCache: {},
      trades: [],
    });

    expect(pendingHoldings).toHaveLength(1);
    expect(pendingHoldings[0]).toMatchObject({
      currentPrice: null,
      currentValue: null,
      totalInvested: 35000,
      unrealisedPnL: null,
      unrealisedPnLPct: null,
      valuation: { status: "pending" },
    });
    expect(calculatePortfolioTotal(pendingHoldings, [])).toBeNull();
    expect(calculateAllocation({ cashBalance: 0, holdings: pendingHoldings })).toEqual([]);
    expect(
      calculatePortfolioRollupTotals(
        calculateConsolidatedHoldingRows(pendingHoldings),
        0,
        pendingHoldings,
      ),
    ).toMatchObject({
      holdingsCurrentValue: null,
      pnl: null,
      pnlPct: null,
      totalCurrentValue: null,
      totalInvested: 35000,
      valuationCoverage: {
        pendingAssetIds: [reliance.id],
        pendingHoldings: 1,
        pendingInvestedValue: 35000,
        status: "incomplete",
        totalHoldings: 1,
        valuedHoldings: 0,
      },
      valuedHoldingsSubtotal: 0,
    });

    const resolved = calculateHoldings({
      assets: [reliance],
      openingPositions: [position],
      quoteCache: {
        [reliance.id]: {
          asOf: "2026-08-09T10:00:00.000Z",
          assetId: reliance.id,
          currency: "INR",
          price: 1600,
          source: "yahoo",
        },
      },
      trades: [],
    });

    expect(resolved[0]).toMatchObject({
      currentValue: 40000,
      valuation: { source: "yahoo", status: "fetched" },
    });
  });

  it("includes an unknown-date opening position in current totals after it was recorded", () => {
    const holdings = calculateHoldings({
      assets: [reliance],
      now: new Date("2026-07-20T10:00:00.000Z"),
      openingPositions: [
        openingPosition({
          averageCostPrice: 100,
          currentPrice: 120,
          date: null,
          quantity: 2,
          recordedAt: "2026-07-10T09:30:00.000Z",
        }),
      ],
      quoteCache: {},
      trades: [],
    });

    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({
      currentValue: 240,
      totalInvested: 200,
      totalUnits: 2,
    });
  });

  it("calculates weighted average cost for buy trades", () => {
    const holding = calculateHolding({
      asset: reliance,
      currentPrice: 120,
      trades: [
        trade({ pricePerUnit: 100, quantity: 10, totalValue: 1000 }),
        trade({ pricePerUnit: 200, quantity: 5, totalValue: 1000 }),
      ],
    });

    expect(holding.totalUnits).toBe(15);
    expect(holding.averageCostPrice).toBeCloseTo(133.333333, 5);
    expect(holding.totalInvested).toBeCloseTo(2000, 5);
    expect(holding.currentValue).toBe(1800);
    expect(holding.unrealisedPnL).toBeCloseTo(-200, 5);
    expect(holding.unrealisedPnLPct).toBeCloseTo(-10, 5);
  });

  it("reconciles repeated fractional crypto buys, fees, and partial sells", () => {
    const buys = Array.from({ length: 100 }, (_, index) =>
      trade({
        assetId: bitcoin.id,
        date: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        fees: 0.01,
        pricePerUnit: 5_000_000 + index * 0.01,
        quantity: 0.001,
        totalValue: (5_000_000 + index * 0.01) * 0.001 + 0.01,
      }),
    );
    const sells = Array.from({ length: 40 }, (_, index) =>
      trade({
        assetId: bitcoin.id,
        date: new Date(Date.UTC(2026, 1, 1, 0, 0, index)).toISOString(),
        pricePerUnit: 5_100_000,
        quantity: 0.001,
        totalValue: 5_100,
        type: "sell",
      }),
    );
    const expectedBuyCost = buys.reduce(
      (total, buy) =>
        total + buy.pricePerUnit * buy.quantity + (buy.fees ?? 0),
      0,
    );
    const expectedAverageCost = expectedBuyCost / 0.1;

    const holding = calculateHolding({
      asset: bitcoin,
      currentPrice: 5_200_000,
      trades: [...buys, ...sells],
    });

    expect(holding.totalUnits).toBeCloseTo(0.06, 12);
    expect(holding.averageCostPrice).toBeCloseTo(expectedAverageCost, 7);
    expect(holding.totalInvested).toBe(300000.63);
    expect(holding.currentValue).toBeCloseTo(
      holding.totalUnits * holding.currentPrice!,
      8,
    );
    expect(holding.unrealisedPnL).toBeCloseTo(
      holding.currentValue! - holding.totalInvested,
      8,
    );
  });

  it("keeps average cost stable after a partial sell", () => {
    const holding = calculateHolding({
      asset: reliance,
      currentPrice: 150,
      trades: [
        trade({ pricePerUnit: 100, quantity: 10, totalValue: 1000 }),
        trade({ pricePerUnit: 200, quantity: 10, totalValue: 2000 }),
        trade({
          pricePerUnit: 175,
          quantity: 5,
          totalValue: 875,
          type: "sell",
        }),
      ],
    });

    expect(holding.totalUnits).toBe(15);
    expect(holding.averageCostPrice).toBe(150);
    expect(holding.totalInvested).toBe(2250);
    expect(holding.currentValue).toBe(2250);
    expect(holding.unrealisedPnL).toBe(0);
  });

  it("returns an empty holding for fully sold positions", () => {
    const holding = calculateHolding({
      asset: reliance,
      currentPrice: 150,
      trades: [
        trade({ pricePerUnit: 100, quantity: 4, totalValue: 400 }),
        trade({
          pricePerUnit: 120,
          quantity: 4,
          totalValue: 480,
          type: "sell",
        }),
      ],
    });

    expect(holding.totalUnits).toBe(0);
    expect(holding.totalInvested).toBe(0);
    expect(holding.currentValue).toBe(0);
    expect(holding.unrealisedPnLPct).toBe(0);
  });

  it("derives holdings from assets, trades, and quote cache", () => {
    const quote: Quote = {
      assetId: reliance.id,
      asOf: "2026-04-26T00:00:00.000Z",
      currency: "INR",
      price: 125,
      source: "yahoo",
    };

    const holdings = calculateHoldings({
      assets: [reliance, bitcoin],
      quoteCache: { [reliance.id]: quote },
      trades: [trade({ assetId: reliance.id, quantity: 2, totalValue: 200 })],
    });

    expect(holdings).toHaveLength(1);
    expect(holdings[0]?.asset).toEqual(reliance);
    expect(holdings[0]?.currentPrice).toBe(125);
  });

  it("derives an Excel-style opening position without historical trades", () => {
    const holding = calculateHolding({
      asset: reliance,
      currentPrice: 1678.25,
      openingPositions: [openingPosition({})],
      trades: [],
    });

    expect(holding.totalUnits).toBe(25);
    expect(holding.averageCostPrice).toBe(1400);
    expect(holding.totalInvested).toBe(35000);
    expect(holding.currentValue).toBe(41956.25);
    expect(holding.unrealisedPnL).toBe(6956.25);
    expect(holding.unrealisedPnLPct).toBe(19.88);
  });

  it("uses opening-position manual price when quote cache is empty", () => {
    const holdings = calculateHoldings({
      assets: [reliance],
      openingPositions: [openingPosition({ currentPrice: 1600 })],
      quoteCache: {},
      trades: [],
    });

    expect(holdings).toHaveLength(1);
    expect(holdings[0]?.currentPrice).toBe(1600);
    expect(holdings[0]?.currentValue).toBe(40000);
  });

  it("lets quote cache override opening-position manual price", () => {
    const holdings = calculateHoldings({
      assets: [reliance],
      openingPositions: [openingPosition({ currentPrice: 1600 })],
      quoteCache: {
        [reliance.id]: {
          assetId: reliance.id,
          asOf: "2026-05-09T00:00:00.000Z",
          currency: "INR",
          price: 1700,
          source: "yahoo",
        },
      },
      trades: [],
    });

    expect(holdings[0]?.currentPrice).toBe(1700);
  });

  it("keeps opening-position cost basis stable after a later sell", () => {
    const holding = calculateHolding({
      asset: reliance,
      currentPrice: 1500,
      openingPositions: [openingPosition({ averageCostPrice: 1000, quantity: 10 })],
      trades: [
        trade({
          date: "2026-04-20T00:00:00.000Z",
          pricePerUnit: 1500,
          quantity: 4,
          totalValue: 6000,
          type: "sell",
        }),
      ],
    });

    expect(holding.totalUnits).toBe(6);
    expect(holding.averageCostPrice).toBe(1000);
    expect(holding.totalInvested).toBe(6000);
    expect(holding.currentValue).toBe(9000);
  });

  it("derives debt holdings from manual opening-position prices", () => {
    const holdings = calculateHoldings({
      assets: [ppf],
      openingPositions: [
        openingPosition({
          assetId: ppf.id,
          averageCostPrice: 1,
          currentPrice: 1.08,
          quantity: 150000,
        }),
      ],
      quoteCache: {},
      trades: [],
    });

    expect(holdings[0]).toMatchObject({
      asset: ppf,
      averageCostPrice: 1,
      currentPrice: 1.08,
      currentValue: 162000,
      totalInvested: 150000,
      totalUnits: 150000,
      unrealisedPnL: 12000,
    });
  });

  it("derives crypto holdings in INR from quote cache", () => {
    const holdings = calculateHoldings({
      assets: [bitcoin],
      openingPositions: [
        openingPosition({
          assetId: bitcoin.id,
          averageCostPrice: 5000000,
          currentPrice: 5700000,
          quantity: 0.05,
        }),
      ],
      quoteCache: {
        [bitcoin.id]: {
          assetId: bitcoin.id,
          asOf: "2026-05-10T00:00:00.000Z",
          currency: "INR",
          price: 5800000,
          source: "coingecko",
        },
      },
      trades: [],
    });

    expect(holdings[0]).toMatchObject({
      currentPrice: 5800000,
      currentValue: 290000,
      totalInvested: 250000,
      unrealisedPnL: 40000,
    });
  });

  it("excludes unsupported foreign assets from INR holdings", () => {
    const holdings = calculateHoldings({
      assets: [reliance, unsupportedForeignAsset],
      quoteCache: {
        [reliance.id]: {
          assetId: reliance.id,
          asOf: "2026-05-10T00:00:00.000Z",
          currency: "INR",
          price: 125,
          source: "yahoo",
        },
        [unsupportedForeignAsset.id]: {
          assetId: unsupportedForeignAsset.id,
          asOf: "2026-05-10T00:00:00.000Z",
          currency: "USD",
          price: 200,
          source: "yahoo",
        },
      },
      trades: [
        trade({ assetId: reliance.id }),
        trade({ assetId: unsupportedForeignAsset.id }),
      ],
    });

    expect(holdings).toHaveLength(1);
    expect(holdings[0]?.asset.id).toBe(reliance.id);
  });

  it("excludes INR assets whose stored quote is not INR", () => {
    const holdings = calculateHoldings({
      assets: [reliance],
      quoteCache: {
        [reliance.id]: {
          assetId: reliance.id,
          asOf: "2026-05-10T00:00:00.000Z",
          currency: "USD",
          price: 125,
          source: "yahoo",
        },
      },
      trades: [trade({ assetId: reliance.id })],
    });

    expect(holdings).toEqual([]);
  });
});

describe("portfolio calculations", () => {
  const cashEntries: CashEntry[] = [
    {
      amount: 10000,
      date: "2026-04-20T00:00:00.000Z",
      id: "cash-1",
      label: "Deposit",
      purpose: "capitalContribution",
      type: "addition",
    },
    {
      amount: 1500,
      date: "2026-04-21T00:00:00.000Z",
      id: "cash-2",
      label: "Withdraw",
      purpose: "withdrawal",
      type: "withdrawal",
    },
  ];

  it("calculates cash balance and portfolio total", () => {
    const holding = calculateHolding({
      asset: reliance,
      currentPrice: 120,
      trades: [trade({ quantity: 10, totalValue: 1000 })],
    });

    expect(calculateCashBalance(cashEntries)).toBe(8500);
    expect(calculatePortfolioTotal([holding], cashEntries)).toBe(9700);
  });

  it("conserves portfolio wealth across funded buys and sales before market movement", () => {
    const contribution: CashEntry = {
      amount: 100000,
      date: "2026-05-01T00:00:00.000Z",
      id: "cash-contribution",
      label: "Capital contribution",
      purpose: "capitalContribution",
      type: "addition",
    };
    const purchaseFunding: CashEntry = {
      amount: 80000,
      date: "2026-05-05T00:00:00.000Z",
      id: "cash-trade-buy",
      label: "Reliance Industries purchase",
      linkedTradeId: "trade-buy",
      purpose: "purchaseFunding",
      type: "withdrawal",
    };
    const buy = trade({
      date: "2026-05-05T00:00:00.000Z",
      id: "trade-buy",
      pricePerUnit: 100,
      quantity: 800,
      totalValue: 80000,
    });
    const holdingAfterBuy = calculateHolding({
      asset: reliance,
      currentPrice: 100,
      trades: [buy],
    });

    expect(
      calculatePortfolioTotal(
        [holdingAfterBuy],
        [contribution, purchaseFunding],
      ),
    ).toBe(100000);

    const saleProceeds: CashEntry = {
      amount: 22000,
      date: "2026-05-20T00:00:00.000Z",
      id: "cash-trade-sale",
      label: "Reliance Industries sale proceeds",
      linkedTradeId: "trade-sale",
      purpose: "saleProceeds",
      type: "addition",
    };
    const sale = trade({
      date: "2026-05-20T00:00:00.000Z",
      id: "trade-sale",
      pricePerUnit: 110,
      quantity: 200,
      totalValue: 22000,
      type: "sell",
    });
    const holdingAfterSale = calculateHolding({
      asset: reliance,
      currentPrice: 110,
      trades: [buy, sale],
    });

    expect(
      calculatePortfolioTotal(
        [holdingAfterSale],
        [contribution, purchaseFunding, saleProceeds],
      ),
    ).toBe(108000);
  });

  it("uses only typed income for the monthly investment rate", () => {
    const monthlyEntries: CashEntry[] = [
      {
        amount: 50000,
        date: "2026-05-01T00:00:00.000Z",
        id: "cash-income",
        label: "Salary",
        purpose: "income",
        type: "addition",
      },
      {
        amount: 25000,
        date: "2026-05-02T00:00:00.000Z",
        id: "cash-contribution",
        label: "Capital contribution",
        purpose: "capitalContribution",
        type: "addition",
      },
      {
        amount: 10000,
        date: "2026-05-03T00:00:00.000Z",
        id: "cash-trade-buy",
        label: "Funded purchase",
        linkedTradeId: "trade-buy",
        purpose: "purchaseFunding",
        type: "withdrawal",
      },
      {
        amount: 12000,
        date: "2026-05-04T00:00:00.000Z",
        id: "cash-trade-sale",
        label: "Sale proceeds",
        linkedTradeId: "trade-sale",
        purpose: "saleProceeds",
        type: "addition",
      },
    ];

    expect(
      calculateCashMonthlyMetrics({
        cashEntries: monthlyEntries,
        now: new Date("2026-05-20T00:00:00.000Z"),
        openingPositions: [],
        trades: [
          trade({
            date: "2026-05-03T00:00:00.000Z",
            id: "trade-buy",
            pricePerUnit: 1000,
            quantity: 10,
            totalValue: 10000,
          }),
        ],
      }),
    ).toEqual({
      added: 75000,
      available: 77000,
      contributions: 25000,
      income: 50000,
      incomeStatus: "available",
      investmentRate: 20,
      invested: 10000,
    });
  });

  it("marks income-based metrics unavailable when legacy additions are unclassified", () => {
    const metrics = calculateCashMonthlyMetrics({
      cashEntries: [
        {
          amount: 50000,
          date: "2026-05-01T00:00:00.000Z",
          id: "cash-income",
          label: "Salary",
          purpose: "income",
          type: "addition",
        },
        {
          amount: 4000,
          date: "2026-05-02T00:00:00.000Z",
          id: "cash-legacy",
          label: "Legacy addition",
          purpose: "legacyUncategorized",
          type: "addition",
        },
      ],
      now: new Date("2026-05-20T00:00:00.000Z"),
      openingPositions: [],
      trades: [],
    });

    expect(metrics).toMatchObject({
      income: 50000,
      incomeStatus: "unavailable",
      investmentRate: null,
    });
  });

  it("uses the trade date as the canonical month for linked purchase funding", () => {
    const linkedFunding: CashEntry = {
      amount: 10000,
      date: "2026-07-01T00:00:00.000Z",
      id: "cash-trade-buy",
      label: "Funded purchase",
      linkedTradeId: "trade-buy",
      purpose: "purchaseFunding",
      type: "withdrawal",
    };
    const juneBuy = trade({
      date: "2026-06-30T00:00:00.000Z",
      id: "trade-buy",
      pricePerUnit: 1000,
      quantity: 10,
      totalValue: 10000,
    });

    expect(
      calculateCashMonthlyMetrics({
        cashEntries: [linkedFunding],
        now: new Date("2026-07-20T00:00:00.000Z"),
        openingPositions: [],
        trades: [juneBuy],
      }).invested,
    ).toBe(0);
    expect(
      calculateCashMonthlyMetrics({
        cashEntries: [linkedFunding],
        now: new Date("2026-06-30T12:00:00.000Z"),
        openingPositions: [],
        trades: [juneBuy],
      }).invested,
    ).toBe(10000);
  });

  it("excludes invalid and future-effective records from current totals", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    const holdings = calculateHoldings({
      assets: [reliance],
      now,
      openingPositions: [
        openingPosition({ date: "2026-05-01", id: "opening-current" }),
        openingPosition({ date: "2026-05-21", id: "opening-future" }),
        openingPosition({ date: "2026-02-30", id: "opening-invalid" }),
      ],
      quoteCache: {
        [reliance.id]: {
          assetId: reliance.id,
          asOf: "2026-05-20T10:00:00.000Z",
          currency: "INR",
          price: 1600,
          source: "manual",
        },
      },
      trades: [
        trade({ date: "2026-05-10", id: "trade-current", quantity: 5 }),
        trade({ date: "2026-05-22", id: "trade-future", quantity: 50 }),
      ],
    });
    const cashEntries: CashEntry[] = [
      {
        amount: 1000,
        date: "2026-05-01",
        id: "cash-current",
        label: "Current cash",
        purpose: "capitalContribution",
        type: "addition",
      },
      {
        amount: 5000,
        date: "2026-05-21",
        id: "cash-future",
        label: "Future cash",
        purpose: "capitalContribution",
        type: "addition",
      },
      {
        amount: 7000,
        date: "2026-02-30",
        id: "cash-invalid",
        label: "Invalid cash",
        purpose: "capitalContribution",
        type: "addition",
      },
    ];

    expect(holdings).toHaveLength(1);
    expect(holdings[0].totalUnits).toBe(30);
    expect(calculateCashBalance(cashEntries, now)).toBe(1000);
    expect(calculatePortfolioTotal(holdings, cashEntries, now)).toBe(49000);
  });

  it("matches stored calendar dates against the device-local current month", () => {
    const now = new Date("2026-06-30T19:00:00.000Z");
    jest.spyOn(now, "getFullYear").mockReturnValue(2026);
    jest.spyOn(now, "getMonth").mockReturnValue(6);
    jest.spyOn(now, "getUTCFullYear").mockReturnValue(2026);
    jest.spyOn(now, "getUTCMonth").mockReturnValue(5);
    const metrics = calculateCashMonthlyMetrics({
      cashEntries: [
        {
          amount: 50000,
          date: "2026-07-01T00:00:00.000Z",
          id: "cash-income",
          label: "Salary",
          purpose: "income",
          type: "addition",
        },
      ],
      now,
      openingPositions: [],
      trades: [],
    });

    expect(metrics.income).toBe(50000);
    expect(metrics.incomeStatus).toBe("available");
  });

  it("calculates day change from holding values and quote change", () => {
    const holding = calculateHolding({
      asset: reliance,
      currentPrice: 120,
      trades: [trade({ quantity: 10, totalValue: 1000 })],
    });

    expect(calculatePortfolioDayChange([holding])).toEqual({
      absolute: 0,
      percentage: 0,
    });

    const changedHolding = {
      ...holding,
      dayChangePct: 20,
    };

    expect(calculatePortfolioDayChange([changedHolding])).toEqual({
      absolute: 200,
      percentage: 20,
    });

    expect(
      calculatePortfolioDayChange([{ ...holding, dayChangePct: -100 }]),
    ).toEqual({
      absolute: 0,
      percentage: 0,
    });
  });

  it("groups allocation by asset class including cash", () => {
    const stockHolding = calculateHolding({
      asset: reliance,
      currentPrice: 120,
      trades: [trade({ quantity: 10, totalValue: 1000 })],
    });
    const cryptoHolding = calculateHolding({
      asset: bitcoin,
      currentPrice: 50000,
      trades: [
        trade({
          assetId: bitcoin.id,
          pricePerUnit: 50000,
          quantity: 0.1,
          totalValue: 5000,
        }),
      ],
    });
    const debtHolding = calculateHolding({
      asset: ppf,
      currentPrice: 1,
      openingPositions: [
        openingPosition({
          assetId: ppf.id,
          averageCostPrice: 1,
          quantity: 3800,
        }),
      ],
      trades: [],
    });

    const allocation = calculateAllocation({
      cashBalance: 3800,
      holdings: [stockHolding, cryptoHolding, debtHolding],
    });

    expect(allocation).toEqual([
      { assetClass: "crypto", percentage: 36.23, value: 5000 },
      { assetClass: "debt", percentage: 27.54, value: 3800 },
      { assetClass: "cash", percentage: 27.54, value: 3800 },
      { assetClass: "stock", percentage: 8.7, value: 1200 },
    ]);
  });

  it("keeps negative cash visible and reconciles allocation to net portfolio value", () => {
    const stockHolding = calculateHolding({
      asset: reliance,
      currentPrice: 120,
      trades: [trade({ quantity: 10, totalValue: 1000 })],
    });

    const allocation = calculateAllocation({
      cashBalance: -200,
      holdings: [stockHolding],
    });
    const rows = calculateConsolidatedHoldingRows([stockHolding]);
    const totals = calculatePortfolioRollupTotals(rows, -200);

    expect(allocation).toEqual([
      { assetClass: "stock", percentage: 120, value: 1200 },
      { assetClass: "cash", percentage: -20, value: -200 },
    ]);
    expect(
      allocation.reduce((total, item) => total + item.value, 0),
    ).toBe(totals.totalCurrentValue);
    expect(
      allocation.reduce(
        (total, item) => total + (item.percentage ?? 0),
        0,
      ),
    ).toBe(100);
  });

  it.each([
    {
      cashBalance: 0,
      expected: [{ assetClass: "stock", percentage: 100, value: 1200 }],
      netValue: 1200,
    },
    {
      cashBalance: -1200,
      expected: [
        { assetClass: "stock", percentage: null, value: 1200 },
        { assetClass: "cash", percentage: null, value: -1200 },
      ],
      netValue: 0,
    },
    {
      cashBalance: -1500,
      expected: [
        { assetClass: "stock", percentage: null, value: 1200 },
        { assetClass: "cash", percentage: null, value: -1500 },
      ],
      netValue: -300,
    },
  ])(
    "keeps $cashBalance cash mathematically explainable",
    ({ cashBalance, expected, netValue }) => {
      const stockHolding = calculateHolding({
        asset: reliance,
        currentPrice: 120,
        trades: [trade({ quantity: 10, totalValue: 1000 })],
      });
      const allocation = calculateAllocation({
        cashBalance,
        holdings: [stockHolding],
      });

      expect(allocation).toEqual(expected);
      expect(
        allocation.reduce((total, item) => total + item.value, 0),
      ).toBe(netValue);
    },
  );

  it("keeps a cash-only liability visible without inventing a percentage", () => {
    expect(
      calculateAllocation({
        cashBalance: -500,
        holdings: [],
      }),
    ).toEqual([
      { assetClass: "cash", percentage: null, value: -500 },
    ]);
  });

  it("derives instrument and sector allocation from asset metadata", () => {
    const stockHolding = calculateHolding({
      asset: reliance,
      currentPrice: 120,
      trades: [trade({ quantity: 10, totalValue: 1000 })],
    });
    const cryptoHolding = calculateHolding({
      asset: bitcoin,
      currentPrice: 50000,
      trades: [
        trade({
          assetId: bitcoin.id,
          pricePerUnit: 50000,
          quantity: 0.1,
          totalValue: 5000,
        }),
      ],
    });

    expect(calculateInstrumentAllocation([stockHolding, cryptoHolding])).toEqual([
      { label: "crypto", percentage: 80.65, value: 5000 },
      { label: "stock", percentage: 19.35, value: 1200 },
    ]);
    expect(calculateSectorAllocation([stockHolding, cryptoHolding])).toEqual([
      { label: "digitalAsset", percentage: 80.65, value: 5000 },
      { label: "energy", percentage: 19.35, value: 1200 },
    ]);
  });

  it("derives consolidated rows and rollup totals without persisting them", () => {
    const stockHolding = calculateHolding({
      asset: reliance,
      currentPrice: 120,
      trades: [trade({ quantity: 10, totalValue: 1000 })],
    });
    const debtHolding = calculateHolding({
      asset: ppf,
      currentPrice: 1000,
      openingPositions: [
        openingPosition({
          assetId: ppf.id,
          averageCostPrice: 950,
          quantity: 2,
        }),
      ],
      trades: [],
    });

    const rows = calculateConsolidatedHoldingRows([stockHolding, debtHolding]);

    expect(rows).toEqual([
      {
        asset: ppf,
        assetClass: "debt",
        currentAllocationPct: 62.5,
        currentValue: 2000,
        initialAllocationPct: 65.52,
        instrumentType: "ppf",
        investedValue: 1900,
        pnl: 100,
        pnlPct: 5.26,
        sectorType: "fixedIncome",
        units: 2,
      },
      {
        asset: reliance,
        assetClass: "stock",
        currentAllocationPct: 37.5,
        currentValue: 1200,
        initialAllocationPct: 34.48,
        instrumentType: "stock",
        investedValue: 1000,
        pnl: 200,
        pnlPct: 20,
        sectorType: "energy",
        units: 10,
      },
    ]);
    expect(calculatePortfolioRollupTotals(rows, 300)).toEqual({
      cashBalance: 300,
      holdingsCurrentValue: 3200,
      pnl: 300,
      pnlPct: 10.34,
      totalCurrentValue: 3500,
      totalInvested: 2900,
      valuationCoverage: {
        pendingAssetIds: [],
        pendingHoldings: 0,
        pendingInvestedValue: 0,
        status: "complete",
        totalHoldings: 2,
        valuedHoldings: 2,
      },
      valuedHoldingsSubtotal: 3200,
    });
  });

  it("aggregates precise holding values before rounding portfolio outputs", () => {
    const firstAsset = { ...reliance, id: "asset-first", ticker: "FIRST.NS" };
    const secondAsset = { ...reliance, id: "asset-second", ticker: "SECOND.NS" };
    const holdings = [firstAsset, secondAsset].map((asset) =>
      calculateHolding({
        asset,
        currentPrice: 1,
        openingPositions: [
          openingPosition({
            assetId: asset.id,
            averageCostPrice: 1,
            quantity: 0.005,
          }),
        ],
        trades: [],
      }),
    );
    const rows = calculateConsolidatedHoldingRows(holdings);

    expect(holdings.map((holding) => holding.currentValue)).toEqual([0.01, 0.01]);
    expect(calculatePortfolioTotal(holdings, [])).toBe(0.01);
    expect(
      calculatePortfolioTotal(holdings.slice(0, 1), [
        {
          amount: 0.005,
          date: "2026-04-20T00:00:00.000Z",
          id: "legacy-sub-cent-cash",
          label: "Legacy cash",
          purpose: "capitalContribution",
          type: "addition",
        },
      ]),
    ).toBe(0.01);
    expect(calculateAllocation({ cashBalance: 0, holdings })).toEqual([
      { assetClass: "stock", percentage: 100, value: 0.01 },
    ]);
    expect(calculatePortfolioRollupTotals(rows, 0, holdings)).toEqual({
      cashBalance: 0,
      holdingsCurrentValue: 0.01,
      pnl: 0,
      pnlPct: 0,
      totalCurrentValue: 0.01,
      totalInvested: 0.01,
      valuationCoverage: {
        pendingAssetIds: [],
        pendingHoldings: 0,
        pendingInvestedValue: 0,
        status: "complete",
        totalHoldings: 2,
        valuedHoldings: 2,
      },
      valuedHoldingsSubtotal: 0.01,
    });
  });

  it("derives monthly progression summaries from persisted snapshots", () => {
    const snapshots: MonthlySnapshot[] = [
      {
        cashValue: 120000,
        cryptoValue: 40000,
        debtValue: 300000,
        equityValue: 800000,
        id: "snapshot-2026-04",
        investedValue: 1000000,
        month: "2026-04",
        monthlyExpense: 30000,
        monthlyInvestment: 50000,
        notes: "April close",
        portfolioValue: 1260000,
        salary: 150000,
      },
      {
        cashValue: 140000,
        cryptoValue: 45000,
        debtValue: 320000,
        equityValue: 880000,
        id: "snapshot-2026-05",
        investedValue: 1060000,
        month: "2026-05",
        monthlyExpense: 40000,
        monthlyInvestment: 60000,
        performanceBasis: {
          netExternalFlow: 60000,
          status: "complete",
          warnings: [],
          weightedExternalFlow: 60000,
        },
        portfolioValue: 1385000,
        salary: 160000,
      },
    ];

    expect(calculateMonthlyProgressSummaries(snapshots)).toEqual([
      {
        assetSnapshot: [
          { assetClass: "stock", percentage: 63.54, value: 880000 },
          { assetClass: "debt", percentage: 23.1, value: 320000 },
          { assetClass: "cash", percentage: 10.11, value: 140000 },
          { assetClass: "crypto", percentage: 3.25, value: 45000 },
        ],
        expenseRate: 25,
        performance: {
          denominator: 1320000,
          marketMovement: 65000,
          marketMovementPct: 4.92,
          netExternalFlow: 60000,
          reason: null,
          status: "available",
          totalValueChange: 125000,
        },
        savingsRate: 37.5,
        snapshot: snapshots[1],
      },
      {
        assetSnapshot: [
          { assetClass: "stock", percentage: 63.49, value: 800000 },
          { assetClass: "debt", percentage: 23.81, value: 300000 },
          { assetClass: "cash", percentage: 9.52, value: 120000 },
          { assetClass: "crypto", percentage: 3.17, value: 40000 },
        ],
        expenseRate: 20,
        performance: {
          denominator: null,
          marketMovement: null,
          marketMovementPct: null,
          netExternalFlow: null,
          reason: "missing-previous-snapshot",
          status: "unavailable",
          totalValueChange: null,
        },
        savingsRate: 33.33,
        snapshot: snapshots[0],
      },
    ]);
  });

  it("keeps salary-dependent rates unavailable when snapshot income is unknown", () => {
    const snapshot: MonthlySnapshot = {
      cashValue: 200,
      cryptoValue: 0,
      debtValue: 0,
      equityValue: 800,
      id: "snapshot-unknown-income",
      investedValue: 800,
      month: "2026-06",
      monthlyExpense: 300,
      monthlyInvestment: 100,
      portfolioValue: 1000,
    };

    expect(calculateMonthlyProgressSummaries([snapshot])[0]).toMatchObject({
      expenseRate: null,
      savingsRate: null,
    });
  });
});

describe("date and conviction calculations", () => {
  it("calculates days held between two ISO dates", () => {
    expect(
      daysHeld("2026-04-20T00:00:00.000Z", "2026-04-26T00:00:00.000Z"),
    ).toBe(6);
  });

  it("reports conviction readiness from rated trades", () => {
    expect(
      getConvictionReadiness([
        trade({ conviction: 5 }),
        trade({ conviction: 2 }),
        trade({ conviction: undefined }),
      ]),
    ).toEqual({
      highConvictionCount: 1,
      isReady: false,
      lowConvictionCount: 1,
      ratedTradeCount: 2,
      requiredTradeCount: 5,
    });
  });

  it("includes opening-position conviction in readiness", () => {
    expect(
      getConvictionReadiness(
        [trade({ conviction: 2 })],
        2,
        [openingPosition({ conviction: 5 })],
      ),
    ).toEqual({
      highConvictionCount: 1,
      isReady: true,
      lowConvictionCount: 1,
      ratedTradeCount: 2,
      requiredTradeCount: 2,
    });
  });
});
