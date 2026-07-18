import * as Haptics from "expo-haptics";
import { act, renderHook } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

import { useAddOpeningPosition } from "../useAddOpeningPosition";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: "success",
  },
}));

describe("useAddOpeningPosition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reviews and confirms a manual opening position through the feature controller", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useAddOpeningPosition({ onComplete, store }),
    );

    act(() => {
      result.current.setAssetName("Reliance Industries");
      result.current.setSymbol("RELIANCE");
      result.current.setTicker("RELIANCE.NS");
      result.current.setQuantity("2");
      result.current.setAverageCostPrice("100");
      result.current.setCurrentPrice("120");
    });

    act(() => {
      result.current.handleReview();
    });

    expect(result.current.reviewOpeningPosition).toMatchObject({
      averageCostPrice: 100,
      currentPrice: 120,
      quantity: 2,
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().openingPositions).toHaveLength(1);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().quoteCache[store.getState().assets[0].id]).toMatchObject({
      price: 120,
      source: "manual",
    });
    expect(onComplete).toHaveBeenCalledWith(store.getState().assets[0].id);
  });

  it("completes after persistence when haptic feedback is unavailable", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onComplete = jest.fn();
    const { result } = renderHook(() =>
      useAddOpeningPosition({ onComplete, store }),
    );
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(
      new Error("Haptics unavailable"),
    );

    act(() => {
      result.current.setAssetName("Reliance Industries");
      result.current.setSymbol("RELIANCE");
      result.current.setTicker("RELIANCE.NS");
      result.current.setQuantity("2");
      result.current.setAverageCostPrice("100");
      result.current.setCurrentPrice("120");
    });

    act(() => {
      result.current.handleReview();
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(store.getState().openingPositions).toHaveLength(1);
    expect(onComplete).toHaveBeenCalledWith(store.getState().assets[0].id);
  });
});
