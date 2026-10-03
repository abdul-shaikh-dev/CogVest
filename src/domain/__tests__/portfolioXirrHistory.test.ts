import { auditPortfolioXirrHistory, type PortfolioXirrHistoryInput } from "../portfolioXirrHistory";
import type { BuyTrade, CashEntry, SellTrade } from "@/src/types";

const buy: BuyTrade = { id: "buy", assetId: "stock", type: "buy", date: "2025-01-02", quantity: 10, pricePerUnit: 99, fees: 10, totalValue: 1000 };
const sell: SellTrade = { ...buy, id: "sell", type: "sell", date: "2025-06-01", pricePerUnit: 111, totalValue: 1100 };
const deposit: CashEntry = { id: "deposit", type: "addition", purpose: "capitalContribution", date: "2025-01-01", amount: 1000, label: "Capital" };
const funding: CashEntry = { id: "funding", type: "withdrawal", purpose: "purchaseFunding", date: buy.date, amount: 1000, label: "Buy", linkedTradeId: buy.id };
const proceeds: CashEntry = { id: "proceeds", type: "addition", purpose: "saleProceeds", date: sell.date, amount: 1100, label: "Sell", linkedTradeId: sell.id };
const withdrawal: CashEntry = { id: "withdrawal", type: "withdrawal", purpose: "withdrawal", date: "2025-07-01", amount: 500, label: "Withdrawal" };

function input(overrides: Partial<PortfolioXirrHistoryInput> = {}): PortfolioXirrHistoryInput {
  return {
    asOf: "2026-01-01",
    assets: [{ id: "stock", name: "Synthetic", symbol: "TEST", ticker: "TEST.NS", currency: "INR", assetClass: "stock" }],
    cashEntries: [], trades: [], openingPositions: [], ppfAccounts: [], ppfLedgerEntries: [], futuresAccounts: [],
    ...overrides,
  };
}

