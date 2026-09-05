import { act, renderHook } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

import { useAddTrade } from "../useAddTrade";

describe("useAddTrade", () => {
  it("records a buy without treating its transaction price as a current quote", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({
      amount: 1000,
      date: "2026-04-20",
      id: "cash-contribution",
      label: "Broker contribution",
      purpose: "capitalContribution",
      type: "addition",
    });
    const { result } = renderHook(() => useAddTrade({ store }));

    act(() => {
      result.current.setAssetName("Reliance Industries");
      result.current.setSymbol("RELIANCE");
      result.current.setTicker("RELIANCE.NS");
      result.current.setQuantity("2");
      result.current.setPricePerUnit("100");
      result.current.setIntendedHoldDays("365");
    });

    act(() => {
      result.current.handleReview();
    });

    expect(result.current.reviewTrade).toMatchObject({
      pricePerUnit: 100,
      intendedHoldDays: 365,
      quantity: 2,
      totalValue: 200,
      type: "buy",
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().trades[0]?.intendedHoldDays).toBe(365);
    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({ amount: 1000 }),
      expect.objectContaining({
        amount: 200,
        purpose: "purchaseFunding",
        type: "withdrawal",
      }),
    ]);
    expect(store.getState().quoteCache).toEqual({});
  });
});
