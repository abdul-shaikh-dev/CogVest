import { act, renderHook } from "@testing-library/react-native";

import { useQuoteRefresh, withQuoteMetadata } from "@/src/hooks";
import { quoteSaveFailureMessage } from "@/src/hooks/useQuoteRefresh";
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

describe("useQuoteRefresh writes (#717)", () => {
  /** "held" plus a second held asset, "other". */
  function twoHeldStore() {
    const store = seededStore();
    store.getState().addAsset({
      assetClass: "stock", currency: "INR", exchange: "NSE", id: "other", name: "Synthetic other", symbol: "OTHER", ticker: "OTHER.NS",
    });
    store.getState().addTrade({
      assetId: "other", date: "2026-04-01", id: "other-buy", pricePerUnit: 100, quantity: 1, totalValue: 100, type: "buy",
    });
    return store;
  }
  const fetchedBoth = { failed: [], quoteCache: { held: quote("held"), other: quote("other") }, timedOut: [], updated: ["held", "other"] };
  async function runRefresh(store: ReturnType<typeof seededStore>, refreshQuotes: jest.Mock) {
    const { result } = await renderHook(() => useQuoteRefresh({ now, refreshQuotes, store }));
    await act(async () => {
      await result.current.refresh();
    });
    return result;
  }

  it("skips an asset corrected while the request was in flight", async () => {
    const store = twoHeldStore();
    const refreshQuotes = jest.fn().mockImplementation(async () => {
      store.setState({
        assets: store.getState().assets.map((asset) => asset.id === "held" ? { ...asset, ticker: "RENAMED.NS" } : asset),
      });
      return fetchedBoth;
    });

    await runRefresh(store, refreshQuotes);

    expect(store.getState().quoteCache.held).toBeUndefined();
    expect(store.getState().quoteCache.other).toMatchObject({ price: 120 });
  });

  it("keeps a quote another refresh saved during the request", async () => {
    const store = twoHeldStore();
    const newer = { ...quote("held"), asOf: "2026-04-21T11:00:00.000Z", price: 125 };
    const refreshQuotes = jest.fn().mockImplementation(async () => {
      store.getState().upsertQuote(newer);
      return fetchedBoth;
    });

    await runRefresh(store, refreshQuotes);

    expect(store.getState().quoteCache.held).toMatchObject({ price: 125 });
    expect(store.getState().quoteCache.other).toMatchObject({ price: 120 });
  });

  it("does not write fallback quotes for failed or timed-out assets", async () => {
    const store = twoHeldStore();
    const refreshQuotes = jest.fn().mockResolvedValue({
      failed: [{ assetId: "held", error: "synthetic" }], quoteCache: { held: quote("held"), other: quote("other") },
      timedOut: [{ assetId: "other", error: "slow" }], updated: [],
    });

    await runRefresh(store, refreshQuotes);

    expect(store.getState().quoteCache).toEqual({});
  });

  it("reports a failed save and still records failed and timed-out assets", async () => {
    const store = twoHeldStore();
    store.setState({ upsertQuotes: () => { throw new Error("synthetic write failure"); } });
    const refreshQuotes = jest.fn().mockResolvedValue({
      ...fetchedBoth, failed: [{ assetId: "x", error: "synthetic" }], timedOut: [{ assetId: "y", error: "slow" }],
    });

    const result = await runRefresh(store, refreshQuotes);

    expect(result.current.refreshError).toBe(quoteSaveFailureMessage);
    expect(result.current.failed).toHaveLength(1);
    expect(result.current.timedOut).toHaveLength(1);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("reports a provider failure instead of rejecting", async () => {
    const store = twoHeldStore();
    const refreshQuotes = jest.fn().mockRejectedValue(new Error("network down"));

    const result = await runRefresh(store, refreshQuotes);

    expect(result.current.refreshError).toMatch(/could not be refreshed/);
    expect(result.current.isRefreshing).toBe(false);
  });
});

