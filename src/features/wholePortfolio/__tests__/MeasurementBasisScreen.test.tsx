import { act, fireEvent, render } from "@testing-library/react-native";

import { MeasurementBasisScreen } from "@/src/features/wholePortfolio";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const now = new Date("2026-01-01T12:00:00");

function seed() {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.getState().addAsset({ id: "stock", name: "Synthetic", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" });
  store.getState().addTrade({ id: "buy", assetId: "stock", type: "buy", date: "2025-01-01", quantity: 100, pricePerUnit: 100, totalValue: 10000 });
  store.getState().addTrade({ id: "sell", assetId: "stock", type: "sell", date: "2025-06-01", quantity: 10, pricePerUnit: 105, totalValue: 1050 });
  return store;
}
const screenFor = (store: ReturnType<typeof seed>) => render(<MeasurementBasisScreen now={now} onBack={jest.fn()} store={store} />);

describe("MeasurementBasisScreen", () => {
  it("shows the automatic start, sets a lifetime start, and goes back to automatic", () => {
    const store = seed();
    store.setState({ monthlySnapshots: [{ id: "dec", month: "2024-12", portfolioValue: 9000, equityValue: 9000, debtValue: 0, cryptoValue: 0,
      cashValue: 0, investedValue: 9000, monthlyInvestment: 0 }] });
    const screen = screenFor(store);
    expect(screen.getByTestId("measurement-basis-start")).toHaveTextContent("Automatic: from 31 Dec 2024 · ₹9,000.00");
    expect(screen.queryByTestId("basis-trade-funding")).toBeNull();
    fireEvent.press(screen.getByTestId("save-basis"));
    expect(store.getState().measurementBasis).toMatchObject({ kind: "inception", startDate: "2025-01-01" });
    expect(screen.getByTestId("measurement-basis-start")).toHaveTextContent("Since 01 Jan 2025");
    fireEvent.press(screen.getByTestId("remove-basis"));
    expect(store.getState().measurementBasis).toBeNull();
    expect(screen.getByTestId("basis-message")).toHaveTextContent("Using the automatic start.");
    expect(screen.getByTestId("measurement-basis-start")).toHaveTextContent(/^Automatic: from 31 Dec 2024/);
  });

  it("totals opening values, rejects an unnamed line, and flags changed evidence", () => {
    const store = seed();
    const screen = screenFor(store);
    fireEvent.press(screen.getByTestId("basis-kind-picker"));
    fireEvent.press(screen.getByTestId("basis-kind-openingValue"));
    fireEvent.changeText(screen.getByTestId("basis-line-value-0"), "10,000");
    fireEvent.press(screen.getByTestId("save-basis"));
    expect(screen.getByTestId("basis-error")).toHaveTextContent("Name each opening value, for example Holdings or Cash.");
    fireEvent.changeText(screen.getByTestId("basis-line-label-0"), "Holdings");
    fireEvent.press(screen.getByTestId("basis-add-line"));
    fireEvent.changeText(screen.getByTestId("basis-line-label-1"), "Cash");
    fireEvent.changeText(screen.getByTestId("basis-line-value-1"), "500.50");
    expect(screen.getByTestId("basis-total")).toHaveTextContent("Total: ₹10,500.50");
    fireEvent.press(screen.getByTestId("save-basis"));
    expect(store.getState().measurementBasis).toMatchObject({ kind: "openingValue", openingValueInr: 10500.5 });
    expect(screen.getByTestId("measurement-basis-status")).toHaveTextContent("Confirmed 01 Jan 2026.");
    act(() => { store.getState().addTrade({ id: "early", assetId: "stock", type: "buy", date: "2024-12-01", quantity: 1, pricePerUnit: 100, totalValue: 100 }); });
    expect(screen.getByTestId("measurement-basis-status")).toHaveTextContent(/Records on or before the start changed./);
    fireEvent.press(screen.getByTestId("remove-basis"));
    expect(store.getState().measurementBasis).toBeNull();
  });

  it("fills the start and opening values from a stored month-end snapshot", () => {
    const store = seed();
    store.setState({ monthlySnapshots: [
      { id: "s-nov", month: "2025-11", portfolioValue: 10750.5, equityValue: 10000, debtValue: 0, cryptoValue: 0, cashValue: 750.5, investedValue: 10000, monthlyInvestment: 0 },
      // Today is 1 Jan 2026: December has ended, so it is offered; January has not.
      { id: "s-dec", month: "2025-12", portfolioValue: 11000, equityValue: 10500, debtValue: 0, cryptoValue: 0, cashValue: 0, investedValue: 10000, monthlyInvestment: 0 },
      { id: "s-jan", month: "2026-01", portfolioValue: 11100, equityValue: 11100, debtValue: 0, cryptoValue: 0, cashValue: 0, investedValue: 10000, monthlyInvestment: 0 },
    ] });
    const screen = screenFor(store);
    fireEvent.press(screen.getByTestId("basis-kind-picker"));
    fireEvent.press(screen.getByTestId("basis-kind-openingValue"));
    fireEvent.press(screen.getByTestId("basis-snapshot-picker"));
    expect(screen.queryByTestId("basis-snapshot-s-jan")).toBeNull();
    fireEvent.press(screen.getByTestId("basis-snapshot-s-nov"));
    expect(screen.getByTestId("basis-line-label-0").props.value).toBe("Equity");
    expect(screen.getByTestId("basis-line-value-1").props.value).toBe("750.50");
    expect(screen.getByTestId("basis-total")).toHaveTextContent("Total: ₹10,750.50");
    fireEvent.press(screen.getByTestId("save-basis"));
    expect(store.getState().measurementBasis).toMatchObject({ kind: "openingValue", startDate: "2025-11-30", openingValueInr: 10750.5,
      openingBreakdown: [{ label: "Equity", valueInr: 10000 }, { label: "Cash", valueInr: 750.5 }] });
    // December's classes don't add up to its total, so one exact line is used.
    fireEvent.press(screen.getByTestId("basis-snapshot-picker"));
    fireEvent.press(screen.getByTestId("basis-snapshot-s-dec"));
    expect(screen.getByTestId("basis-line-label-0").props.value).toBe("Portfolio value");
    expect(screen.getByTestId("basis-total")).toHaveTextContent("Total: ₹11,000.00");
  });
});
