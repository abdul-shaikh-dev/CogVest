import * as Haptics from "expo-haptics";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AddTradeForm } from "@/src/features/trades/add-trade-form";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Trade } from "@/src/types";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: "success",
  },
}));

const existingAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const existingBuy: Trade = {
  assetId: existingAsset.id,
  date: "2026-04-20",
  id: "trade-existing",
  pricePerUnit: 100,
  quantity: 1,
  totalValue: 100,
  type: "buy",
};

describe("AddTradeForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a manual asset and persists a reviewed buy trade", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText } = render(
      <AddTradeForm store={store} />,
    );

    expect(getByTestId("add-trade-screen")).toBeTruthy();
    expect(getByTestId("asset-input")).toBeTruthy();
    expect(getByTestId("symbol-input")).toBeTruthy();
    expect(getByTestId("ticker-input")).toBeTruthy();
    expect(getByTestId("quantity-input")).toBeTruthy();
    expect(getByTestId("price-input")).toBeTruthy();
    expect(getByTestId("conviction-1")).toBeTruthy();
    expect(getByTestId("conviction-2")).toBeTruthy();
    expect(getByTestId("conviction-3")).toBeTruthy();
    expect(getByTestId("conviction-4")).toBeTruthy();
    expect(getByTestId("conviction-5")).toBeTruthy();
    expect(getByTestId("review-trade-button")).toBeTruthy();
    expect(getByTestId("save-trade-button")).toBeTruthy();

    fireEvent.changeText(getByLabelText("Asset name"), "Reliance Industries");
    fireEvent.changeText(getByLabelText("Symbol"), "RELIANCE");
    fireEvent.changeText(getByLabelText("Ticker"), "RELIANCE.NS");
    fireEvent.changeText(getByLabelText("Quantity"), "2");
    fireEvent.changeText(getByLabelText("Price per unit"), "100");
    fireEvent.changeText(getByLabelText("Fees"), "5");
    fireEvent.changeText(getByLabelText("Trade date"), "2026-04-20");
    fireEvent.press(getByTestId("conviction-4"));
    fireEvent.changeText(getByLabelText("Note"), "Core portfolio add");

    fireEvent.press(getByText("Review Trade"));
    expect(getByText("Review buy")).toBeTruthy();
    expect(getByText("Total: ₹205.00")).toBeTruthy();

    fireEvent.press(getByText("Confirm Trade"));

    await waitFor(() => {
      expect(store.getState().assets).toHaveLength(1);
      expect(store.getState().trades).toHaveLength(1);
    });

    expect(store.getState().assets[0]).toMatchObject({
      name: "Reliance Industries",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    });
    expect(store.getState().trades[0]).toMatchObject({
      assetId: store.getState().assets[0].id,
      conviction: 4,
      fees: 5,
      notes: "Core portfolio add",
      pricePerUnit: 100,
      quantity: 2,
      totalValue: 205,
      type: "buy",
    });
    expect(store.getState().quoteCache[store.getState().assets[0].id]).toMatchObject({
      price: 100,
      source: "manual",
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
    expect(getByText("Trade logged.")).toBeTruthy();
  });

  it("shows an actionable error for invalid sell quantity", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(existingAsset);
    store.getState().addTrade(existingBuy);

    const { getByLabelText, getByText } = render(<AddTradeForm store={store} />);

    fireEvent.press(getByText("Sell"));
    fireEvent.press(getByText("RELIANCE"));
    fireEvent.changeText(getByLabelText("Quantity"), "2");
    fireEvent.changeText(getByLabelText("Price per unit"), "100");
    fireEvent.changeText(getByLabelText("Trade date"), "2026-04-20");
    fireEvent.press(getByText("Review Trade"));

    expect(getByText("Sell quantity exceeds available units.")).toBeTruthy();
    expect(store.getState().trades).toEqual([existingBuy]);
  });

  it("prefills existing asset price from the quote cache", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(existingAsset);
    store.getState().upsertQuote({
      asOf: "2026-04-20T10:00:00.000Z",
      assetId: existingAsset.id,
      currency: "INR",
      price: 123.45,
      source: "yahoo",
    });

    const { getByDisplayValue, getByText } = render(<AddTradeForm store={store} />);

    fireEvent.press(getByText("RELIANCE"));

    expect(getByDisplayValue("123.45")).toBeTruthy();
  });
});
