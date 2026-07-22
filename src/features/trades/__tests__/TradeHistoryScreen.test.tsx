import { fireEvent, render } from "@testing-library/react-native";

import { TradeHistoryScreen } from "@/src/features/trades";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Trade } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-hdfc",
  name: "HDFC Bank",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

const trade: Trade = {
  assetId: asset.id,
  date: "2026-04-10",
  id: "trade-hdfc",
  pricePerUnit: 100,
  quantity: 2,
  totalValue: 200,
  type: "buy",
};

describe("TradeHistoryScreen", () => {
  it("lists the holding transaction with a review action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onReviewTrade = jest.fn();
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    const { getByTestId, getByText } = render(
      <TradeHistoryScreen
        assetId={asset.id}
        onBack={jest.fn()}
        onReviewTrade={onReviewTrade}
        store={store}
      />,
    );

    expect(getByText("Transaction history")).toBeTruthy();
    expect(getByText("Purchase")).toBeTruthy();
    fireEvent.press(getByTestId(`review-trade-${trade.id}`));
    expect(onReviewTrade).toHaveBeenCalledWith(trade.id);
  });

  it("shows a safe state for a missing holding", () => {
    const { getByText } = render(
      <TradeHistoryScreen
        assetId="missing"
        onBack={jest.fn()}
        onReviewTrade={jest.fn()}
        store={createPortfolioStore({ storage: createMemoryJsonStorage() })}
      />,
    );

    expect(getByText("Holding unavailable")).toBeTruthy();
  });

  it("does not expose transaction values while wealth masking is active", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    store.getState().updatePreferences({ maskWealthValues: true });
    const { getByText, queryByText } = render(
      <TradeHistoryScreen
        assetId={asset.id}
        onBack={jest.fn()}
        onReviewTrade={jest.fn()}
        store={store}
      />,
    );

    expect(getByText(/values masked/)).toBeTruthy();
    expect(queryByText("₹200.00")).toBeNull();
    expect(queryByText(/2 units at/)).toBeNull();
  });

  it("lists transactions across closed and active holdings", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    const { getByText } = render(
      <TradeHistoryScreen
        assetId=""
        onBack={jest.fn()}
        onReviewTrade={jest.fn()}
        store={store}
      />,
    );

    expect(getByText("1 record · local only")).toBeTruthy();
    expect(getByText("Purchase · HDFC Bank")).toBeTruthy();
  });
});
