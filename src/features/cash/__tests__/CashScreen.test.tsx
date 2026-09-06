import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Keyboard, Modal } from "react-native";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { CashScreen } from "@/src/features/cash";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";

function selectDate(
  getByTestId: ReturnType<typeof render>["getByTestId"],
  value: string,
) {
  const [year, month, day] = value.split("-").map(Number);

  fireEvent.press(getByTestId("cash-date-input"));
  fireEvent(
    getByTestId("cash-date-input-picker"),
    "onChange",
    { nativeEvent: { timestamp: new Date(year, month - 1, day, 12).getTime() } },
  );
}

describe("CashScreen", () => {
  it("shows an empty cash state with zero balance", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    const { getAllByText, getByTestId, getByText, queryByTestId } = render(<CashScreen store={store} />);

    expect(getByTestId("cash-screen")).toBeTruthy();
    expect(getByTestId("cash-entry-deposit")).toBeTruthy();
    expect(getByTestId("cash-entry-withdraw")).toBeTruthy();
    expect(queryByTestId("cash-entry-form")).toBeNull();
    expect(getAllByText("₹0.00").length).toBeGreaterThan(0);
    expect(getByText("No cash movement yet")).toBeTruthy();
    expect(getByText("Add broker or bank cash only when it should count toward portfolio value.")).toBeTruthy();
  });

  it("adds and withdraws cash and shows history rows", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getAllByText, getByLabelText, getByTestId, getByText } = render(<CashScreen store={store} />);

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.changeText(getByLabelText("Amount"), "1000");
    fireEvent.changeText(getByLabelText("Label"), "Broker cash");
    selectDate(getByTestId, "2026-04-20");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(getAllByText("₹1,000.00").length).toBeGreaterThan(0);
      expect(getByText("Broker cash")).toBeTruthy();
      expect(getByText("Capital added to deployable cash")).toBeTruthy();
      expect(getByText("+₹1,000.00")).toBeTruthy();
      expect(store.getState().cashEntries).toEqual([
        expect.objectContaining({
          amount: 1000,
          purpose: "capitalContribution",
          type: "addition",
        }),
      ]);
    });
    expect(() => getByTestId("cash-entry-form")).toThrow();

    fireEvent.press(getByText("Withdraw"));
    fireEvent.changeText(getByLabelText("Amount"), "250");
    fireEvent.changeText(getByLabelText("Label"), "Emergency withdrawal");
    selectDate(getByTestId, "2026-04-21");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(getAllByText("₹750.00").length).toBeGreaterThan(0);
      expect(getByText("Emergency withdrawal")).toBeTruthy();
      expect(getByText("Withdrawn from deployable cash")).toBeTruthy();
      expect(getByText("-₹250.00")).toBeTruthy();
      expect(store.getState().cashEntries).toEqual([
        expect.objectContaining({
          amount: 1000,
          purpose: "capitalContribution",
          type: "addition",
        }),
        expect.objectContaining({
          amount: 250,
          purpose: "withdrawal",
          type: "withdrawal",
        }),
      ]);
    });
  });

  it("changes the cash entry form copy when switching between deposit and withdraw", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText, queryByText } = render(
      <CashScreen store={store} />,
    );

    expect(getByText("Included in portfolio")).toBeTruthy();
    expect(queryByText("Balance ₹0")).toBeNull();
    expect(queryByText("No movement yet")).toBeNull();
    expect(queryByText("Deposit cash")).toBeNull();
    expect(queryByText("Save deposit")).toBeNull();

    fireEvent.press(getByText("Deposit"));

    expect(getByText("Deposit cash")).toBeTruthy();
    expect(getByText("Add money that is available for future investment.")).toBeTruthy();
    expect(getByText("Adds balance")).toBeTruthy();
    expect(getByText("Save deposit")).toBeTruthy();
    expect(queryByText("Save Cash Entry")).toBeNull();

    fireEvent.press(getByTestId("close-cash-entry-button"));
    fireEvent.press(getByText("Withdraw"));

    expect(getByText("Withdraw cash")).toBeTruthy();
    expect(getByText("Record money leaving the portfolio cash pool.")).toBeTruthy();
    expect(getByText("Reduces balance")).toBeTruthy();
    expect(getByText("Save withdrawal")).toBeTruthy();
    expect(queryByText("Deposit cash")).toBeNull();
  });

  it("resumes a same-type draft with its date, purpose, and fields", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <CashScreen now={new Date(2026, 3, 22, 12)} store={store} />,
    );

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.press(getByTestId("cash-purpose-income"));
    fireEvent.changeText(getByLabelText("Amount"), "1250");
    fireEvent.changeText(getByLabelText("Label"), "April salary");
    fireEvent.changeText(getByLabelText("Notes"), "Keep for the next buy");
    selectDate(getByTestId, "2026-04-20");
    fireEvent.press(getByTestId("close-cash-entry-button"));

    expect(queryByTestId("cash-entry-modal")).toBeNull();
    expect(store.getState().cashEntries).toEqual([]);

    fireEvent.press(getByTestId("cash-entry-deposit"));

    expect(getByTestId("cash-entry-modal")).toBeTruthy();
    expect(getByLabelText("Amount")).toHaveProp("value", "1250");
    expect(getByLabelText("Label")).toHaveProp("value", "April salary");
    expect(getByLabelText("Notes")).toHaveProp(
      "value",
      "Keep for the next buy",
    );
    expect(getByText("20 Apr 2026")).toBeTruthy();
    expect(getByTestId("cash-purpose-income")).toHaveProp(
      "accessibilityState",
      { selected: true },
    );
  });

  it("requires explicit discard before switching a nonempty draft type", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText, queryByText } = render(
      <CashScreen store={store} />,
    );

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.changeText(getByLabelText("Amount"), "1000");
    fireEvent.changeText(getByLabelText("Label"), "Do not reinterpret");
    fireEvent.press(getByTestId("close-cash-entry-button"));
    fireEvent.press(getByTestId("cash-entry-withdraw"));

    expect(getByTestId("cash-discard-draft-button")).toBeTruthy();
    expect(getByTestId("cash-keep-draft-button")).toBeTruthy();

    fireEvent.press(getByTestId("cash-keep-draft-button"));
    expect(queryByText("Deposit cash")).toBeNull();
    expect(queryByText("Withdraw cash")).toBeNull();
    expect(store.getState().cashEntries).toEqual([]);

    fireEvent.press(getByTestId("cash-entry-deposit"));
    expect(getByText("Deposit cash")).toBeTruthy();
    expect(getByLabelText("Amount")).toHaveProp("value", "1000");
    expect(getByLabelText("Label")).toHaveProp("value", "Do not reinterpret");
    fireEvent.press(getByTestId("close-cash-entry-button"));
    fireEvent.press(getByTestId("cash-entry-withdraw"));
    fireEvent.press(getByTestId("cash-discard-draft-button"));

    expect(getByText("Withdraw cash")).toBeTruthy();
    expect(getByLabelText("Amount")).toHaveProp("value", "");
    expect(getByLabelText("Label")).toHaveProp("value", "");
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("closes from Android back without saving and retains the draft", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(<CashScreen store={store} />);

    fireEvent.press(screen.getByTestId("cash-entry-deposit"));
    fireEvent.changeText(screen.getByLabelText("Amount"), "900");
    fireEvent.changeText(screen.getByLabelText("Label"), "Back draft");

    act(() => {
      screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose();
    });

    expect(screen.queryByTestId("cash-entry-modal")).toBeNull();
    expect(store.getState().cashEntries).toEqual([]);

    fireEvent.press(screen.getByTestId("cash-entry-deposit"));
    expect(screen.getByLabelText("Amount")).toHaveProp("value", "900");
    expect(screen.getByLabelText("Label")).toHaveProp("value", "Back draft");
  });

  it("dismisses the visible keyboard before closing the modal on Android back", () => {
    const keyboardVisibility = jest
      .spyOn(Keyboard, "isVisible")
      .mockReturnValue(true);
    const keyboardDismiss = jest
      .spyOn(Keyboard, "dismiss")
      .mockImplementation(() => undefined);

    try {
      const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
      const screen = render(<CashScreen store={store} />);

      fireEvent.press(screen.getByTestId("cash-entry-deposit"));
      fireEvent.changeText(screen.getByLabelText("Amount"), "900");
      fireEvent.changeText(screen.getByLabelText("Label"), "Keyboard draft");

      act(() => {
        screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose();
      });

      expect(keyboardVisibility).toHaveBeenCalled();
      expect(keyboardDismiss).toHaveBeenCalled();
      expect(screen.getByTestId("cash-entry-modal")).toBeTruthy();
      expect(screen.getByLabelText("Amount")).toHaveProp("value", "900");
      expect(screen.getByLabelText("Label")).toHaveProp(
        "value",
        "Keyboard draft",
      );
      expect(store.getState().cashEntries).toEqual([]);

      keyboardVisibility.mockClear();
      keyboardDismiss.mockClear();
      keyboardVisibility.mockReturnValue(false);
      act(() => {
        screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose();
      });

      expect(keyboardVisibility).toHaveBeenCalled();
      expect(keyboardDismiss).toHaveBeenCalled();
      expect(screen.queryByTestId("cash-entry-modal")).toBeNull();
      expect(store.getState().cashEntries).toEqual([]);
    } finally {
      keyboardVisibility.mockRestore();
      keyboardDismiss.mockRestore();
    }
  });

  it("keeps the entry panel modal to accessibility services", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(<CashScreen store={store} />);

    fireEvent.press(screen.getByTestId("cash-entry-deposit"));

    expect(screen.getByTestId("cash-entry-modal")).toBeTruthy();
    expect(screen.getByTestId("cash-entry-form")).toHaveProp(
      "accessibilityViewIsModal",
      true,
    );
  });

  it("records deposit purpose explicitly", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId } = render(<CashScreen store={store} />);

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.press(getByTestId("cash-purpose-income"));
    fireEvent.changeText(getByLabelText("Amount"), "50000");
    fireEvent.changeText(getByLabelText("Label"), "Salary");
    selectDate(getByTestId, "2026-05-01");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(store.getState().cashEntries).toEqual([
        expect.objectContaining({
          amount: 50000,
          label: "Salary",
          purpose: "income",
          type: "addition",
        }),
      ]);
    });
  });

  it("ignores rapid repeated cash save presses", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId } = render(<CashScreen store={store} />);

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.changeText(getByLabelText("Amount"), "1000");
    fireEvent.changeText(getByLabelText("Label"), "One deposit");
    fireEvent.press(getByTestId("save-cash-entry-button"));
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(store.getState().cashEntries).toHaveLength(1);
    });
    expect(store.getState().cashEntries[0]).toMatchObject({
      amount: 1000,
      label: "One deposit",
    });
  });

  it("keeps the form available and reports a cash persistence failure", async () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage });
    const originalSetItem = storage.setItem;
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <CashScreen store={store} />,
    );

    storage.setItem = (key, value) => {
      if (key === portfolioStorageKey) {
        throw new Error("simulated cash persistence failure");
      }

      originalSetItem(key, value);
    };
    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.changeText(getByLabelText("Amount"), "1000");
    fireEvent.changeText(getByLabelText("Label"), "Retry deposit");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(
        getByText(
          "This cash entry could not be saved safely. Review it and try again.",
        ),
      ).toBeTruthy();
    });
    expect(store.getState().cashEntries).toEqual([]);
    expect(getByTestId("cash-entry-modal")).toBeTruthy();
    expect(getByLabelText("Amount")).toHaveProp("value", "1000");

    storage.setItem = originalSetItem;
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(store.getState().cashEntries).toEqual([
        expect.objectContaining({
          amount: 1000,
          label: "Retry deposit",
          type: "addition",
        }),
      ]);
    });
    expect(queryByTestId("cash-entry-modal")).toBeNull();
  });

  it("shows invested as derived evidence without exposing a manual Invest action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      id: "asset-reliance",
      name: "Reliance Industries",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    });
    store.getState().addCashEntry({
      amount: 100000,
      date: "2026-05-01",
      id: "cash-salary",
      label: "Salary",
      purpose: "income",
      type: "addition",
    });
    store.getState().recordFundedBuy({
      cashLabel: "Reliance Industries purchase",
      trade: {
      assetId: "asset-reliance",
      date: "2026-05-10",
      id: "trade-buy",
      pricePerUnit: 100,
      quantity: 200,
      totalValue: 20000,
      type: "buy",
      },
    });

    const { getByText, queryByText } = render(
      <CashScreen
        now={new Date("2026-05-16T00:00:00.000Z")}
        store={store}
      />,
    );

    expect(getByText("Deployable cash")).toBeTruthy();
    expect(getByText("Invested")).toBeTruthy();
    expect(getByText("Investment rate")).toBeTruthy();
    expect(getByText("₹20K moved into investments this month")).toBeTruthy();
    expect(getByText("Deposit")).toBeTruthy();
    expect(getByText("Withdraw")).toBeTruthy();
    expect(queryByText("Invest")).toBeNull();
    expect(queryByText("Investment Transfer")).toBeNull();
    expect(queryByText("Invested / income")).toBeNull();
  });

  it("keeps cash metrics and actions while hiding monthly commentary in Minimal mode", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({
      amount: 50000,
      date: "2026-05-01",
      id: "cash-income-minimal",
      label: "Salary",
      purpose: "income",
      type: "addition",
    });
    store.getState().updatePreferences({ displayMode: "minimal" });

    const { getByText, queryByText } = render(
      <CashScreen now={new Date("2026-05-16T00:00:00.000Z")} store={store} />,
    );

    expect(getByText("Deployable cash")).toBeTruthy();
    expect(getByText("Deposit")).toBeTruthy();
    expect(getByText("Withdraw")).toBeTruthy();
    expect(getByText("Recent cash ledger")).toBeTruthy();
    expect(queryByText("This month")).toBeNull();
  });

  it("does not show monthly commentary when there is no invested movement", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({
      amount: 50000,
      date: "2026-05-01",
      id: "cash-income-no-investment",
      label: "Salary",
      purpose: "income",
      type: "addition",
    });

    const { queryByText } = render(
      <CashScreen now={new Date("2026-05-16T00:00:00.000Z")} store={store} />,
    );

    expect(queryByText("This month")).toBeNull();
  });

  it("shows asset exit proceeds as linked cash movement", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({
      amount: 8400,
      date: "2026-05-20",
      id: "cash-proceeds",
      label: "HDFC Bank redemption proceeds",
      purpose: "saleProceeds",
      type: "addition",
    });

    const { getByText } = render(<CashScreen store={store} />);

    expect(getByText("HDFC Bank redemption proceeds")).toBeTruthy();
    expect(getByText("Added from asset exit")).toBeTruthy();
    expect(getByText("+₹8,400.00")).toBeTruthy();
  });

  it("opens manual entries for correction and keeps linked entries read-only", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onCorrectEntry = jest.fn();
    store.getState().addCashEntry({
      amount: 1000,
      date: "2026-05-01",
      id: "cash-manual",
      label: "Broker cash",
      purpose: "capitalContribution",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 500,
      date: "2026-05-02",
      id: "cash-linked",
      label: "Investment purchase",
      linkedTradeId: "trade-buy",
      purpose: "purchaseFunding",
      type: "withdrawal",
    });

    const { getByLabelText, getByText } = render(
      <CashScreen onCorrectEntry={onCorrectEntry} store={store} />,
    );

    expect(getByText("Tap to review or correct")).toBeTruthy();
    expect(
      getByText("Managed with its investment transaction"),
    ).toBeTruthy();
    fireEvent.press(getByLabelText("Review Broker cash"));

    expect(onCorrectEntry).toHaveBeenCalledWith("cash-manual");
    expect(() => getByLabelText("Review Investment purchase")).toThrow();
  });

  it("shows income-based metrics as unavailable for unclassified legacy additions", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({
      amount: 50000,
      date: "2026-05-01",
      id: "cash-income",
      label: "Salary",
      purpose: "income",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 5000,
      date: "2026-05-02",
      id: "cash-legacy",
      label: "Legacy addition",
      purpose: "legacyUncategorized",
      type: "addition",
    });

    const { getAllByText, getByTestId, getByText, queryByText } = render(
      <CashScreen
        now={new Date("2026-05-16T00:00:00.000Z")}
        store={store}
      />,
    );

    expect(getByText("Investment rate")).toBeTruthy();
    expect(getAllByText("--")).toHaveLength(2);
    expect(getByTestId("cash-income-explanation")).toBeTruthy();
    expect(queryByText("Not enough data")).toBeNull();
  });

  it("shows validation errors for invalid cash entries", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText } = render(
      <CashScreen now={new Date(2026, 6, 22, 12)} store={store} />,
    );

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.press(getByTestId("save-cash-entry-button"));

    expect(getByText("Amount must be a valid number.")).toBeTruthy();
    expect(getByText("Label is required.")).toBeTruthy();
    expect(getByText("22 Jul 2026")).toBeTruthy();
  });

  it("masks cash wealth values when value masking is enabled", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ maskWealthValues: true });
    store.getState().addCashEntry({
      amount: 1000,
      date: "2026-04-20",
      id: "cash-1",
      label: "Broker cash",
      purpose: "capitalContribution",
      type: "addition",
    });

    const { getAllByText, getByTestId, getByText, queryByText } = render(
      <CashScreen store={store} />,
    );

    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    expect(queryByText("Masked preview")).toBeNull();
    expect(getAllByText("--")).toHaveLength(2);
    expect(getByTestId("cash-income-explanation")).toBeTruthy();
    expect(queryByText("Not enough data")).toBeNull();
    expect(getByText("Broker cash")).toBeTruthy();
    expect(queryByText("₹1,000.00")).toBeNull();
  });
});
