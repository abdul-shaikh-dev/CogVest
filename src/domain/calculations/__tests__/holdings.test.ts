import {
  calculateAllocation,
  calculateCashBalance,
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
  currency: "USD",
  id: "asset-btc",
  instrumentType: "crypto",
  name: "Bitcoin",
  sectorType: "digitalAsset",
  symbol: "BTC",
  ticker: "bitcoin",
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
    expect(holding.unrealisedPnLPct).toBeCloseTo(19.875, 3);
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
});

describe("portfolio calculations", () => {
  const cashEntries: CashEntry[] = [
    {
      amount: 10000,
      date: "2026-04-20T00:00:00.000Z",
      id: "cash-1",
      label: "Deposit",
      type: "addition",
    },
    {
      amount: 1500,
      date: "2026-04-21T00:00:00.000Z",
      id: "cash-2",
      label: "Withdraw",
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
        monthlyGain: 125000,
        monthlyGainPct: 9.92,
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
        monthlyGain: 0,
        monthlyGainPct: 0,
        savingsRate: 33.33,
        snapshot: snapshots[0],
      },
    ]);
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
