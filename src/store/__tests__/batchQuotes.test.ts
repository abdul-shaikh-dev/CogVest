import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { quoteCacheStorageKey } from "@/src/store/storeTypes";
import type { Asset, Quote } from "@/src/types";

function asset(id: string): Asset {
  return {
    assetClass: "stock", currency: "INR", exchange: "NSE", id,
    name: `Synthetic ${id}`, symbol: id.toUpperCase(), ticker: id.toUpperCase(),
  };
}
function quote(assetId: string, price: number, currency: "INR" | "USD" = "INR"): Quote {
  return { asOf: "2026-10-01T10:00:00.000Z", assetId, currency, price, source: "yahoo" };
}

function storeWithAssets() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage });
  for (const id of ["alpha", "beta", "gamma"]) store.getState().addAsset(asset(id));
  store.getState().upsertQuote(quote("alpha", 90));
  const setItem = jest.spyOn(storage, "setItem");
  return { setItem, storage, store };
}

describe("batch quote updates (#661)", () => {
  it("saves every quote with one write", () => {
    const { setItem, storage, store } = storeWithAssets();

    store.getState().upsertQuotes([quote("alpha", 100), quote("beta", 200), quote("gamma", 300)]);

    expect(setItem.mock.calls.map(([key]) => key)).toEqual([quoteCacheStorageKey]);
    expect(Object.fromEntries(Object.entries(store.getState().quoteCache).map(([id, q]) => [id, q.price])))
      .toEqual({ alpha: 100, beta: 200, gamma: 300 });
    expect(storage.getItem(quoteCacheStorageKey)).toEqual(store.getState().quoteCache);
  });

  it.each([
    ["a price that is not finite", quote("beta", Number.NaN)],
    ["a price below supported precision", quote("beta", 1e-12)],
    ["a currency that differs from the holding", quote("beta", 200, "USD")],
  ])("leaves the cache unchanged when one quote has %s", (_label, invalid) => {
    const { setItem, storage, store } = storeWithAssets();
    const before = store.getState().quoteCache;

    expect(() => store.getState().upsertQuotes([quote("alpha", 100), invalid, quote("gamma", 300)])).toThrow();

    expect(store.getState().quoteCache).toBe(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(storage.getItem(quoteCacheStorageKey)).toEqual(before);
  });

  it("skips quotes for deleted holdings and writes nothing when none remain", () => {
    const { setItem, store } = storeWithAssets();

    store.getState().upsertQuotes([quote("deleted", 100)]);
    expect(setItem).not.toHaveBeenCalled();

    store.getState().upsertQuotes([quote("deleted", 100), quote("beta", 200)]);
    expect(Object.keys(store.getState().quoteCache).sort()).toEqual(["alpha", "beta"]);
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});
