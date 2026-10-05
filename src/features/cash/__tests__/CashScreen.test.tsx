import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Keyboard, KeyboardAvoidingView, Modal } from "react-native";

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
  it("lets the Android modal resize without a second keyboard height owner", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(<CashScreen store={store} />);
    fireEvent.press(screen.getByTestId("cash-entry-deposit"));
    expect(screen.getByTestId("cash-entry-root")).toHaveStyle({ flex: 1 });
    expect(screen.UNSAFE_queryByType(KeyboardAvoidingView)).toBeNull();
  });
  it.each(["standard", "minimal"] as const)("compacts zero metrics without implying no withdrawals in %s mode", (displayMode) => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ displayMode });
    store.getState().addCashEntry({ id: "prior", date: "2026-08-01", amount: 1000,
      label: "Prior deposit", purpose: "capitalContribution", type: "addition" });
    store.getState().addCashEntry({ id: "out", date: "2026-09-01", amount: 100,
      label: "Withdrawal", purpose: "withdrawal", type: "withdrawal" });
    const screen = render(<CashScreen store={store} now={new Date(2026, 8, 2, 12)} />);
    expect(screen.getByTestId("cash-zero-activity")).toHaveStyle({ flexWrap: "wrap" });
    expect(screen.getByText("Cash added ₹0")).toBeTruthy();
    expect(screen.getByText("Invested ₹0")).toBeTruthy();
    expect(screen.getByText("-₹100.00")).toBeTruthy();
    expect(screen.getByText("₹900.00")).toBeTruthy();
    expect(screen.queryByText(/No cash movement/)).toBeNull();
    expect(screen.getByTestId("cash-month-2026-09")).toHaveStyle({ paddingTop: 12 });
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    expect(screen.queryByTestId("cash-zero-activity")).toBeNull();
    expect(screen.queryByText("Cash added ₹0")).toBeNull();
    expect(screen.getByText("Cash added")).toBeTruthy();
    expect(screen.getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
  });
  it("groups history by calendar month while preserving dates, signed amounts and review targets", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onCorrectEntry = jest.fn();
    for (const [id, date, type] of [
      ["dec", "2025-12-31", "addition"],
      ["jan-early", "2026-01-02", "addition"],
      ["jan-late", "2026-01-08", "withdrawal"],
    ] as const) {
      store.getState().addCashEntry({ id, date, type, label: id, amount: 100,
        purpose: type === "addition" ? "capitalContribution" : "withdrawal" });
    }
    const screen = render(<CashScreen now={new Date(2026, 0, 10)} store={store} onCorrectEntry={onCorrectEntry} />);
    expect(screen.getAllByTestId(/^cash-month-/).map((node) => node.props.testID)).toEqual([
      "cash-month-2026-01", "cash-month-2025-12",
    ]);
    expect(screen.getByText("January 2026")).toBeTruthy();
    expect(screen.getByText("December 2025")).toBeTruthy();
    expect(screen.getByLabelText("08 Jan 2026")).toBeTruthy();
    expect(screen.getByText("-₹100.00")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Review jan-late. 08 Jan 2026. Cash withdrawal."));
    expect(onCorrectEntry).toHaveBeenCalledWith("jan-late");
  });
  it("uses a neutral label when the optional label is blank", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(<CashScreen store={store} />);
    fireEvent.press(screen.getByTestId("cash-entry-deposit"));
    fireEvent.changeText(screen.getByLabelText("Amount"), "1000");
    fireEvent.press(screen.getByTestId("save-cash-entry-button"));
    await waitFor(() => expect(store.getState().cashEntries[0]).toMatchObject({ amount: 1000, label: "Cash added", purpose: "capitalContribution" }));
  });
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
    fireEvent.changeText(getByLabelText("Label (optional)"), "Broker cash");
    selectDate(getByTestId, "2026-04-20");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(getAllByText("₹1,000.00").length).toBeGreaterThan(0);
      expect(getByText("Broker cash")).toBeTruthy();
      expect(getByText("Cash deposit")).toBeTruthy();
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
    fireEvent.changeText(getByLabelText("Label (optional)"), "Emergency withdrawal");
    selectDate(getByTestId, "2026-04-21");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(getAllByText("₹750.00").length).toBeGreaterThan(0);
      expect(getByText("Emergency withdrawal")).toBeTruthy();
      expect(getByText("Cash withdrawal")).toBeTruthy();
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

  it("resumes a same-type investing Cash draft with its date and fields", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <CashScreen now={new Date(2026, 3, 22, 12)} store={store} />,
    );

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.changeText(getByLabelText("Amount"), "1250");
    fireEvent.changeText(getByLabelText("Label (optional)"), "April salary");
    expect(getByTestId("cash-notes-toggle").props.accessibilityState).toEqual({
      expanded: false,
    });
    expect(queryByTestId("cash-notes-input")).toBeNull();
    fireEvent.press(getByTestId("cash-notes-toggle"));
    fireEvent.changeText(getByLabelText("Note (optional)"), "Keep for the next buy");
    selectDate(getByTestId, "2026-04-20");
    fireEvent.press(getByTestId("close-cash-entry-button"));

    expect(queryByTestId("cash-entry-modal")).toBeNull();
    expect(store.getState().cashEntries).toEqual([]);

    fireEvent.press(getByTestId("cash-entry-deposit"));

    expect(getByTestId("cash-entry-modal")).toBeTruthy();
    expect(getByLabelText("Amount")).toHaveProp("value", "1250");
    expect(getByLabelText("Label (optional)")).toHaveProp("value", "April salary");
    expect(getByLabelText("Note (optional)")).toHaveProp(
      "value",
      "Keep for the next buy",
    );
    expect(getByText("20 Apr 2026")).toBeTruthy();
    expect(queryByTestId("cash-purpose-income")).toBeNull();
  });

  it("requires explicit discard before switching a nonempty draft type", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId, getByText, queryByText } = render(
      <CashScreen store={store} />,
    );

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.changeText(getByLabelText("Amount"), "1000");
    fireEvent.changeText(getByLabelText("Label (optional)"), "Do not reinterpret");
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
    expect(getByLabelText("Label (optional)")).toHaveProp("value", "Do not reinterpret");
    fireEvent.press(getByTestId("close-cash-entry-button"));
    fireEvent.press(getByTestId("cash-entry-withdraw"));
    fireEvent.press(getByTestId("cash-discard-draft-button"));

    expect(getByText("Withdraw cash")).toBeTruthy();
    expect(getByLabelText("Amount")).toHaveProp("value", "");
    expect(getByLabelText("Label (optional)")).toHaveProp("value", "");
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("closes from Android back without saving and retains the draft", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(<CashScreen store={store} />);

    fireEvent.press(screen.getByTestId("cash-entry-deposit"));
    fireEvent.changeText(screen.getByLabelText("Amount"), "900");
    fireEvent.changeText(screen.getByLabelText("Label (optional)"), "Back draft");

    act(() => {
      screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose();
    });

    expect(screen.queryByTestId("cash-entry-modal")).toBeNull();
    expect(store.getState().cashEntries).toEqual([]);

    fireEvent.press(screen.getByTestId("cash-entry-deposit"));
    expect(screen.getByLabelText("Amount")).toHaveProp("value", "900");
    expect(screen.getByLabelText("Label (optional)")).toHaveProp("value", "Back draft");
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
      fireEvent.changeText(screen.getByLabelText("Label (optional)"), "Keyboard draft");

      act(() => {
        screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose();
      });

      expect(keyboardVisibility).toHaveBeenCalled();
      expect(keyboardDismiss).toHaveBeenCalled();
      expect(screen.getByTestId("cash-entry-modal")).toBeTruthy();
      expect(screen.getByLabelText("Amount")).toHaveProp("value", "900");
      expect(screen.getByLabelText("Label (optional)")).toHaveProp(
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

  it("records deposits as investing contributions", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId } = render(<CashScreen store={store} />);

    fireEvent.press(getByTestId("cash-entry-deposit"));
    fireEvent.changeText(getByLabelText("Amount"), "50000");
    fireEvent.changeText(getByLabelText("Label (optional)"), "Salary");
    selectDate(getByTestId, "2026-05-01");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(store.getState().cashEntries).toEqual([
        expect.objectContaining({
          amount: 50000,
          label: "Salary",
          purpose: "capitalContribution",
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
    fireEvent.changeText(getByLabelText("Label (optional)"), "One deposit");
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
    fireEvent.changeText(getByLabelText("Label (optional)"), "Retry deposit");
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
      purpose: "capitalContribution",
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
    expect(() => getByText("Investment rate")).toThrow();
    expect(getByText("₹20K")).toBeTruthy();
    expect(queryByText("₹20K moved into investments this month")).toBeNull();
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
      purpose: "capitalContribution",
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
      purpose: "capitalContribution",
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
    expect(getByText("Sale proceeds")).toBeTruthy();
    expect(getByText("+₹8,400.00")).toBeTruthy();
  });

  it("opens manual and linked entries through their safe review routes", () => {
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

    const { getByLabelText, getByText, queryByText } = render(
      <CashScreen onCorrectEntry={onCorrectEntry} store={store} />,
    );

    expect(queryByText("Tap to review or correct")).toBeNull();
    expect(
      getByText("Linked investment"),
    ).toBeTruthy();
    fireEvent.press(getByLabelText("Review Broker cash. 01 May 2026. Cash deposit."));
    fireEvent.press(getByLabelText("Review Investment purchase. 02 May 2026. Investment purchase."));

    expect(onCorrectEntry).toHaveBeenNthCalledWith(1, "cash-manual");
    expect(onCorrectEntry).toHaveBeenNthCalledWith(2, "cash-linked");
  });

  it("keeps unclassified legacy Cash without household-income prompts", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({
      amount: 50000,
      date: "2026-05-01",
      id: "cash-income",
      label: "Salary",
      purpose: "capitalContribution",
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

    expect(() => getByText("Investment rate")).toThrow();
    expect(() => getAllByText("Unavailable")).toThrow();
    expect(() => getByTestId("cash-income-explanation")).toThrow();
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
    expect(getByText("Label (optional)")).toBeTruthy();
    expect(getByText("22 Jul 2026")).toBeTruthy();
  });

  it("masks cash wealth values when value masking is enabled", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ maskWealthValues: true });
    store.getState().addCashEntry({
      amount: 1000,
      date: "2026-09-20",
      id: "cash-1",
      label: "Broker cash",
      purpose: "capitalContribution",
      type: "addition",
    });
    store.getState().addCashEntry({
      amount: 300,
      date: "2026-09-21",
      id: "cash-linked-buy",
      label: "Masked asset purchase",
      linkedTradeId: "trade-linked-buy",
      purpose: "purchaseFunding",
      type: "withdrawal",
    });

    const { getAllByText, getByTestId, getByText, queryByText } = render(
      <CashScreen now={new Date(2026, 8, 22, 12)} store={store} />,
    );

    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    expect(queryByText("Masked preview")).toBeNull();
    expect(() => getAllByText("Unavailable")).toThrow();
    expect(() => getByTestId("cash-income-explanation")).toThrow();
    expect(queryByText("Not enough data")).toBeNull();
    expect(getByText("Broker cash")).toBeTruthy();
    expect(queryByText(`${MASKED_INR_VALUE} moved into investments this month`)).toBeNull();
    expect(queryByText("₹1,000.00")).toBeNull();
    expect(queryByText("₹300 moved into investments this month")).toBeNull();
  });

  it("adds investing cash without asking for its household source", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(
      <CashScreen
        now={new Date(2026, 8, 20, 12)}
        store={store}
      />,
    );

    expect(screen.queryByTestId("cash-record-income")).toBeNull();
    fireEvent.press(screen.getByTestId("cash-entry-deposit"));
    expect(screen.queryByTestId("cash-purpose-income")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Amount"), "50000");
    fireEvent.changeText(screen.getByLabelText("Label (optional)"), "Salary");
    fireEvent.press(screen.getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(store.getState().cashEntries).toHaveLength(1);
    });
    expect(store.getState().cashEntries[0]).toEqual(
      expect.objectContaining({ amount: 50000, purpose: "capitalContribution" }),
    );
  });
});
