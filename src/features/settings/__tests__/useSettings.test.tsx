import { act, renderHook } from "@testing-library/react-native";

import { useSettings } from "@/src/features/settings/useSettings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

describe("useSettings", () => {
  it("toggles and persists the global value masking preference", () => {
    const storage = createMemoryJsonStorage();
    const firstStore = createPortfolioStore({ storage });
    const { result } = renderHook(() => useSettings({ store: firstStore }));

    expect(result.current.maskWealthValues).toBe(false);

    act(() => {
      result.current.toggleMaskWealthValues();
    });

    expect(result.current.maskWealthValues).toBe(true);

    const secondStore = createPortfolioStore({ storage });

    expect(secondStore.getState().preferences.maskWealthValues).toBe(true);
  });

  it("derives empty quote status without pretending live quotes exist", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { result } = renderHook(() => useSettings({ store }));

    expect(result.current.quoteStatus).toEqual({
      latestQuoteAsOf: null,
      latestQuoteLabel: "No quotes yet",
      liveQuoteCount: 0,
      manualFallbackCount: 0,
      providerStatus: "Waiting for holdings",
      quoteCount: 0,
    });
  });

  it("derives quote freshness and manual fallback status from stored quotes", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().upsertQuote({
      assetId: "asset-live",
      asOf: "2026-05-15T10:00:00.000Z",
      currency: "INR",
      price: 100,
      source: "yahoo",
    });
    store.getState().upsertQuote({
      assetId: "asset-manual",
      asOf: "2026-05-16T10:00:00.000Z",
      currency: "INR",
      price: 200,
      source: "manual",
    });

    const { result } = renderHook(() => useSettings({ store }));

    expect(result.current.quoteStatus).toEqual({
      latestQuoteAsOf: "2026-05-16T10:00:00.000Z",
      latestQuoteLabel: "16 May 2026",
      liveQuoteCount: 1,
      manualFallbackCount: 1,
      providerStatus: "Live available",
      quoteCount: 2,
    });
  });
});
