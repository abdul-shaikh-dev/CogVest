import * as Haptics from "expo-haptics";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { AddOpeningPositionForm } from "@/src/features/openingPositions";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: "success",
  },
}));

describe("AddOpeningPositionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts on the Asset phase and hides later phase fields", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={store} />,
    );

    expect(getByTestId("add-holding-screen")).toBeTruthy();
    expect(getByTestId("add-holding-step-asset")).toBeTruthy();
    expect(getByTestId("add-holding-phase-asset")).toBeTruthy();
    expect(getByText("Continue to classification")).toBeTruthy();
    expect(queryByTestId("add-holding-phase-class")).toBeNull();
    expect(queryByTestId("add-holding-phase-position")).toBeNull();
    expect(queryByTestId("derived-preview")).toBeNull();
    expect(queryByTestId("quantity-input")).toBeNull();
  });

  it("validates the Asset phase before continuing", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={store} />,
    );

    fireEvent.press(getByText("Continue to classification"));

    expect(queryByTestId("add-holding-phase-class")).toBeNull();
    expect(getByText("Asset name is required.")).toBeTruthy();
    expect(getByText("Symbol is required.")).toBeTruthy();
    expect(getByText("Ticker is required.")).toBeTruthy();
  });

  it("moves through Asset, Class, Position, and Review phases", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AddOpeningPositionForm store={store} />,
    );

    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.changeText(getByLabelText("Quote source ID"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to classification"));

    expect(getByTestId("add-holding-phase-class")).toBeTruthy();
    expect(queryByTestId("add-holding-phase-asset")).toBeNull();

    fireEvent.press(getByText("Continue to position"));
    expect(getByTestId("add-holding-phase-position")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Quantity"), "25");
    fireEvent.changeText(getByLabelText("Average cost"), "1450");
    fireEvent.changeText(getByLabelText("Current price"), "1678.25");
    fireEvent.changeText(getByLabelText("Date acquired"), "2026-04-15");
    fireEvent.press(getByText("Review Holding"));

    expect(getByTestId("add-holding-phase-review")).toBeTruthy();
    expect(getByTestId("derived-preview")).toBeTruthy();
  });

  it("allows returning to completed phases before saving", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm store={store} />,
    );

    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.changeText(getByLabelText("Quote source ID"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to classification"));
    fireEvent.press(getByText("Continue to position"));
    fireEvent.press(getByText("Back"));

    expect(getByTestId("add-holding-phase-class")).toBeTruthy();

    fireEvent.press(getByTestId("add-holding-step-asset"));

    expect(getByTestId("add-holding-phase-asset")).toBeTruthy();
    expect(getByLabelText("Asset name")).toHaveProp(
      "value",
      "Reliance Industries",
    );
  });

  it("creates a manual asset and persists a reviewed opening position", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm store={store} />,
    );

    expect(getByTestId("add-holding-screen")).toBeTruthy();
    expect(getByTestId("asset-input")).toBeTruthy();
    expect(getByTestId("symbol-input")).toBeTruthy();
    expect(getByTestId("ticker-input")).toBeTruthy();
    expect(getByTestId("quote-source-id-input")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.changeText(getByLabelText("Quote source ID"), "RELIANCE.NS");
    fireEvent.press(getByText("Continue to classification"));

    expect(getByTestId("asset-class-stock")).toBeTruthy();
    expect(getByTestId("instrument-type-input")).toBeTruthy();
    expect(getByTestId("sector-type-input")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Instrument type"), "stock");
    fireEvent.changeText(getByLabelText("Sector type"), "energy");
    fireEvent.press(getByText("Continue to position"));

    expect(getByTestId("quantity-input")).toBeTruthy();
    expect(getByTestId("average-cost-input")).toBeTruthy();
    expect(getByTestId("price-input")).toBeTruthy();
    expect(getByTestId("date-input")).toBeTruthy();
    expect(getByTestId("review-holding-button")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Quantity"), "25");
    fireEvent.changeText(getByLabelText("Average cost"), "1450");
    fireEvent.changeText(getByLabelText("Current price"), "1678.25");
    fireEvent.changeText(getByLabelText("Date acquired"), "2026-04-15");
    fireEvent.press(getByTestId("conviction-4"));
    fireEvent.changeText(getByLabelText("Note"), "Excel opening position");

    fireEvent.press(getByText("Review Holding"));
    expect(getByTestId("derived-preview")).toBeTruthy();
    expect(getByText("₹36,250.00")).toBeTruthy();
    expect(getByText("₹41,956.25")).toBeTruthy();
    expect(getByText("+₹5,706.25")).toBeTruthy();
    expect(getByTestId("save-holding-button")).toBeTruthy();

    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().assets).toHaveLength(1);
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    expect(store.getState().assets[0]).toMatchObject({
      assetClass: "stock",
      instrumentType: "stock",
      name: "Reliance Industries",
      quoteSourceId: "RELIANCE.NS",
      sectorType: "energy",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    });
    expect(store.getState().openingPositions[0]).toMatchObject({
      assetId: store.getState().assets[0].id,
      averageCostPrice: 1450,
      conviction: 4,
      currentPrice: 1678.25,
      notes: "Excel opening position",
      quantity: 25,
    });
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().quoteCache[store.getState().assets[0].id]).toMatchObject({
      price: 1678.25,
      source: "manual",
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
    expect(getByText("Opening position saved.")).toBeTruthy();
  });

  it("creates a debt opening position without trade records", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm store={store} />,
    );

    fireEvent.changeText(getByLabelText("Asset name"), "Sovereign Gold Bond");
    fireEvent.changeText(getByLabelText("Symbol"), "SGB");
    fireEvent.changeText(getByLabelText("Ticker"), "SGB");
    fireEvent.changeText(getByLabelText("Quote source ID"), "SGB");
    fireEvent.press(getByText("Continue to classification"));
    fireEvent.press(getByTestId("asset-class-debt"));
    fireEvent.changeText(getByLabelText("Instrument type"), "ppf");
    fireEvent.press(getByText("Continue to position"));
    fireEvent.changeText(getByLabelText("Quantity"), "10");
    fireEvent.changeText(getByLabelText("Average cost"), "5300");
    fireEvent.changeText(getByLabelText("Current price"), "5711");
    fireEvent.changeText(getByLabelText("Date acquired"), "2026-04-15");

    fireEvent.press(getByText("Review Holding"));
    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    expect(store.getState().assets[0]?.assetClass).toBe("debt");
    expect(store.getState().assets[0]?.instrumentType).toBe("ppf");
    expect(store.getState().assets[0]?.sectorType).toBe("fixedIncome");
    expect(store.getState().trades).toEqual([]);
  });

  it("creates a crypto opening position with a case-sensitive quote source", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm store={store} />,
    );

    fireEvent.changeText(getByLabelText("Asset name"), "Bitcoin");
    fireEvent.changeText(getByLabelText("Symbol"), "BTC");
    fireEvent.changeText(getByLabelText("Ticker"), "bitcoin");
    fireEvent.changeText(getByLabelText("Quote source ID"), "bitcoin");
    fireEvent.press(getByText("Continue to classification"));
    fireEvent.press(getByTestId("asset-class-crypto"));
    fireEvent.press(getByText("Continue to position"));
    fireEvent.changeText(getByLabelText("Quantity"), "0.05");
    fireEvent.changeText(getByLabelText("Average cost"), "5000000");
    fireEvent.changeText(getByLabelText("Current price"), "5800000");
    fireEvent.changeText(getByLabelText("Date acquired"), "2026-04-15");

    fireEvent.press(getByText("Review Holding"));
    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    expect(store.getState().assets[0]).toMatchObject({
      assetClass: "crypto",
      exchange: "CRYPTO",
      instrumentType: "crypto",
      quoteSourceId: "bitcoin",
      sectorType: "digitalAsset",
      ticker: "bitcoin",
    });
  });

  it("autofills asset metadata and current price from a selected lookup result", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockImplementation(({ asset }) =>
      Promise.resolve({
        ok: true,
        quote: {
          assetId: asset.id,
          asOf: "2026-05-10T10:00:00.000Z",
          currency: "INR",
          price: 1678.25,
          source: "yahoo",
        },
      }),
    );
    const { getByLabelText, getByText } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "hdfc bank");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(getByText("HDFC Bank Limited")).toBeTruthy();
    });

    fireEvent.press(getByText("HDFC Bank Limited"));

    await waitFor(() => {
      expect(getByLabelText("Asset name")).toHaveProp(
        "value",
        "HDFC Bank Limited",
      );
    });
    expect(getByLabelText("Symbol")).toHaveProp("value", "HDFCBANK");
    expect(getByLabelText("Ticker")).toHaveProp("value", "HDFCBANK.NS");
    expect(getByLabelText("Quote source ID")).toHaveProp(
      "value",
      "HDFCBANK.NS",
    );
    expect(getByText("Live price autofilled from Yahoo Finance.")).toBeTruthy();
    fireEvent.press(getByText("Continue to classification"));
    fireEvent.press(getByText("Continue to position"));
    expect(getByLabelText("Current price")).toHaveProp("value", "1678.25");
  });

  it("keeps manual price fallback available when selected lookup quote fails", async () => {
    jest.useFakeTimers();
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const lookupResult: AssetLookupResult = {
      assetClass: "crypto",
      currency: "INR",
      exchange: "CRYPTO",
      id: "coingecko:bitcoin",
      instrumentType: "crypto",
      name: "Bitcoin",
      provider: "coingecko",
      quoteSourceId: "bitcoin",
      sectorType: "digitalAsset",
      sourceLabel: "CoinGecko",
      symbol: "BTC",
      ticker: "bitcoin",
    };
    const searchAssetLookupResults = jest.fn().mockResolvedValue({
      failures: [],
      results: [lookupResult],
    });
    const resolveQuote = jest.fn().mockResolvedValue({
      error: "CoinGecko quote response did not include an INR price.",
      ok: false,
    });
    const { getByLabelText, getByText } = render(
      <AddOpeningPositionForm
        resolveQuote={resolveQuote}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.changeText(getByLabelText("Search asset"), "bitcoin");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(getByText("Bitcoin")).toBeTruthy();
    });

    fireEvent.press(getByText("Bitcoin"));

    await waitFor(() => {
      expect(getByLabelText("Asset name")).toHaveProp("value", "Bitcoin");
      expect(
        getByText("Live price unavailable. Enter current price manually."),
      ).toBeTruthy();
    });
    fireEvent.press(getByText("Continue to classification"));
    fireEvent.press(getByText("Continue to position"));
    expect(getByLabelText("Current price")).toHaveProp("value", "");
  });
});
