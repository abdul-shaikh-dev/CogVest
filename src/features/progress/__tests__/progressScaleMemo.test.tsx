import { act, renderHook } from "@testing-library/react-native";
import * as calculations from "@/src/domain/calculations/holdings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { createAndroidScaleFixture } from "@/src/testing/androidScaleFixture";
import { useProgress } from "../useProgress";

afterEach(() => jest.restoreAllMocks());

it("does not replay scale holdings on range changes but invalidates financial inputs and dates", () => {
  const now = new Date(2026, 9, 1, 12);
  const fixture = createAndroidScaleFixture(now);
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.setState({ ...fixture.portfolio, quoteCache: fixture.quoteCache });
  const holdings = jest.spyOn(calculations, "calculateHoldings");
  const hook = renderHook<ReturnType<typeof useProgress>, { date: Date }>(
    ({ date }) => useProgress({ store, now: date }), { initialProps: { date: now } });
  const initialCalls = holdings.mock.calls.length;
  const initialValue = hook.result.current.portfolioValue;
  act(() => hook.result.current.setPortfolioChartRange("All"));
  act(() => hook.result.current.setAssetChartRange("3M"));
  hook.rerender({ date: new Date(2026, 9, 1, 18) });
  expect(holdings).toHaveBeenCalledTimes(initialCalls);
  expect(hook.result.current.portfolioValue).toBe(initialValue);
  act(() => store.setState({ quoteCache: { ...fixture.quoteCache,
    "v3-asset-001": { ...fixture.quoteCache["v3-asset-001"], price: 200 } } }));
  expect(holdings).toHaveBeenCalledTimes(initialCalls + 1);
  expect(hook.result.current.portfolioValue).toBe((initialValue ?? 0) + 750);
  act(() => store.setState({ trades: [...fixture.portfolio.trades, {
    id: "future-buy", assetId: "v3-asset-001", date: "2026-10-02", type: "buy",
    quantity: 1, pricePerUnit: 200, totalValue: 200,
  }] }));
  expect(hook.result.current.portfolioValue).toBe((initialValue ?? 0) + 750);
  hook.rerender({ date: new Date(2026, 9, 2, 12) });
  expect(holdings).toHaveBeenCalledTimes(initialCalls + 3);
  expect(hook.result.current.portfolioValue).toBe((initialValue ?? 0) + 950);
  act(() => store.setState({ openingPositions: [], assets: [], trades: [], cashEntries: [] }));
  expect(hook.result.current.portfolioValue).toBe(0);
});
