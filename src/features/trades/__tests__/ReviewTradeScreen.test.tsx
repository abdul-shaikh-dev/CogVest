import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { ReviewTradeScreen } from "@/src/features/trades";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { Asset, CashEntry, Trade } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-hdfc",
  name: "HDFC Bank",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

const contribution: CashEntry = {
  amount: 10000,
  date: "2026-04-01",
  id: "cash-contribution",
  label: "Contribution",
  purpose: "capitalContribution",
  type: "addition",
};

const trade: Trade = {
  assetId: asset.id,
  conviction: 4,
  date: "2026-04-10",
  fees: 10,
  id: "trade-hdfc",
  notes: "Initial note",
  pricePerUnit: 100,
  quantity: 2,
  totalValue: 210,
  type: "buy",
};

function createStore() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({
    now: () => new Date(2026, 6, 22, 12),
    storage,
  });
  store.getState().addAsset(asset);
  store.getState().addCashEntry(contribution);
  store.getState().recordFundedBuy({ cashLabel: "HDFC purchase", trade });
  return { storage, store };
}

describe("ReviewTradeScreen", () => {
  it("corrects a transaction and linked cash once after rapid save presses", async () => {
    const { store } = createStore();
    const onComplete = jest.fn();
    const originalCorrection = store.getState().correctTrade;
    const correctionSpy = jest.fn(originalCorrection);
    store.setState({ correctTrade: correctionSpy });
    const { getByTestId, getByText } = render(
      <ReviewTradeScreen
        now={new Date(2026, 6, 22, 12)}
        onCancel={jest.fn()}
        onComplete={onComplete}
        store={store}
        tradeId={trade.id}
      />,
    );

    expect(getByText("Purchase")).toBeTruthy();
    fireEvent.changeText(getByTestId("trade-correction-quantity-input"), "3");
    fireEvent.changeText(getByTestId("trade-correction-price-input"), "120");
    expect(getByText("₹370.00")).toBeTruthy();
    const saveButton = getByTestId("save-trade-correction-button");
    fireEvent.press(saveButton);
    fireEvent.press(saveButton);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(correctionSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().trades[0]).toMatchObject({
      pricePerUnit: 120,
      quantity: 3,
      totalValue: 370,
    });
    expect(store.getState().cashEntries).toContainEqual(
      expect.objectContaining({ linkedTradeId: trade.id, amount: 370 }),
    );
  });

  it("requires confirmation and removes the transaction with linked cash", async () => {
    const { store } = createStore();
    const onComplete = jest.fn();
    const originalDeletion = store.getState().deleteTrade;
    const deletionSpy = jest.fn(originalDeletion);
    store.setState({ deleteTrade: deletionSpy });
    const { getByTestId, getByText } = render(
      <ReviewTradeScreen
        onCancel={jest.fn()}
        onComplete={onComplete}
        store={store}
        tradeId={trade.id}
      />,
    );

    fireEvent.press(getByTestId("delete-trade-button"));
    expect(getByText("Remove this transaction?")).toBeTruthy();
    const confirmButton = getByTestId("confirm-delete-trade-button");
    fireEvent.press(confirmButton);
    fireEvent.press(confirmButton);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(deletionSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().cashEntries).toEqual([contribution]);
  });

  it("retains edits and source records after persistence failure", async () => {
    const { storage, store } = createStore();
    storage.setItem = (key) => {
      if (key === portfolioStorageKey) throw new Error("simulated failure");
    };
    const { getByTestId, getByText } = render(
      <ReviewTradeScreen
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
        tradeId={trade.id}
      />,
    );

    fireEvent.changeText(getByTestId("trade-correction-quantity-input"), "4");
    fireEvent.press(getByTestId("save-trade-correction-button"));

    await waitFor(() => expect(getByText(/could not be saved safely/)).toBeTruthy());
    expect(getByTestId("trade-correction-quantity-input")).toHaveProp("value", "4");
    expect(store.getState().trades).toEqual([trade]);
  });

  it("handles a stale transaction ID safely", () => {
    const { getByText } = render(
      <ReviewTradeScreen
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={createPortfolioStore({ storage: createMemoryJsonStorage() })}
        tradeId="missing"
      />,
    );

    expect(getByText("Transaction unavailable")).toBeTruthy();
    expect(getByText("Back to Holdings")).toBeTruthy();
  });

  it("requires an explicit reveal while value masking is active", () => {
    const { store } = createStore();
    act(() => {
      store.getState().updatePreferences({ maskWealthValues: true });
    });
    const { getByTestId, getByText, queryByTestId } = render(
      <ReviewTradeScreen
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
        tradeId={trade.id}
      />,
    );

    expect(getByText("Reveal to review")).toBeTruthy();
    expect(queryByTestId("trade-correction-quantity-input")).toBeNull();
    fireEvent.press(getByTestId("reveal-trade-button"));
    expect(getByTestId("trade-correction-quantity-input")).toBeTruthy();
  });

  it("hides an open correction form when masking is enabled", async () => {
    const { store } = createStore();
    const { getByText, queryByTestId } = render(
      <ReviewTradeScreen
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
        tradeId={trade.id}
      />,
    );

    expect(queryByTestId("trade-correction-quantity-input")).toBeTruthy();
    act(() => {
      store.getState().updatePreferences({ maskWealthValues: true });
    });

    await waitFor(() => expect(getByText("Reveal to review")).toBeTruthy());
    expect(queryByTestId("trade-correction-quantity-input")).toBeNull();
  });

  it("describes an unlinked legacy transaction honestly", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(asset);
    store.getState().addTrade(trade);
    const { getByText } = render(
      <ReviewTradeScreen
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
        tradeId={trade.id}
      />,
    );

    expect(
      getByText("No cash movement is linked to this legacy transaction."),
    ).toBeTruthy();
  });
});
