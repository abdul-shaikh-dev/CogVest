import * as Haptics from "expo-haptics";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AddOpeningPositionForm } from "@/src/features/openingPositions";
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

  it("creates a manual asset and persists a reviewed opening position", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddOpeningPositionForm store={store} />,
    );

    expect(getByTestId("add-holding-screen")).toBeTruthy();
    expect(getByTestId("asset-class-stock")).toBeTruthy();
    expect(getByTestId("asset-input")).toBeTruthy();
    expect(getByTestId("symbol-input")).toBeTruthy();
    expect(getByTestId("ticker-input")).toBeTruthy();
    expect(getByTestId("quantity-input")).toBeTruthy();
    expect(getByTestId("average-cost-input")).toBeTruthy();
    expect(getByTestId("price-input")).toBeTruthy();
    expect(getByTestId("date-input")).toBeTruthy();
    expect(getByTestId("review-holding-button")).toBeTruthy();
    expect(getByTestId("save-holding-button")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
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

    fireEvent.press(getByText("Save Holding"));

    await waitFor(() => {
      expect(store.getState().assets).toHaveLength(1);
      expect(store.getState().openingPositions).toHaveLength(1);
    });

    expect(store.getState().assets[0]).toMatchObject({
      assetClass: "stock",
      name: "Reliance Industries",
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

    fireEvent.press(getByTestId("asset-class-debt"));
    fireEvent.changeText(getByLabelText("Asset name"), "Sovereign Gold Bond");
    fireEvent.changeText(getByLabelText("Symbol"), "SGB");
    fireEvent.changeText(getByLabelText("Ticker"), "SGB");
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
    expect(store.getState().trades).toEqual([]);
  });
});
