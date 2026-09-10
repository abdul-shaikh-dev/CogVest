import { act, renderHook } from "@testing-library/react-native";
import { useDashboard } from "@/src/features/dashboard/useDashboard";
import { useHoldings } from "@/src/features/holdings/useHoldings";
import { useProgress } from "@/src/features/progress/useProgress";
import { createPortfolioStore, createEmptyPortfolioSnapshot } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { QuoteRefreshResult, resolveHistoricalPrice } from "@/src/services/quotes";

const now = new Date("2026-09-10T10:00:00.000Z");
function destination() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
  store.getState().addAsset({ id: "stock", assetClass: "stock", currency: "INR", name: "Synthetic Stock", ticker: "SYNTH.NS", symbol: "SYNTH" });
  store.getState().addOpeningPosition({ id: "opening", assetId: "stock", date: "2026-08-01", quantity: 1, averageCostPrice: 100 });
  return store;
}

function restoreEmpty(store: ReturnType<typeof destination>) {
  const revision = store.getState().captureBackup().revision;
  store.getState().replaceFromBackup({ portfolio: createEmptyPortfolioSnapshot(), quoteCache: {}, historicalQuoteCache: {}, casFolioSalt: null }, revision);
}

describe("restored portfolio concurrency", () => {
  it.each(["Dashboard", "Holdings"])("ignores a late %s quote response", async (screen) => {
    const store = destination();
    let finish!: (value: QuoteRefreshResult) => void;
    const response = new Promise<QuoteRefreshResult>((resolve) => { finish = resolve; });
    const refreshQuotes = jest.fn(() => response);
    const { result } = renderHook(() => screen === "Dashboard"
      ? useDashboard({ store, now, refreshQuotes }) : useHoldings({ store, now, refreshQuotes }));
    let running!: Promise<unknown>;
    act(() => { running = result.current.refresh(); });
    expect(refreshQuotes).toHaveBeenCalledTimes(1);
    act(() => restoreEmpty(store));
    await act(async () => {
      finish({ quoteCache: { stock: { assetId: "stock", asOf: now.toISOString(), currency: "INR", price: 999, source: "yahoo" } }, failed: [], timedOut: [], updated: ["stock"] });
      await running;
    });
    expect(store.getState().quoteCache).toEqual({});
    expect(store.getState().assets).toEqual([]);
  });

  it("abandons historical lookup and month-end automation started before restore", async () => {
    const store = destination();
    type HistoricalResult = Awaited<ReturnType<typeof resolveHistoricalPrice>>;
    let finish!: (value: HistoricalResult) => void;
    const response = new Promise<HistoricalResult>((resolve) => { finish = resolve; });
    const historicalPriceFetcher = jest.fn(() => response);
    const { result } = renderHook(() => useProgress({ store, now, historicalPriceFetcher }));
    let running!: Promise<unknown>;
    act(() => { running = result.current.ensureMonthEndSnapshot(); });
    expect(historicalPriceFetcher).toHaveBeenCalledTimes(1);
    act(() => restoreEmpty(store));
    await act(async () => {
      finish({ ok: true, quote: { assetId: "stock", asOfMonth: "2026-08", basis: "historical-close", currency: "INR", fetchedAt: now.toISOString(), price: 999, source: "yahoo" } });
      await running;
    });
    expect(store.getState().historicalQuoteCache).toEqual({});
    expect(store.getState().monthlySnapshots).toEqual([]);
  });
});
