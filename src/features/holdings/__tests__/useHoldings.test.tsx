import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useHoldings } from "@/src/features/holdings/useHoldings";
import type { QuoteRefreshResult, RefreshQuotesInput } from "@/src/services/quotes";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Trade } from "@/src/types";

const rawAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const asset: Asset = {
  ...rawAsset,
  instrumentType: "stock",
  quoteSourceId: "RELIANCE.NS",
  sectorType: "other",
};

const buyTrade: Trade = {
  assetId: asset.id,
  date: "2026-04-20",
  id: "trade-buy",
  pricePerUnit: 100,
  quantity: 2,
  totalValue: 200,
  type: "buy",
};

describe("useHoldings", () => {
  it.each(["parent", "child"] as const)("keeps the full demerger graph when the %s is fully sold", (soldSide) => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const parent: Asset = {
      ...asset,
      id: "ril",
      isin: "INE002A01018",
      demerger: { eventId: "RELIANCE-JIOFIN-2023-v1", childAssetId: "jio" },
    };
    const child: Asset = { ...asset, id: "jio", isin: "INE758E01017", symbol: "JIOFIN", ticker: "JIOFIN.NS", quoteSourceId: "JIOFIN.NS" };
    const parentBuy: Trade = { ...buyTrade, id: "ril-buy", assetId: parent.id, date: "2023-01-02", quantity: 10, totalValue: 1000 };
    const sale: Trade = soldSide === "parent"
      ? { ...parentBuy, id: "ril-sale", date: "2024-11-02", quantity: 20, totalValue: 2000, type: "sell" }
      : { ...parentBuy, id: "jio-sale", assetId: child.id, date: "2023-09-01", type: "sell" };
    store.setState({ assets: [parent, child], trades: [parentBuy, sale] });

    const { result } = renderHook(() => useHoldings({ store, now: new Date("2024-11-03T12:00:00Z") }));

    expect(result.current.assets.map((item) => item.id)).toEqual(["ril", "jio"]);
    expect(result.current.holdings.map((holding) => holding.asset.id)).toEqual([
      soldSide === "parent" ? "jio" : "ril",
    ]);
  });

  it("derives holdings from raw trades and cached quotes", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(rawAsset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      dayChangePct: 1.5,
      price: 125,
      source: "yahoo",
    });

    const { result } = renderHook(() => useHoldings({ store }));

    expect(result.current.holdings).toHaveLength(1);
    expect(result.current.holdings[0]).toMatchObject({
      averageCostPrice: 100,
      currentPrice: 125,
      currentValue: 250,
      dayChangePct: 1.5,
      lastUpdated: "2026-04-20T10:00:00.000Z",
      totalUnits: 2,
      unrealisedPnL: 50,
      unrealisedPnLPct: 25,
    });
    expect(result.current.rollupTotals).toMatchObject({
      cashBalance: 0,
      holdingsCurrentValue: 250,
      pnl: 50,
      pnlPct: 25,
      totalCurrentValue: 250,
      totalInvested: 200,
      valuationCoverage: {
        pendingHoldings: 0,
        status: "complete",
        totalHoldings: 1,
        valuedHoldings: 1,
      },
    });
    expect(result.current.rollupRows[0]).toMatchObject({
      currentAllocationPct: 100,
      currentValue: 250,
      initialAllocationPct: 100,
      investedValue: 200,
      pnl: 50,
      pnlPct: 25,
    });
  });

  it("refreshes quotes and persists the updated values into the store", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(rawAsset);
    store.getState().addTrade(buyTrade);
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 100,
      source: "manual",
    });
    const refreshQuotes = jest
      .fn<Promise<QuoteRefreshResult>, [RefreshQuotesInput]>()
      .mockResolvedValue({
        failed: [],
        quoteCache: {
          [asset.id]: {
            asOf: "2026-04-21T10:00:00.000Z",
            assetId: asset.id,
            currency: "INR",
            dayChangePct: 2,
            price: 140,
            source: "yahoo",
          },
        },
        timedOut: [],
        updated: [asset.id],
      });

    const { result } = renderHook(() =>
      useHoldings({ refreshQuotes, store }),
    );

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(store.getState().quoteCache[asset.id]).toMatchObject({
        price: 140,
        source: "yahoo",
      });
    });
    expect(refreshQuotes).toHaveBeenCalledWith({
      assets: [asset],
      cachedQuotes: {
        [asset.id]: {
          asOf: "2026-04-20T10:00:00.000Z",
          assetId: asset.id,
          currency: "INR",
          price: 100,
          source: "manual",
        },
      },
    });
    expect(result.current.holdings[0]).toMatchObject({
      currentPrice: 140,
      currentValue: 280,
      dayChangePct: 2,
      lastUpdated: "2026-04-21T10:00:00.000Z",
    });
  });

  it("exposes quote status metadata and value-mask toggle", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const cashAsset: Asset = {
      assetClass: "cash",
      currency: "INR",
      id: "asset-cash",
      name: "Cash",
      symbol: "CASH",
      ticker: "CASH",
    };
    store.getState().addAsset(rawAsset);
    store.getState().addAsset(cashAsset);
    store.getState().addTrade(buyTrade);
    store.getState().addTrade({
      assetId: cashAsset.id,
      date: "2026-04-20",
      id: "trade-cash",
      pricePerUnit: 1,
      quantity: 100,
      totalValue: 100,
      type: "buy",
    });
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: asset.id,
      currency: "INR",
      price: 125,
      source: "manual",
    });

    const { result } = renderHook(() => useHoldings({ store }));

    expect(result.current.quoteFreshness).toEqual({
      current: 0,
      manual: 1,
      missing: 0,
      stale: 0,
      status: "manual",
      total: 1,
    });
    expect(result.current.maskWealthValues).toBe(false);

    act(() => {
      result.current.toggleMaskWealthValues();
    });

    expect(store.getState().preferences.maskWealthValues).toBe(true);
  });
});
