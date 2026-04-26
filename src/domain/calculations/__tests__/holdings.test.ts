import {
  calculateAllocation,
  calculateCashBalance,
  calculateHolding,
  calculateHoldings,
  calculatePortfolioDayChange,
  calculatePortfolioTotal,
  daysHeld,
  getConvictionReadiness,
} from "@/src/domain/calculations";
import type { Asset, CashEntry, Quote, Trade } from "@/src/types";

const reliance: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const bitcoin: Asset = {
  assetClass: "crypto",
  currency: "USD",
  id: "asset-btc",
  name: "Bitcoin",
  symbol: "BTC",
  ticker: "bitcoin",
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

    const allocation = calculateAllocation({
      cashBalance: 3800,
      holdings: [stockHolding, cryptoHolding],
    });

    expect(allocation).toEqual([
      { assetClass: "crypto", percentage: 50, value: 5000 },
      { assetClass: "cash", percentage: 38, value: 3800 },
      { assetClass: "stock", percentage: 12, value: 1200 },
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
});
