import { act, renderHook } from "@testing-library/react-native";

import { useDashboard } from "@/src/features/dashboard/useDashboard";
import { useHoldings } from "@/src/features/holdings/useHoldings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { quoteCacheStorageKey } from "@/src/store/storeTypes";
import type { Asset, Quote } from "@/src/types";

const ids = ["alpha", "beta", "gamma"];

function seededStore() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage });
  for (const id of ids) {
    const asset: Asset = {
      assetClass: "stock", currency: "INR", exchange: "NSE", id,
      name: `Synthetic ${id}`, symbol: id.toUpperCase(), ticker: `${id.toUpperCase()}.NS`,
    };
    store.getState().addAsset(asset);
    store.getState().addTrade({
      assetId: id, date: "2026-04-20", id: `${id}-buy`, pricePerUnit: 100, quantity: 1, totalValue: 100, type: "buy",
    });
  }
  return { setItem: jest.spyOn(storage, "setItem"), store };
}

function refreshed(price: (id: string) => number) {
  return jest.fn().mockResolvedValue({
    failed: [],
    quoteCache: Object.fromEntries(ids.map((id): [string, Quote] => [id, {
      asOf: "2026-04-21T10:00:00.000Z", assetId: id, currency: "INR", price: price(id), source: "yahoo",
    }])),
    timedOut: [],
    updated: ids,
  });
}

const hooks = [
  ["Holdings", useHoldings],
  ["Dashboard", useDashboard],
] as const;

describe.each(hooks)("%s quote refresh (#661)", (_name, useHook) => {
  it("saves all refreshed quotes with one write", async () => {
    const { setItem, store } = seededStore();
    const refreshQuotes = refreshed(() => 120);
    const { result } = await renderHook(() => useHook({ refreshQuotes, store }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(setItem.mock.calls.filter(([key]) => key === quoteCacheStorageKey)).toHaveLength(1);
    expect(ids.map((id) => store.getState().quoteCache[id]?.price)).toEqual([120, 120, 120]);
  });

  it("saves none of the refreshed quotes when one is invalid", async () => {
    const { setItem, store } = seededStore();
    const refreshQuotes = refreshed((id) => (id === "beta" ? Number.POSITIVE_INFINITY : 120));
    const { result } = await renderHook(() => useHook({ refreshQuotes, store }));

    await act(async () => {
      await expect(result.current.refresh()).rejects.toThrow("Quote financial values must be finite.");
    });

    expect(store.getState().quoteCache).toEqual({});
    expect(setItem.mock.calls.filter(([key]) => key === quoteCacheStorageKey)).toHaveLength(0);
  });
});
