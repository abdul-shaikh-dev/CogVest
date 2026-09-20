import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { ReviewCashEntryScreen } from "@/src/features/cash";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { Asset, CashEntry, Trade } from "@/src/types";

const manualEntry: CashEntry = {
  amount: 1000,
  date: "2026-07-20",
  id: "cash-manual",
  label: "Broker cash",
  notes: "Initial note",
  purpose: "capitalContribution",
  type: "addition",
};

const linkedAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-hdfc",
  name: "HDFC Bank",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

const linkedBuy: Trade = {
  assetId: linkedAsset.id,
  date: "2026-07-20",
  id: "trade-buy",
  pricePerUnit: 500,
  quantity: 2,
  totalValue: 1000,
  type: "buy",
};

function createStore(entry: CashEntry = manualEntry) {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage });
  store.getState().addCashEntry(entry);

  return { storage, store };
}

describe("ReviewCashEntryScreen", () => {
  it("edits a manual entry once after rapid repeated save presses", async () => {
    const { store } = createStore();
    const onComplete = jest.fn();
    const originalCorrection = store.getState().correctManualCashEntry;
    const correctionSpy = jest
      .fn(originalCorrection)
      .mockName("correctManualCashEntry");
    store.setState({ correctManualCashEntry: correctionSpy });
    const { getByTestId } = render(
      <ReviewCashEntryScreen
        entryId={manualEntry.id}
        now={new Date(2026, 6, 22, 12)}
        onCancel={jest.fn()}
        onComplete={onComplete}
        store={store}
      />,
    );

    fireEvent.changeText(
      getByTestId("cash-correction-amount-input"),
      "1250",
    );
    fireEvent.changeText(
      getByTestId("cash-correction-label-input"),
      "Corrected broker cash",
    );
    fireEvent.press(getByTestId("save-cash-correction-button"));
    fireEvent.press(getByTestId("save-cash-correction-button"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(correctionSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({
        amount: 1250,
        id: manualEntry.id,
        label: "Corrected broker cash",
      }),
    ]);
  });

  it("changes a deposit into a withdrawal with the correct purpose", async () => {
    const { store } = createStore();
    const { getByTestId } = render(
      <ReviewCashEntryScreen
        entryId={manualEntry.id}
        now={new Date(2026, 6, 22, 12)}
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("cash-correction-type-withdrawal"));
    fireEvent.press(getByTestId("save-cash-correction-button"));

    await waitFor(() => {
      expect(store.getState().cashEntries[0]).toMatchObject({
        purpose: "withdrawal",
        type: "withdrawal",
      });
    });
  });

  it("requires confirmation before deleting a manual entry", async () => {
    const { store } = createStore();
    const onComplete = jest.fn();
    const originalDeletion = store.getState().deleteManualCashEntry;
    const deletionSpy = jest
      .fn(originalDeletion)
      .mockName("deleteManualCashEntry");
    store.setState({ deleteManualCashEntry: deletionSpy });
    const { getByTestId, getByText, queryByText } = render(
      <ReviewCashEntryScreen
        entryId={manualEntry.id}
        onCancel={jest.fn()}
        onComplete={onComplete}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("delete-cash-entry-button"));
    expect(getByText("Delete this cash entry?")).toBeTruthy();
    expect(store.getState().cashEntries).toHaveLength(1);

    const confirmDeleteButton = getByTestId(
      "confirm-delete-cash-entry-button",
    );
    fireEvent.press(confirmDeleteButton);
    fireEvent.press(confirmDeleteButton);

    await waitFor(() => {
      expect(store.getState().cashEntries).toEqual([]);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(deletionSpy).toHaveBeenCalledTimes(1);
    expect(queryByText("Delete this cash entry?")).toBeNull();
  });

  it("explains the metric impact of a migrated uncategorized deposit", () => {
    const { store } = createStore({
      ...manualEntry,
      purpose: "legacyUncategorized",
    });
    const { getByText } = render(
      <ReviewCashEntryScreen
        entryId={manualEntry.id}
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    expect(getByText("Uncategorized")).toBeTruthy();
    expect(getByText(/investment-rate insights unavailable/)).toBeTruthy();
  });

  it.each([
    { purpose: "purchaseFunding" as const, trade: linkedBuy, typeLabel: "Purchase" },
    { purpose: "saleProceeds" as const, trade: { ...linkedBuy, id: "trade-sale", type: "sell" as const }, typeLabel: "Sale" },
  ])("routes a linked $typeLabel through its owning transaction", ({ purpose, trade, typeLabel }) => {
    const { store } = createStore({
      ...manualEntry,
      id: `cash-${trade.id}`,
      linkedTradeId: trade.id,
      purpose,
    });
    store.getState().addAsset(linkedAsset);
    store.getState().addTrade(trade);
    const onCancel = jest.fn();
    const onReviewLinkedTrade = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <ReviewCashEntryScreen
        entryId={`cash-${trade.id}`}
        onCancel={onCancel}
        onComplete={jest.fn()}
        onReviewLinkedTrade={onReviewLinkedTrade}
        store={store}
      />,
    );

    expect(getByText("Linked investment movement")).toBeTruthy();
    expect(getByTestId("linked-cash-owner-summary")).toHaveTextContent(new RegExp(`HDFC Bank · ${typeLabel} ·`, "u"));
    expect(queryByTestId("save-cash-correction-button")).toBeNull();
    expect(queryByTestId("delete-cash-entry-button")).toBeNull();
    fireEvent.press(getByTestId("review-linked-cash-transaction"));
    expect(onReviewLinkedTrade).toHaveBeenCalledWith(trade.id);
    fireEvent.press(getByText("Back to Cash Ledger"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps a stale linked movement read-only and explains recovery", () => {
    const { store } = createStore({
      ...manualEntry,
      id: "cash-missing-trade",
      linkedTradeId: "trade-missing",
      purpose: "purchaseFunding",
    });
    const screen = render(
      <ReviewCashEntryScreen
        entryId="cash-missing-trade"
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        onReviewLinkedTrade={jest.fn()}
        store={store}
      />,
    );

    expect(screen.getByText("Linked transaction unavailable")).toBeTruthy();
    expect(screen.getByTestId("linked-cash-owner-missing")).toHaveTextContent(/no longer available/u);
    expect(screen.getByText(/Restore a backup or reimport the complete source history/u)).toBeTruthy();
    expect(screen.queryByTestId("review-linked-cash-transaction")).toBeNull();
    expect(screen.queryByTestId("save-cash-correction-button")).toBeNull();
  });

  it("does not reveal linked transaction values while wealth masking is active", () => {
    const { store } = createStore({
      ...manualEntry,
      id: "cash-trade-buy",
      linkedTradeId: linkedBuy.id,
      purpose: "purchaseFunding",
    });
    store.getState().addAsset(linkedAsset);
    store.getState().addTrade(linkedBuy);
    store.getState().updatePreferences({ maskWealthValues: true });
    const screen = render(
      <ReviewCashEntryScreen
        entryId="cash-trade-buy"
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        onReviewLinkedTrade={jest.fn()}
        store={store}
      />,
    );

    expect(screen.getByTestId("review-linked-cash-transaction")).toBeTruthy();
    expect(screen.queryByText(/₹|1,000|500\.00/u)).toBeNull();
  });

  it("requires reveal for a saved amount and resets when masking returns", async () => {
    const { store } = createStore();
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    const screen = render(
      <ReviewCashEntryScreen
        entryId={manualEntry.id}
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    expect(screen.getByText("Reveal to review")).toBeTruthy();
    expect(screen.queryByTestId("cash-correction-amount-input")).toBeNull();
    expect(screen.queryByText("1000")).toBeNull();

    fireEvent.press(screen.getByTestId("reveal-cash-entry-button"));
    expect(screen.getByTestId("cash-correction-amount-input")).toHaveProp(
      "value",
      "1000",
    );

    act(() => store.getState().updatePreferences({ maskWealthValues: false }));
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));

    await waitFor(() => {
      expect(screen.getByText("Reveal to review")).toBeTruthy();
      expect(screen.queryByTestId("cash-correction-amount-input")).toBeNull();
    });
  });

  it("handles a stale entry ID safely", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByText } = render(
      <ReviewCashEntryScreen
        entryId="cash-missing"
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    expect(getByText("Cash entry unavailable")).toBeTruthy();
    expect(getByText("Back to Cash Ledger")).toBeTruthy();
  });

  it("retains the form and original entry after persistence failure", async () => {
    const { storage, store } = createStore();
    const originalSetItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === portfolioStorageKey) {
        throw new Error("simulated cash correction failure");
      }

      originalSetItem(key, value);
    };
    const { getByTestId, getByText } = render(
      <ReviewCashEntryScreen
        entryId={manualEntry.id}
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    fireEvent.changeText(
      getByTestId("cash-correction-amount-input"),
      "2250",
    );
    fireEvent.press(getByTestId("save-cash-correction-button"));

    await waitFor(() => {
      expect(
        getByText(
          "This cash entry could not be saved safely. Review it and try again.",
        ),
      ).toBeTruthy();
    });
    expect(store.getState().cashEntries).toEqual([manualEntry]);
    expect(getByTestId("cash-correction-amount-input")).toHaveProp(
      "value",
      "2250",
    );
  });
});
