import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { CashScreen } from "@/src/features/cash";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

describe("CashScreen", () => {
  it("shows an empty cash state with zero balance", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    const { getAllByText, getByTestId, getByText } = render(<CashScreen store={store} />);

    expect(getByTestId("cash-screen")).toBeTruthy();
    expect(getByTestId("cash-amount-input")).toBeTruthy();
    expect(getByTestId("cash-label-input")).toBeTruthy();
    expect(getByTestId("cash-date-input")).toBeTruthy();
    expect(getByTestId("save-cash-entry-button")).toBeTruthy();
    expect(getAllByText("₹0.00").length).toBeGreaterThan(0);
    expect(getByText("No cash movement yet")).toBeTruthy();
    expect(getByText("Add broker or bank cash only when it should count toward portfolio value.")).toBeTruthy();
  });

  it("adds and withdraws cash and shows history rows", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getAllByText, getByLabelText, getByTestId, getByText } = render(<CashScreen store={store} />);

    fireEvent.changeText(getByLabelText("Amount"), "1000");
    fireEvent.changeText(getByLabelText("Label"), "Broker cash");
    fireEvent.changeText(getByLabelText("Date"), "2026-04-20");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(getAllByText("₹1,000.00").length).toBeGreaterThan(0);
      expect(getByText("Broker cash")).toBeTruthy();
      expect(getByText("Capital added to deployable cash")).toBeTruthy();
      expect(getByText("+₹1,000.00")).toBeTruthy();
    });

    fireEvent.press(getByText("Withdraw"));
    fireEvent.changeText(getByLabelText("Amount"), "250");
    fireEvent.changeText(getByLabelText("Label"), "Emergency withdrawal");
    fireEvent.changeText(getByLabelText("Date"), "2026-04-21");
    fireEvent.press(getByTestId("save-cash-entry-button"));

    await waitFor(() => {
      expect(getAllByText("₹750.00").length).toBeGreaterThan(0);
      expect(getByText("Emergency withdrawal")).toBeTruthy();
      expect(getByText("Withdrawn from deployable cash")).toBeTruthy();
      expect(getByText("-₹250.00")).toBeTruthy();
    });
  });

  it("changes the cash entry form copy when switching between deposit and withdraw", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByText, queryByText } = render(<CashScreen store={store} />);

    expect(getByText("Included in portfolio")).toBeTruthy();
    expect(queryByText("Balance ₹0")).toBeNull();
    expect(getByText("No movement yet")).toBeTruthy();
    expect(getByText("Deposit cash")).toBeTruthy();
    expect(getByText("Add money that is available for future investment.")).toBeTruthy();
    expect(getByText("Adds balance")).toBeTruthy();
    expect(getByText("Save deposit")).toBeTruthy();
    expect(queryByText("Save Cash Entry")).toBeNull();

    fireEvent.press(getByText("Withdraw"));

    expect(getByText("Withdraw cash")).toBeTruthy();
    expect(getByText("Record money leaving the portfolio cash pool.")).toBeTruthy();
    expect(getByText("Reduces balance")).toBeTruthy();
    expect(getByText("Save withdrawal")).toBeTruthy();
    expect(queryByText("Deposit cash")).toBeNull();
  });

  it("records deposit purpose explicitly", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByTestId } = render(<CashScreen store={store} />);

    fireEvent.press(getByTestId("cash-purpose-income"));
    fireEvent.changeText(getByLabelText("Amount"), "50000");
    fireEvent.changeText(getByLabelText("Label"), "Salary");
    fireEvent.changeText(getByLabelText("Date"), "2026-05-01");
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

    const { getAllByText, getByText } = render(
      <CashScreen
        now={new Date("2026-05-16T00:00:00.000Z")}
        store={store}
      />,
    );

    expect(getByText("Investment rate")).toBeTruthy();
    expect(getAllByText("Not enough data")).toHaveLength(2);
  });

  it("shows validation errors for invalid cash entries", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText } = render(<CashScreen store={store} />);

    fireEvent.press(getByTestId("save-cash-entry-button"));

    expect(getByText("Amount must be a valid number.")).toBeTruthy();
    expect(getByText("Label is required.")).toBeTruthy();
    expect(getByText("Date is required.")).toBeTruthy();
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

    const { getAllByText, getByText, queryByText } = render(
      <CashScreen store={store} />,
    );

    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
    expect(getByText("Masked preview")).toBeTruthy();
    expect(getByText("Broker cash")).toBeTruthy();
    expect(queryByText("₹1,000.00")).toBeNull();
  });
});
