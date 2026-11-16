import { act, renderHook } from "@testing-library/react-native";

import { useCash } from "@/src/features/cash/useCash";
import { useDashboard } from "@/src/features/dashboard/useDashboard";
import { useHoldings } from "@/src/features/holdings/useHoldings";
import { useBehaviorInsights } from "@/src/features/insights/useBehaviorInsights";
import { useSettings } from "@/src/features/settings/useSettings";
import { createMemoryJsonStorage, type JsonValue } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { portfolioStorageKey, quoteCacheStorageKey } from "@/src/store/storeTypes";
import { createV3ScaleFixture } from "@/src/testing/v3ScaleFixture";

/**
 * Screens subscribe to the records they use (#662), so on the 250-asset
 * fixture a quote or a cash entry re-renders only the screens that show it.
 * Before, every screen re-rendered on every store write.
 */
describe("store writes re-render only the screens that use the changed records", () => {
  it("on the 250-asset fixture", async () => {
    const fixture = createV3ScaleFixture();
    const store = createPortfolioStore({
      now: () => fixture.now,
      storage: createMemoryJsonStorage({
        [portfolioStorageKey]: fixture.portfolio as unknown as JsonValue,
        [quoteCacheStorageKey]: fixture.quoteCache as unknown as JsonValue,
      }),
    });
    const renders = { cash: 0, dashboard: 0, holdings: 0, insights: 0, settings: 0 };
    const now = fixture.now;
    await renderHook(() => { renders.dashboard += 1; return useDashboard({ now, store }); });
    await renderHook(() => { renders.holdings += 1; return useHoldings({ now, store }); });
    await renderHook(() => { renders.cash += 1; return useCash({ now, store }); });
    await renderHook(() => { renders.settings += 1; return useSettings({ store }); });
    await renderHook(() => { renders.insights += 1; return useBehaviorInsights(store, now); });

    async function rendersDuring(write: () => void) {
      const before = { ...renders };
      await act(async () => write());
      return Object.fromEntries(Object.entries(renders).map(([key, count]) =>
        [key, count - before[key as keyof typeof renders]]));
    }
    const quote = Object.values(store.getState().quoteCache)[0];

    expect(await rendersDuring(() => store.getState().upsertQuote({ ...quote, price: quote.price + 1 })))
      .toEqual({ cash: 0, dashboard: 1, holdings: 1, insights: 0, settings: 1 });
    expect(await rendersDuring(() => store.getState().addCashEntry({
      amount: 1_000, date: "2025-12-01", id: "synthetic-cash", label: "Synthetic cash",
      purpose: "capitalContribution", type: "addition",
    }))).toEqual({ cash: 1, dashboard: 1, holdings: 1, insights: 0, settings: 0 });
    expect(await rendersDuring(() => store.getState().updatePreferences({ maskWealthValues: true })))
      .toEqual({ cash: 1, dashboard: 1, holdings: 1, insights: 1, settings: 1 });
  });
});
