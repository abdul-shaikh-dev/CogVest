import { act, fireEvent, render, within } from "@testing-library/react-native";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

import { DashboardScreen } from "../DashboardScreen";

const now = new Date("2026-01-01T12:00:00");

function seed({ price = 110, buyDate = "2025-01-01" } = {}) {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.getState().addAsset({ id: "stock", name: "Synthetic", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" });
  store.getState().addTrade({ id: "buy", assetId: "stock", type: "buy", date: buyDate, quantity: 100, pricePerUnit: 100, totalValue: 10000 });
  store.getState().upsertQuote({ asOf: "2026-01-01T10:00:00.000Z", assetId: "stock", currency: "INR", price, source: "yahoo" });
  store.getState().setDistributionCoverage("stock", buyDate);
  return store;
}
const screenFor = (store: ReturnType<typeof seed>) => render(<DashboardScreen now={now} store={store} />);

describe("Dashboard Investments XIRR", () => {
  it.each([[110, "+10.00% a year"], [100, "0.00% a year"], [90, "-10.00% a year"]])("shows %d as %s with its period and totals", (price, text) => {
    const screen = screenFor(seed({ price }));
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent(text);
    fireEvent.press(screen.getByTestId("dashboard-xirr-toggle"));
    expect(screen.getByTestId("dashboard-xirr-period")).toHaveTextContent("01 Jan 2025 to 01 Jan 2026 · INR · values as of 01 Jan 2026");
    expect(screen.getByTestId("dashboard-xirr-paid-in")).toHaveTextContent("₹10,000.00");
    expect(screen.getByTestId("dashboard-xirr-current")).toHaveTextContent(`₹${(price * 100).toLocaleString("en-IN")}.00`);
    expect(screen.getByText("Covers market holdings. Cash is excluded.")).toBeTruthy();
  });

  it("masks the breakdown amounts but not the rate", () => {
    const store = seed();
    store.getState().updatePreferences({ maskWealthValues: true });
    const screen = screenFor(store);
    fireEvent.press(screen.getByTestId("dashboard-xirr-toggle"));
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent("+10.00% a year");
    expect(within(screen.getByTestId("dashboard-xirr-details")).getAllByText(MASKED_INR_VALUE)).toHaveLength(3);
  });

  it("keeps the return behind Invested & returns in Minimal mode", () => {
    const store = seed();
    store.getState().updatePreferences({ displayMode: "minimal" });
    const screen = screenFor(store);
    expect(screen.queryByTestId("dashboard-xirr")).toBeNull();
    fireEvent.press(screen.getByTestId("dashboard-performance-toggle"));
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent("+10.00% a year");
  });

  it("labels a short period and explains an unavailable result, then updates", () => {
    const short = screenFor(seed({ buyDate: "2025-10-01" }));
    expect(short.getByTestId("dashboard-xirr-short")).toHaveTextContent("Annualised over 92 days, not the gain for the period.");
    const store = seed();
    act(() => { store.getState().setDistributionCoverage("stock", null); });
    const screen = screenFor(store);
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent("Unavailable");
    expect(screen.getByText("Dividends or payouts aren't recorded for this period.")).toBeTruthy();
    act(() => { store.getState().setDistributionCoverage("stock", "2025-01-01"); });
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent("+10.00% a year");
  });
});
