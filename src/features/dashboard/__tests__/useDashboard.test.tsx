import { renderHook } from "@testing-library/react-native";

import { useDashboard } from "@/src/features/dashboard/useDashboard";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Trade } from "@/src/types";

const stockAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const etfAsset: Asset = {
  assetClass: "etf",
  currency: "INR",
  exchange: "NSE",
  id: "asset-niftybees",
  name: "Nippon India Nifty 50 BeES",
  symbol: "NIFTYBEES",
  ticker: "NIFTYBEES.NS",
};

const buyStock: Trade = {
  assetId: stockAsset.id,
  conviction: 4,
  date: "2026-04-20",
  id: "trade-stock",
  pricePerUnit: 100,
  quantity: 2,
  totalValue: 200,
  type: "buy",
};

const buyEtf: Trade = {
  assetId: etfAsset.id,
  date: "2026-04-21",
  id: "trade-etf",
  pricePerUnit: 50,
  quantity: 2,
  totalValue: 100,
  type: "buy",
};

describe("useDashboard", () => {
  it("derives total, allocation, day change, quote freshness, and conviction readiness", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(stockAsset);
    store.getState().addAsset(etfAsset);
    store.getState().addTrade(buyStock);
    store.getState().addTrade(buyEtf);
    store.getState().addCashEntry({
      amount: 50,
      date: "2026-04-22",
      id: "cash-1",
      label: "Broker cash",
      type: "addition",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: stockAsset.id,
      currency: "INR",
      dayChangePct: 10,
      price: 150,
      source: "yahoo",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-21T10:00:00.000Z",
      assetId: etfAsset.id,
      currency: "INR",
      dayChangePct: -5,
      price: 100,
      source: "yahoo",
    });

    const { result } = renderHook(() => useDashboard({ store }));

    expect(result.current.totalValue).toBe(550);
    expect(result.current.rollupTotals).toEqual({
      cashBalance: 50,
      holdingsCurrentValue: 500,
      pnl: 200,
      pnlPct: 66.67,
      totalCurrentValue: 550,
      totalInvested: 300,
    });
    expect(result.current.cashBalance).toBe(50);
    expect(result.current.dayChange).toEqual({
      absolute: 16.75,
      percentage: 3.47,
    });
    expect(result.current.latestQuoteAsOf).toBe("2026-04-22T10:00:00.000Z");
    expect(result.current.allocation).toEqual([
      {
        assetClass: "stock",
        percentage: 54.55,
        value: 300,
      },
      {
        assetClass: "etf",
        percentage: 36.36,
        value: 200,
      },
      {
        assetClass: "cash",
        percentage: 9.09,
        value: 50,
      },
    ]);
    expect(result.current.convictionReadiness).toMatchObject({
      isReady: false,
      ratedTradeCount: 1,
      requiredTradeCount: 5,
    });
    expect(result.current.rollupRows).toMatchObject([
      {
        asset: stockAsset,
        currentAllocationPct: 60,
        currentValue: 300,
        initialAllocationPct: 66.67,
        investedValue: 200,
        pnl: 100,
        pnlPct: 50,
      },
      {
        asset: etfAsset,
        currentAllocationPct: 40,
        currentValue: 200,
        initialAllocationPct: 33.33,
        investedValue: 100,
        pnl: 100,
        pnlPct: 100,
      },
    ]);
  });

  it("includes debt and crypto opening positions in consolidated allocation", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const debtAsset: Asset = {
      assetClass: "debt",
      currency: "INR",
      id: "asset-ppf",
      instrumentType: "ppf",
      name: "Public Provident Fund",
      sectorType: "fixedIncome",
      symbol: "PPF",
      ticker: "PPF",
    };
    const cryptoAsset: Asset = {
      assetClass: "crypto",
      currency: "INR",
      exchange: "CRYPTO",
      id: "asset-btc",
      instrumentType: "crypto",
      name: "Bitcoin",
      quoteSourceId: "bitcoin",
      sectorType: "digitalAsset",
      symbol: "BTC",
      ticker: "bitcoin",
    };

    store.getState().addAsset(debtAsset);
    store.getState().addAsset(cryptoAsset);
    store.getState().addOpeningPosition({
      assetId: debtAsset.id,
      averageCostPrice: 950,
      currentPrice: 1000,
      date: "2026-04-20",
      id: "opening-ppf",
      quantity: 100,
    });
    store.getState().addOpeningPosition({
      assetId: cryptoAsset.id,
      averageCostPrice: 5000000,
      currentPrice: 5800000,
      date: "2026-04-20",
      id: "opening-btc",
      quantity: 0.02,
    });
    store.getState().upsertQuote({
      asOf: "2026-04-22T10:00:00.000Z",
      assetId: cryptoAsset.id,
      currency: "INR",
      price: 6000000,
      source: "coingecko",
    });
    store.getState().addCashEntry({
      amount: 30000,
      date: "2026-04-22",
      id: "cash-1",
      label: "Broker cash",
      type: "addition",
    });

    const { result } = renderHook(() => useDashboard({ store }));

    expect(result.current.totalValue).toBe(250000);
    expect(result.current.allocation).toEqual([
      { assetClass: "crypto", percentage: 48, value: 120000 },
      { assetClass: "debt", percentage: 40, value: 100000 },
      { assetClass: "cash", percentage: 12, value: 30000 },
    ]);
    expect(result.current.instrumentAllocation).toEqual([
      { label: "crypto", percentage: 54.55, value: 120000 },
      { label: "ppf", percentage: 45.45, value: 100000 },
    ]);
    expect(result.current.sectorAllocation).toEqual([
      { label: "digitalAsset", percentage: 54.55, value: 120000 },
      { label: "fixedIncome", percentage: 45.45, value: 100000 },
    ]);
  });
});
