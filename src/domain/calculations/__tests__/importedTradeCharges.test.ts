import { calculateHolding, calculateRecordedSaleGains } from "@/src/domain/calculations/holdings";
import { normalizeTrade } from "@/src/domain/financialRecords";
import { reconcileTransactions } from "@/src/domain/transactionReconciliation";
import { getTradeNetAmount } from "@/src/domain/transactionSemantics";
import { tradeFlow } from "@/src/domain/xirrInputs";
import type { Asset, BuyTrade, ImportedTransactionProvenance, SellTrade } from "@/src/types";

// Imported trades keep a gross total and their charges in provenance (#649).
const now = new Date("2026-06-30T12:00:00Z");
const asset: Asset = { assetClass: "stock", currency: "INR", exchange: "NSE", id: "stock", name: "Synthetic",
  symbol: "SYN", ticker: "SYN.NS" };
const charges = (row: number): ImportedTransactionProvenance => ({
  fees: 100, importBatchId: "batch", originalRowNumber: row, sourceFormat: "zerodha-tradebook", sourceVersion: "1", taxes: 50,
});
// Built the way the importer builds them: totalValue = quantity × price.
const importedBuy = normalizeTrade<BuyTrade>({ assetId: "stock", date: "2026-01-10", id: "buy", importProvenance: charges(1),
  pricePerUnit: 100, quantity: 100, totalValue: 10000, type: "buy" });
const importedSale = normalizeTrade<SellTrade>({ assetId: "stock", date: "2026-03-10", id: "sale", importProvenance: charges(2),
  pricePerUnit: 110, quantity: 100, totalValue: 11000, type: "sell" });

describe("imported trade charges (#649)", () => {
  it("puts imported charges into the holding's average cost", () => {
    const holding = calculateHolding({ asset, currentPrice: 100, openingPositions: [], trades: [importedBuy] });

    expect(holding.averageCostPrice).toBe(101.5);
    expect(holding.totalInvested).toBe(10150);
  });

  it("reports realised gain net of every charge, matching the XIRR flows", () => {
    // Bought for 10,000 + 150; sold for 11,000 − 150.
    expect(calculateRecordedSaleGains({ assets: [asset], openingPositions: [], trades: [importedBuy, importedSale], now }))
      .toEqual({ sale: 700 });
    expect(tradeFlow(importedBuy).toNumber()).toBe(-10150);
    expect(tradeFlow(importedSale).toNumber()).toBe(10850);
    expect(tradeFlow(importedSale).plus(tradeFlow(importedBuy)).toNumber()).toBe(700);
  });

  it("keeps import reconciliation on the charge-free price that broker baselines use", () => {
    const reconciliation = reconcileTransactions({ through: "2026-06-30", transactions: [importedBuy] });

    expect(reconciliation.averageCostPrice).toBe(100);
  });
});

describe("manually entered fees (regression)", () => {
  // A manual trade's fees are inside its totalValue, and it has no provenance.
  const manualBuy = normalizeTrade<BuyTrade>({ assetId: "stock", date: "2026-01-10", fees: 150, id: "buy",
    pricePerUnit: 100, quantity: 100, totalValue: 0, type: "buy" });
  const manualSale = normalizeTrade<SellTrade>({ assetId: "stock", date: "2026-03-10", fees: 150, id: "sale",
    pricePerUnit: 110, quantity: 100, totalValue: 0, type: "sell" });

  it("are counted once in cost, gain and XIRR", () => {
    expect(manualBuy.totalValue).toBe(10150);
    expect(manualSale.totalValue).toBe(10850);
    expect(getTradeNetAmount(manualBuy).toNumber()).toBe(10150);
    expect(getTradeNetAmount(manualSale).toNumber()).toBe(10850);
    expect(calculateHolding({ asset, currentPrice: 100, openingPositions: [], trades: [manualBuy] }).averageCostPrice)
      .toBe(101.5);
    expect(calculateRecordedSaleGains({ assets: [asset], openingPositions: [], trades: [manualBuy, manualSale], now }))
      .toEqual({ sale: 700 });
  });

  it("still reconcile with their fees, as before", () => {
    expect(reconcileTransactions({ through: "2026-06-30", transactions: [manualBuy] }).averageCostPrice).toBe(101.5);
  });
});
