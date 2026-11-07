import { act, renderHook } from "@testing-library/react-native";
import * as calculations from "@/src/domain/calculations/holdings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { createAndroidScaleFixture } from "@/src/testing/androidScaleFixture";
import { useHoldings } from "../useHoldings";

afterEach(() => jest.restoreAllMocks());

it("reuses scale replay across UI changes while invalidating every financial collection", async () => {
  const now = new Date(2026, 9, 1, 12);
  const fixture = createAndroidScaleFixture(now);
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.setState({ ...fixture.portfolio, quoteCache: fixture.quoteCache });
  const replay = jest.spyOn(calculations, "calculateHoldings");
  const hook = await renderHook(() => useHoldings({ store, now }));
  const first = hook.result.current.holdings;
  const calls = replay.mock.calls.length;
  await hook.rerender({});
  await act(() => hook.result.current.toggleMaskWealthValues());
  expect(hook.result.current.holdings).toBe(first);
  expect(replay).toHaveBeenCalledTimes(calls);

  for (const key of ["assets", "openingPositions", "trades", "ppfAccounts", "ppfLedgerEntries"] as const) {
    const before = replay.mock.calls.length;
    await act(() => store.setState({ [key]: [...store.getState()[key]] }));
    expect(replay).toHaveBeenCalledTimes(before + 1);
  }
  await act(() => store.setState({ quoteCache: { ...fixture.quoteCache,
    "v3-asset-001": { ...fixture.quoteCache["v3-asset-001"], price: 200 } } }));
  expect(hook.result.current.holdings.find((item) => item.asset.id === "v3-asset-001")?.currentValue).toBe(3000);
  await act(() => store.getState().replaceFromBackup({ portfolio: { ...fixture.portfolio, assets: [],
    openingPositions: [], trades: [], ppfAccounts: [], ppfLedgerEntries: [] },
    quoteCache: {}, historicalQuoteCache: {}, casFolioSalt: null }, store.getState().getBackupRevision()));
  expect(hook.result.current.holdings).toEqual([]);
  expect(hook.result.current.rollupTotals.totalCurrentValue).toBe(0);
});

it("refreshes quote age within the day and replays future transactions on date rollover", async () => {
  const now = new Date(2026, 9, 1, 12);
  const fixture = createAndroidScaleFixture(now);
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.setState({ ...fixture.portfolio, quoteCache: { ...fixture.quoteCache,
    "v3-asset-001": { ...fixture.quoteCache["v3-asset-001"], source: "yahoo", asOf: now.toISOString() } },
    trades: [...fixture.portfolio.trades, { id: "future-buy", assetId: "v3-asset-001",
      date: "2026-10-02", type: "buy", quantity: 1, pricePerUnit: 150, totalValue: 150 }] });
  const hook = await renderHook<ReturnType<typeof useHoldings>, { date: Date }>(
    ({ date }) => useHoldings({ store, now: date }), { initialProps: { date: now } });
  const first = hook.result.current.holdings;
  expect(first.find((item) => item.asset.id === "v3-asset-001")?.totalUnits).toBe(15);
  expect(hook.result.current.quoteFreshness.current).toBeGreaterThan(0);
  await hook.rerender({ date: new Date(2026, 9, 1, 12, 16) });
  expect(hook.result.current.holdings).toBe(first);
  expect(hook.result.current.quoteFreshness.current).toBe(0);
  await hook.rerender({ date: new Date(2026, 9, 2, 0, 1) });
  expect(hook.result.current.holdings).not.toBe(first);
  expect(hook.result.current.holdings.find((item) => item.asset.id === "v3-asset-001")?.totalUnits).toBe(16);
});
