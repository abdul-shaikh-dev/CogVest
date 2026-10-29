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
  it("starts a lifetime measure at the first record and marks unlinked trades only after confirmation", () => {
    const store = seed();
    const screen = screenFor(store);
    fireEvent.press(screen.getByTestId("save-basis"));
    expect(store.getState().measurementBasis).toMatchObject({ kind: "inception", startDate: "2025-01-01" });
    expect(screen.getByTestId("measurement-basis-start")).toHaveTextContent("Since 01 Jan 2025");
    expect(screen.getByTestId("basis-trade-funding-count")).toHaveTextContent(/2 in this period aren't linked to Cash./);
    fireEvent.press(screen.getByTestId("basis-mark-external"));
    expect(store.getState().trades.some((trade) => "fundingSource" in trade && trade.fundingSource)).toBe(false);
    fireEvent.press(screen.getByTestId("basis-confirm-mark-external"));
    expect(store.getState().trades.every((trade) => "fundingSource" in trade && trade.fundingSource === "external")).toBe(true);
    expect(screen.getByTestId("basis-trade-funding-count")).toHaveTextContent("2 marked as paid from outside CogVest.");
    fireEvent.press(screen.getByTestId("basis-clear-external"));
    expect(store.getState().trades.some((trade) => "fundingSource" in trade && trade.fundingSource)).toBe(false);
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
});
