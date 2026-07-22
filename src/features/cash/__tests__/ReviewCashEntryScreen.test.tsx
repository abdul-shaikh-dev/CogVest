import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ReviewCashEntryScreen } from "@/src/features/cash";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { CashEntry } from "@/src/types";

const manualEntry: CashEntry = {
  amount: 1000,
  date: "2026-07-20",
  id: "cash-manual",
  label: "Broker cash",
  notes: "Initial note",
  purpose: "capitalContribution",
  type: "addition",
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

  it("keeps linked investment movements read-only", () => {
    const { store } = createStore({
      ...manualEntry,
      id: "cash-trade-sale",
      linkedTradeId: "trade-sale",
      purpose: "saleProceeds",
    });
    const { getByText, queryByTestId } = render(
      <ReviewCashEntryScreen
        entryId="cash-trade-sale"
        onCancel={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    expect(getByText("Linked investment movement")).toBeTruthy();
    expect(
      getByText(/Correct the owning purchase or sale/),
    ).toBeTruthy();
    expect(queryByTestId("save-cash-correction-button")).toBeNull();
    expect(queryByTestId("delete-cash-entry-button")).toBeNull();
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
