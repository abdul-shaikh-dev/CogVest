import * as Haptics from "expo-haptics";
import { act, renderHook } from "@testing-library/react-native";

import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { QuoteResult } from "@/src/services/quotes";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

import { useAddOpeningPosition } from "../useAddOpeningPosition";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: "success",
  },
}));

const hdfcLookupResult: AssetLookupResult = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "yahoo:HDFCBANK.NS",
  instrumentType: "stock",
  instrumentTypeConfidence: "provider",
  metadataReviewMessage: "Provider metadata available.",
  name: "HDFC Bank Limited",
  provider: "yahoo",
  quoteSourceId: "HDFCBANK.NS",
  sectorType: "financialServices",
  sectorTypeConfidence: "provider",
  sourceLabel: "Yahoo Finance",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

describe("useAddOpeningPosition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults acquisition to the injected local calendar day", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const now = new Date("2026-07-21T19:15:00.000Z");
    jest.spyOn(now, "getFullYear").mockReturnValue(2026);
    jest.spyOn(now, "getMonth").mockReturnValue(6);
    jest.spyOn(now, "getDate").mockReturnValue(22);

    const { result } = renderHook(() =>
      useAddOpeningPosition({ now, store }),
    );

    expect(result.current.date).toBe("2026-07-22");
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
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.savedAssetId).toBe(store.getState().assets[0].id);

    act(() => {
      result.current.viewSavedHolding();
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
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.savedAssetId).toBe(store.getState().assets[0].id);
  });

  it("keeps the latest selected asset when quote responses resolve out of order", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const firstQuote = deferred<QuoteResult>();
    const secondQuote = deferred<QuoteResult>();
    const resolveQuote = jest
      .fn()
      .mockReturnValueOnce(firstQuote.promise)
      .mockReturnValueOnce(secondQuote.promise);
    const { result } = renderHook(() =>
      useAddOpeningPosition({ resolveQuote, store }),
    );
    const secondResult: AssetLookupResult = {
      ...hdfcLookupResult,
      id: "yahoo:RELIANCE.NS",
      name: "Reliance Industries",
      quoteSourceId: "RELIANCE.NS",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    };

    let firstSelection!: Promise<void>;
    let secondSelection!: Promise<void>;
    act(() => {
      firstSelection = result.current.selectLookupResult(hdfcLookupResult);
      secondSelection = result.current.selectLookupResult(secondResult);
    });
    await act(async () => {
      secondQuote.resolve({
        ok: true,
        quote: {
          asOf: "2026-07-20T00:00:00.000Z",
          assetId: "lookup-reliance",
          currency: "INR",
          price: 1500,
          source: "yahoo",
        },
      });
      await secondSelection;
    });
    await act(async () => {
      firstQuote.resolve({
        ok: true,
        quote: {
          asOf: "2026-07-20T00:00:00.000Z",
          assetId: "lookup-hdfc",
          currency: "INR",
          price: 1700,
          source: "yahoo",
        },
      });
      await firstSelection;
    });

    expect(result.current.assetName).toBe("Reliance Industries");
    expect(result.current.currentPrice).toBe("1500");
  });

  it("keeps the latest selected asset when the earlier quote resolves first", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const firstQuote = deferred<QuoteResult>();
    const secondQuote = deferred<QuoteResult>();
    const resolveQuote = jest
      .fn()
      .mockReturnValueOnce(firstQuote.promise)
      .mockReturnValueOnce(secondQuote.promise);
    const { result } = renderHook(() =>
      useAddOpeningPosition({ resolveQuote, store }),
    );
    const secondResult: AssetLookupResult = {
      ...hdfcLookupResult,
      id: "yahoo:RELIANCE.NS",
      name: "Reliance Industries",
      quoteSourceId: "RELIANCE.NS",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    };

    let firstSelection!: Promise<void>;
    let secondSelection!: Promise<void>;
    act(() => {
      firstSelection = result.current.selectLookupResult(hdfcLookupResult);
      secondSelection = result.current.selectLookupResult(secondResult);
    });
    await act(async () => {
      firstQuote.resolve({
        ok: true,
        quote: {
          asOf: "2026-07-20T00:00:00.000Z",
          assetId: "lookup-hdfc",
          currency: "INR",
          price: 1700,
          source: "yahoo",
        },
      });
      await firstSelection;
    });
    expect(result.current.assetName).toBe("Reliance Industries");
    expect(result.current.currentPrice).toBe("");

    await act(async () => {
      secondQuote.resolve({
        ok: true,
        quote: {
          asOf: "2026-07-20T00:00:00.000Z",
          assetId: "lookup-reliance",
          currency: "INR",
          price: 1500,
          source: "yahoo",
        },
      });
      await secondSelection;
    });

    expect(result.current.assetName).toBe("Reliance Industries");
    expect(result.current.currentPrice).toBe("1500");
  });

  it("ignores a lookup quote after the user edits quote identity", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const pendingQuote = deferred<QuoteResult>();
    const { result } = renderHook(() =>
      useAddOpeningPosition({
        resolveQuote: () => pendingQuote.promise,
        store,
      }),
    );

    let selection!: Promise<void>;
    act(() => {
      selection = result.current.selectLookupResult(hdfcLookupResult);
    });
    act(() => {
      result.current.updateTicker("HDFCBANK-MANUAL.NS");
    });
    await act(async () => {
      pendingQuote.resolve({
        ok: true,
        quote: {
          asOf: "2026-07-20T00:00:00.000Z",
          assetId: "lookup-hdfc",
          currency: "INR",
          price: 1700,
          source: "yahoo",
        },
      });
      await selection;
    });

    expect(result.current.ticker).toBe("HDFCBANK-MANUAL.NS");
    expect(result.current.currentPrice).toBe("");
    expect(result.current.quoteStatus).toBe(
      "Asset identity changed. Enter current price manually.",
    );
  });

  it("reuses a saved asset when a provider result has the same identity", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "asset-hdfc",
      instrumentType: "stock",
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "other",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    const resolveQuote = jest.fn().mockResolvedValue({
      ok: true,
      quote: {
        asOf: "2026-07-20T00:00:00.000Z",
        assetId: "provider-candidate",
        currency: "INR",
        price: 1678,
        source: "yahoo",
      },
    });
    const { result } = renderHook(() =>
      useAddOpeningPosition({ resolveQuote, store }),
    );

    await act(async () => {
      await result.current.selectLookupResult(hdfcLookupResult);
    });
    expect(result.current.selectedAssetId).toBe("asset-hdfc");

    act(() => {
      result.current.setQuantity("25");
      result.current.setAverageCostPrice("1450");
    });
    act(() => {
      result.current.handleReview();
    });
    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().assets[0]).toMatchObject({
      id: "asset-hdfc",
      name: "HDFC Bank Limited",
      sectorType: "financialServices",
    });
    expect(store.getState().openingPositions[0].assetId).toBe("asset-hdfc");
  });

  it("resets all position fields when the selected asset changes", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "asset-hdfc",
      instrumentType: "stock",
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    const { result } = renderHook(() =>
      useAddOpeningPosition({
        now: new Date("2026-07-20T12:00:00.000Z"),
        store,
      }),
    );

    act(() => {
      result.current.setQuantity("25");
      result.current.setAverageCostPrice("1450");
      result.current.setCurrentPrice("1678");
      result.current.setDate("2024-04-15");
      result.current.setConviction("4");
      result.current.setNotes("Long-term holding");
      result.current.selectAsset(store.getState().assets[0]);
    });

    expect(result.current.quantity).toBe("");
    expect(result.current.averageCostPrice).toBe("");
    expect(result.current.currentPrice).toBe("");
    expect(result.current.date).toBe("2026-07-20");
    expect(result.current.conviction).toBe("");
    expect(result.current.notes).toBe("");
    expect(result.current.quoteStatus).toBe(
      "No saved current price. Enter it manually.",
    );
  });

  it("resets deterministically when adding another holding", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { result } = renderHook(() =>
      useAddOpeningPosition({ store }),
    );

    act(() => {
      result.current.setAssetName("Reliance Industries");
      result.current.setSymbol("RELIANCE");
      result.current.setTicker("RELIANCE.NS");
      result.current.setQuantity("2");
      result.current.setAverageCostPrice("100");
      result.current.setCurrentPrice("120");
      result.current.setConviction("5");
      result.current.setNotes("Reset me");
    });
    act(() => {
      result.current.handleReview();
    });
    await act(async () => {
      await result.current.handleConfirm();
    });
    act(() => {
      result.current.startAnotherHolding();
    });

    expect(result.current.currentPhase).toBe("asset");
    expect(result.current.savedAssetId).toBe("");
    expect(result.current.assetName).toBe("");
    expect(result.current.quantity).toBe("");
    expect(result.current.currentPrice).toBe("");
    expect(result.current.conviction).toBe("");
    expect(result.current.notes).toBe("");
  });
});
