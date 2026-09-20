import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Modal } from "react-native";

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
  it("shows realized gain separately from net proceeds even after a full exit", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    store.getState().addTrade({ ...trade, id: "sale", date: "2026-04-11", type: "sell", pricePerUnit: 150, fees: 5, totalValue: 295 });
    const screen = render(<TradeHistoryScreen assetId="" onBack={jest.fn()} onReviewTrade={jest.fn()} store={store} />);
    expect(screen.getByText("Net ₹295.00")).toBeTruthy();
    expect(screen.getByText(/Realized gain \+₹95.00 · after fees/)).toBeTruthy();
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    screen.rerender(<TradeHistoryScreen assetId="" onBack={jest.fn()} onReviewTrade={jest.fn()} store={store} />);
    expect(screen.queryByText(/₹95.00/)).toBeNull();
    expect(screen.queryByText(/₹295.00/)).toBeNull();
  });

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

  it("renders imported transfers without inventing a price or total", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const transfer: Trade = {
      acquisitionCostPerUnit: 150,
      assetId: asset.id,
      date: "2026-04-11",
      id: "transfer-in-hdfc",
      quantity: 3,
      type: "transferIn",
    };
    store.getState().addAsset(asset);
    store.getState().addTrade(transfer);
    const { getByText, queryByText } = render(
      <TradeHistoryScreen
        assetId={asset.id}
        onBack={jest.fn()}
        onReviewTrade={jest.fn()}
        store={store}
      />,
    );

    expect(getByText("Transfer in")).toBeTruthy();
    expect(getByText(/acquisition basis 150 per unit/)).toBeTruthy();
    expect(queryByText("₹450.00")).toBeNull();
  });

  it("selects, previews, cancels, and confirms a scoped bulk deletion", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onBack = jest.fn();
    store.getState().addAsset(asset);
    store.getState().addCashEntry({ amount: 1000, date: "2026-04-01", id: "cash", label: "Cash", purpose: "capitalContribution", type: "addition" });
    store.getState().recordFundedBuy({ cashLabel: "Purchase", trade });
    const screen = render(<TradeHistoryScreen assetId={asset.id} onBack={onBack} onReviewTrade={jest.fn()} store={store} />);

    fireEvent.press(screen.getByTestId("start-transaction-selection"));
    expect(screen.getByText("0 selected")).toBeTruthy();
    fireEvent.press(screen.getByTestId(`review-trade-${trade.id}`));
    expect(screen.getByTestId(`review-trade-${trade.id}`).props.accessibilityState).toEqual({ checked: true });
    fireEvent.press(screen.getByTestId("review-selected-transaction-deletion"));
    expect(screen.getByText("The transaction shown on this screen is selected.")).toBeTruthy();
    expect(screen.getByText(/1 linked cash movement will be removed/u)).toBeTruthy();

    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(store.getState().trades).toHaveLength(1);
    fireEvent.press(screen.getByTestId("review-selected-transaction-deletion"));
    fireEvent.press(screen.getByTestId("confirm-delete-selected-transactions"));
    await waitFor(() => expect(store.getState().trades).toEqual([]));
    expect(store.getState().cashEntries).toEqual([expect.objectContaining({ id: "cash" })]);
    expect(screen.getByText(/1 transaction removed/u)).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("clears selection without navigating and labels select-all scope", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onBack = jest.fn();
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    store.getState().addTrade({ ...trade, date: "2026-05-10", id: "second" });
    const screen = render(<TradeHistoryScreen assetId={asset.id} onBack={onBack} onReviewTrade={jest.fn()} store={store} />);

    fireEvent.press(screen.getByTestId("start-transaction-selection"));
    fireEvent.press(screen.getByTestId("select-all-transactions"));
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel selection"));
    expect(screen.getByText("Transaction history")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    expect(store.getState().trades).toHaveLength(2);
  });

  it("announces distinct same-date transactions with identity, detail, and selection state", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const secondAsset: Asset = {
      ...asset,
      id: "asset-reliance",
      name: "Reliance Industries",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    };
    const sameDateTrade: Trade = {
      ...trade,
      assetId: secondAsset.id,
      id: "trade-reliance",
      pricePerUnit: 2500,
      quantity: 3,
      totalValue: 7500,
    };
    store.getState().addAsset(asset);
    store.getState().addAsset(secondAsset);
    store.getState().addTrade(trade);
    store.getState().addTrade(sameDateTrade);
    const screen = render(<TradeHistoryScreen assetId="" onBack={jest.fn()} onReviewTrade={jest.fn()} store={store} />);

    fireEvent.press(screen.getByTestId("start-transaction-selection"));
    expect(screen.getByTestId("transaction-selection-count").props.accessibilityLiveRegion).toBe("polite");
    expect(screen.getByTestId(`review-trade-${trade.id}`).props.accessibilityLabel).toMatch(
      /Not selected, HDFC Bank, Purchase, .*2 units at ₹100\.00, total ₹200\.00, transaction 1 of 2/u,
    );
    expect(screen.getByTestId(`review-trade-${sameDateTrade.id}`).props.accessibilityLabel).toMatch(
      /Not selected, Reliance Industries, Purchase, .*3 units at ₹2,500\.00, total ₹7,500\.00, transaction 2 of 2/u,
    );

    fireEvent.press(screen.getByTestId(`review-trade-${sameDateTrade.id}`));
    expect(screen.getByTestId(`review-trade-${sameDateTrade.id}`).props.accessibilityLabel).toMatch(/^Selected,/u);
    expect(screen.getByTestId("transaction-selection-count")).toHaveTextContent("1 selected");
  });

  it("keeps financial detail out of accessible selection labels while values are masked", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    store.getState().updatePreferences({ maskWealthValues: true });
    const screen = render(<TradeHistoryScreen assetId="" onBack={jest.fn()} onReviewTrade={jest.fn()} store={store} />);

    fireEvent.press(screen.getByTestId("start-transaction-selection"));
    const label = screen.getByTestId(`review-trade-${trade.id}`).props.accessibilityLabel as string;
    expect(label).toMatch(/Not selected, HDFC Bank, Purchase, .*values masked, transaction 1 of 1/u);
    expect(label).not.toMatch(/₹|2 units|100|200/u);
  });

  it("blocks a partial deletion that would leave a negative position", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const sale: Trade = { ...trade, date: "2026-05-10", id: "sale", type: "sell" };
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    store.getState().addTrade(sale);
    const screen = render(<TradeHistoryScreen assetId={asset.id} onBack={jest.fn()} onReviewTrade={jest.fn()} store={store} />);

    fireEvent.press(screen.getByTestId("start-transaction-selection"));
    fireEvent.press(screen.getByTestId(`review-trade-${trade.id}`));
    fireEvent.press(screen.getByTestId("review-selected-transaction-deletion"));
    expect(screen.getByTestId("transaction-deletion-blocked")).toHaveTextContent(/more disposals than available units/u);
    expect(screen.queryByTestId("confirm-delete-selected-transactions")).toBeNull();
    expect(store.getState().trades).toHaveLength(2);
  });
});
