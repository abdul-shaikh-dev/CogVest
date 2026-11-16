import { act, renderHook } from "@testing-library/react-native";

import * as portfolioXirr from "@/src/features/dashboard/portfolioXirr";
import { useDashboard } from "@/src/features/dashboard/useDashboard";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const now = new Date("2026-05-20T12:00:00");

function seededStore() {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.getState().addAsset({
    assetClass: "stock", currency: "INR", exchange: "NSE", id: "alpha", name: "Synthetic Alpha", symbol: "ALPHA", ticker: "ALPHA.NS",
  });
  store.getState().addTrade({ assetId: "alpha", date: "2025-05-01", id: "buy", pricePerUnit: 100, quantity: 10, totalValue: 1_000, type: "buy" });
  store.getState().upsertQuote({ asOf: "2026-05-20T09:00:00.000Z", assetId: "alpha", currency: "INR", price: 120, source: "yahoo" });
  return store;
}

describe("Dashboard derivations are memoised on the records they read (#663)", () => {
  it("does not rerun the XIRR solver or rebuild holdings when a preference changes", async () => {
    const store = seededStore();
    const solver = jest.spyOn(portfolioXirr, "wholePortfolioXirrSummary");
    const { result } = await renderHook(() => useDashboard({ now, store }));
    const holdings = result.current.holdings;
    const totalValue = result.current.totalValue;
    expect(solver).toHaveBeenCalledTimes(1);

    await act(async () => store.getState().updatePreferences({ maskWealthValues: true }));

    expect(result.current.maskWealthValues).toBe(true);
    expect(solver).toHaveBeenCalledTimes(1);
    expect(result.current.holdings).toBe(holdings);
    expect(result.current.totalValue).toBe(totalValue);

    await act(async () => store.getState().upsertQuote({
      asOf: "2026-05-20T10:00:00.000Z", assetId: "alpha", currency: "INR", price: 130, source: "yahoo",
    }));

    expect(solver).toHaveBeenCalledTimes(2);
    expect(result.current.holdings).not.toBe(holdings);
    expect(result.current.totalValue).toBe(1_300);
    solver.mockRestore();
  });
});
