import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useHoldings } from "@/src/features/holdings/useHoldings";
import type { QuoteRefreshResult, RefreshQuotesInput } from "@/src/services/quotes";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Trade } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
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
  it("derives holdings from raw trades and cached quotes", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
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
  });

  it("refreshes quotes and persists the updated values into the store", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
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
        failures: [],
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
      manualPrices: {
        [asset.id]: 100,
      },
    });
    expect(result.current.holdings[0]).toMatchObject({
      currentPrice: 140,
      currentValue: 280,
      dayChangePct: 2,
      lastUpdated: "2026-04-21T10:00:00.000Z",
    });
  });
});
