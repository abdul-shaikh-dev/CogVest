import {
  calculateMonthlyInvestmentMetrics,
  combineFuturesWithRollupTotals,
  type FuturesContribution,
  type PortfolioRollupTotals,
} from "@/src/domain/calculations";
import { monthToDateCashPurchases } from "@/src/domain/calculations/holdings";
import { emptyEpfState } from "@/src/domain/epf/persistence";
import type { CashEntry, OpeningPosition, PpfLedgerEntry, Trade } from "@/src/types";

const now = new Date("2026-05-20T12:00:00");
const buy = (id: string, assetId: string, date: string, totalValue: number): Trade => ({
  assetId, date, id, pricePerUnit: totalValue, quantity: 1, totalValue, type: "buy",
});
const opening = (assetId: string, date: string | null, quantity = 2, averageCostPrice = 50): OpeningPosition => ({
  assetId, averageCostPrice, date, id: `opening-${assetId}`, measuredAsOf: date ?? undefined, quantity,
} as OpeningPosition);
const cash = (id: string, type: CashEntry["type"], date: string, amount: number): CashEntry => ({
  amount, date, id, label: "Synthetic", purpose: type === "addition" ? "capitalContribution" : "manualWithdrawal", type,
} as CashEntry);

describe("monthToDateCashPurchases (#663)", () => {
  it("keeps this month's buys up to today that fall after their holding's opening cutover", () => {
    const trades = [
      buy("in-month", "alpha", "2026-05-02", 100),
      buy("future", "alpha", "2026-05-25", 100),
      buy("last-month", "alpha", "2026-04-30", 100),
      buy("before-cutover", "beta", "2026-05-03", 100),
      { ...buy("sell", "alpha", "2026-05-04", 100), type: "sell" } as Trade,
    ];
    const openings = [opening("beta", "2026-05-10")];

    expect(monthToDateCashPurchases(trades, openings, now).map((trade) => trade.id)).toEqual(["in-month"]);
  });
});

describe("calculateMonthlyInvestmentMetrics (#663)", () => {
  it("adds supported buys, openings and PPF contributions, and nets cash", () => {
    const ppf = [
      { accountId: "ppf", amount: 500, date: "2026-05-05", id: "ppf-1", type: "contribution" },
      { accountId: "ppf", amount: 900, date: "2026-04-05", id: "ppf-2", type: "contribution" },
    ] as PpfLedgerEntry[];

    expect(calculateMonthlyInvestmentMetrics({
      cashEntries: [
        cash("add", "addition", "2026-05-01", 1_000),
        cash("out", "withdrawal", "2026-05-02", 300),
        cash("later", "addition", "2026-05-30", 9_999),
      ],
      epf: emptyEpfState(),
      now,
      openingPositions: [opening("alpha", "2026-05-01"), opening("unsupported", "2026-05-01"), opening("gamma", null)],
      ppfLedgerEntries: ppf,
      supportedAssetIds: new Set(["alpha", "gamma"]),
      trades: [buy("t1", "alpha", "2026-05-03", 250), buy("t2", "unsupported", "2026-05-03", 7_000)],
    })).toEqual({ cashAdded: 1_000, cashChange: 700, investment: 250 + 100 + 500 });
  });
});

describe("combineFuturesWithRollupTotals (#663)", () => {
  const spot: PortfolioRollupTotals = {
    cashBalance: 0,
    holdingsCurrentValue: 1_100,
    pnl: 100,
    pnlPct: 10,
    totalCurrentValue: 1_100,
    totalInvested: 1_000,
    valuationCoverage: {
      pendingAssetIds: [], pendingHoldings: 0, pendingInvestedValue: 0, status: "complete", totalHoldings: 1, valuedHoldings: 1,
    },
    valuedHoldingsSubtotal: 1_100,
  };
  const futures = (status: "ready" | "pending"): FuturesContribution => ({
    accountId: "futures", equityInr: status === "ready" ? "600" : null, fxPnlInr: null,
    investedInr: "500", pnlInr: null, reason: "", status, tradingPnlInr: null,
  });

  it("adds valued futures to value, invested and P&L", () => {
    expect(combineFuturesWithRollupTotals(spot, [futures("ready")])).toMatchObject({
      futuresEquityInr: 600,
      totals: {
        holdingsCurrentValue: 1_700, pnl: 200, pnlPct: 13.33, totalCurrentValue: 1_700, totalInvested: 1_500,
        valuationCoverage: { status: "complete", totalHoldings: 2, valuedHoldings: 2 },
        valuedHoldingsSubtotal: 1_700,
      },
    });
  });

  it("leaves value and P&L unknown while a futures account is unvalued", () => {
    expect(combineFuturesWithRollupTotals(spot, [futures("pending")])).toMatchObject({
      futuresEquityInr: null,
      totals: {
        holdingsCurrentValue: null, pnl: null, pnlPct: null, totalCurrentValue: null, totalInvested: 1_500,
        valuationCoverage: { pendingAssetIds: ["futures"], pendingHoldings: 1, status: "incomplete", totalHoldings: 2, valuedHoldings: 1 },
      },
    });
  });

  it("returns the spot totals unchanged without futures", () => {
    expect(combineFuturesWithRollupTotals(spot, [])).toEqual({ futuresEquityInr: 0, totals: spot });
  });
});