describe("whole-portfolio XIRR history preflight", () => {
  it("does not claim that apparently consistent records prove complete history", () => {
    const result = auditPortfolioXirrHistory(input({ cashEntries: [withdrawal, proceeds, funding, deposit], trades: [buy, sell] }));
    expect(result.status).toBe("needs-evidence");
    expect(result.gaps).toEqual([{ source: "portfolio", id: "portfolio", reason: "history-not-confirmed" }]);
    expect(result.recordedExternalCashFlows.map(({ amountInr, date }) => ({ amountInr, date }))).toEqual([
      { amountInr: "-1000", date: "2025-01-01" }, { amountInr: "500", date: "2025-07-01" },
    ]);
    expect(result.internalTradePairs).toEqual([{ cashId: "proceeds", tradeId: "sell" }, { cashId: "funding", tradeId: "buy" }]);
  });

  it("never fabricates cash from an imported execution or transfer cost basis", () => {
    const result = auditPortfolioXirrHistory(input({ trades: [
      { ...buy, importProvenance: { importBatchId: "batch", originalRowNumber: 1, sourceFormat: "zerodha", sourceVersion: "1", fees: 10 } },
      { id: "transfer", assetId: "stock", date: buy.date, quantity: 10, acquisitionCostPerUnit: 100, type: "transferIn" },
    ] }));
    expect(result.recordedExternalCashFlows).toEqual([]);
    expect(result.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "buy", reason: "unlinked-trade" }),
      expect.objectContaining({ id: "transfer", reason: "asset-transfer-boundary" }),
    ]));
  });

  it.each([
    { ...funding, amount: 990 },
    { ...funding, date: "2025-01-03" },
    { ...funding, type: "addition" as const },
    { ...funding, linkedTradeId: "missing" },
    { ...funding, linkedFutures: { accountId: "wallet", eventId: "transfer" } },
  ])("rejects inconsistent trade linkage %#", (entry) => {
    const result = auditPortfolioXirrHistory(input({ cashEntries: [entry], trades: [buy] }));
    expect(result.internalTradePairs).toEqual([]);
    expect(result.gaps).toContainEqual({ source: "cash", id: entry.id, reason: "unmatched-trade-cash" });
  });

  it("does not accept two cash legs for one trade", () => {
    const result = auditPortfolioXirrHistory(input({ trades: [buy], cashEntries: [funding, { ...funding, id: "second" }] }));
    expect(result.internalTradePairs).toEqual([]);
    expect(result.recordedExternalCashFlows).toEqual([]);
  });

  it("withholds duplicate record IDs rather than silently choosing or double counting", () => {
    const result = auditPortfolioXirrHistory(input({ cashEntries: [deposit, { ...deposit, amount: 9000 }, funding], trades: [buy, buy] }));
    expect(result.recordedExternalCashFlows).toEqual([]);
    expect(result.internalTradePairs).toEqual([]);
    expect(result.gaps).toEqual(expect.arrayContaining([
      { source: "cash", id: "deposit", reason: "duplicate-id" },
      { source: "trade", id: "buy", reason: "duplicate-id" },
    ]));
  });

  it.each([NaN, Infinity, -1, 0])("withholds invalid cash amount %s", (amount) => {
    const result = auditPortfolioXirrHistory(input({ cashEntries: [{ ...deposit, amount }] }));
    expect(result.recordedExternalCashFlows).toEqual([]);
    expect(result.gaps).toContainEqual({ source: "cash", id: "deposit", reason: "invalid-amount" });
  });

  it("uses calendar dates, ignores future flows and flags invalid dates", () => {
    const result = auditPortfolioXirrHistory(input({ cashEntries: [
      { ...deposit, date: "2025-01-01T00:00:00+05:30" },
      { ...deposit, id: "future", date: "2027-01-01" },
      { ...deposit, id: "invalid", date: "2025-02-30" },
    ] }));
    expect(result.recordedExternalCashFlows).toHaveLength(1);
    expect(result.recordedExternalCashFlows[0].date).toBe("2025-01-01");
    expect(result.gaps).toContainEqual({ source: "cash", id: "invalid", reason: "invalid-date" });
    expect(auditPortfolioXirrHistory(input({ asOf: "2026-02-30", cashEntries: [deposit] })).recordedExternalCashFlows).toEqual([]);
  });

  it("does not label a linked or uncategorized deposit external", () => {
    const result = auditPortfolioXirrHistory(input({ cashEntries: [
      { ...deposit, purpose: "legacyUncategorized" },
      { ...deposit, id: "linked", linkedTradeId: buy.id },
    ] }));
    expect(result.recordedExternalCashFlows).toEqual([]);
    expect(result.gaps.filter(({ reason }) => reason === "ambiguous-cash")).toHaveLength(2);
  });

  it("flags foreign or missing assets without treating native totals as INR", () => {
    const result = auditPortfolioXirrHistory(input({ assets: [{ ...input().assets[0], currency: "USD" }], trades: [buy, { ...sell, assetId: "missing" }], cashEntries: [funding] }));
    expect(result.internalTradePairs).toEqual([]);
    expect(result.gaps).toEqual(expect.arrayContaining([
      { source: "trade", id: "buy", reason: "foreign-currency" },
      { source: "trade", id: "sell", reason: "missing-asset" },
    ]));
  });

  it("does not turn aggregate openings, PPF or Futures balances into contributions", () => {
    const result = auditPortfolioXirrHistory(input({
      openingPositions: [{ id: "opening", assetId: "stock", quantity: 20, averageCostPrice: 100, date: "2020-01-01", measuredAsOf: "2025-01-01" }],
      ppfAccounts: [{ id: "ppf", nickname: "PPF", provider: "Bank", opening: { kind: "date", openedOn: "2020-01-01" }, balanceAsOf: "2025-01-01", confirmedBalance: 10000, createdAt: "2025-01-01", status: "active" }],
      ppfLedgerEntries: [{ id: "ppf-entry", accountId: "ppf", type: "contribution", date: "2025-01-02", recordedAt: "2025-01-02", amount: 1000 }],
      futuresAccounts: [{ id: "futures", settlementAsset: "USDT", marginMode: "cross", positionMode: "one-way", openingAt: "2025-01-01T00:00:00Z", openingWalletUsdt: "1000", events: [] }],
      cashEntries: [{ ...funding, linkedTradeId: undefined, purpose: "futuresTransfer", linkedFutures: { accountId: "futures", eventId: "transfer" } }],
    }));
    expect(result.recordedExternalCashFlows).toEqual([]);
    expect(result.gaps.map(({ reason }) => reason)).toEqual(expect.arrayContaining(["opening-history", "ppf-history-and-boundary", "futures-history-and-boundary"]));
  });

  it("retains decimal facts and leaves the caller's records unchanged", () => {
    const records = input({ cashEntries: [{ ...deposit, amount: 1234.56 }, withdrawal], trades: [buy] });
    const before = JSON.stringify(records);
    expect(auditPortfolioXirrHistory(records).recordedExternalCashFlows[0].amountInr).toBe("-1234.56");
    expect(JSON.stringify(records)).toBe(before);
  });
});
