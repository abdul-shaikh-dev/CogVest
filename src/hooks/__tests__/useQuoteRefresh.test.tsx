import { act, renderHook } from "@testing-library/react-native";

import { useQuoteRefresh, withQuoteMetadata } from "@/src/hooks";
import { calculateHoldings } from "@/src/domain/calculations";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Quote } from "@/src/types";

const now = new Date("2026-04-21T12:00:00");

function seededStore() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  for (const id of ["held", "sold"]) {
    const asset: Asset = {
      assetClass: "stock", currency: "INR", exchange: "NSE", id,
      name: `Synthetic ${id}`, symbol: id.toUpperCase(), ticker: `${id.toUpperCase()}.NS`,
    };
    store.getState().addAsset(asset);
    store.getState().addTrade({
      assetId: id, date: "2026-04-01", id: `${id}-buy`, pricePerUnit: 100, quantity: 1, totalValue: 100, type: "buy",
    });
  }
  store.getState().addTrade({
    assetId: "sold", date: "2026-04-10", id: "sold-sell", pricePerUnit: 110, quantity: 1, totalValue: 110, type: "sell",
  });
  return store;
}

const quote = (assetId: string): Quote => ({
  asOf: "2026-04-21T10:00:00.000Z", assetId, currency: "INR", dayChangePct: 1.5, price: 120, source: "yahoo",
});

describe("useQuoteRefresh (#666)", () => {
  it("asks only for assets still held and reports failures", async () => {
    const store = seededStore();
    const refreshQuotes = jest.fn().mockResolvedValue({
      failed: [{ assetId: "held", reason: "synthetic" }], quoteCache: {}, timedOut: [], updated: [],
    });
    const { result } = await renderHook(() => useQuoteRefresh({ now, refreshQuotes, store }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(refreshQuotes.mock.calls[0][0].assets.map((asset: Asset) => asset.id)).toEqual(["held"]);
    expect(result.current.failed).toEqual([{ assetId: "held", reason: "synthetic" }]);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("drops quotes that arrive after a restore replaced the records", async () => {
    const store = seededStore();
    const refreshQuotes = jest.fn().mockImplementation(async () => {
      store.setState({ restoreEpoch: store.getState().restoreEpoch + 1 });
      return { failed: [], quoteCache: { held: quote("held") }, timedOut: [], updated: ["held"] };
    });
    const { result } = await renderHook(() => useQuoteRefresh({ now, refreshQuotes, store }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(store.getState().quoteCache.held).toBeUndefined();
  });

  it("labels holdings with their quote, or as manual when valued by hand", () => {
    const store = seededStore();
    store.getState().upsertQuote(quote("held"));
    const state = store.getState();
    const holdings = calculateHoldings({
      assets: state.assets, now, openingPositions: state.openingPositions, quoteCache: state.quoteCache, trades: state.trades,
    });

    const [held] = withQuoteMetadata(holdings, state.quoteCache);

    expect(held).toMatchObject({ dayChangePct: 1.5, lastUpdated: "2026-04-21T10:00:00.000Z", quoteSource: "yahoo" });
  });
});
