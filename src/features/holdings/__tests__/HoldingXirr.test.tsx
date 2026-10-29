import { act, fireEvent, render as renderNative, within } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { HoldingsScreen } from "@/src/features/holdings";
import { HoldingXirrPanel } from "@/src/features/holdings/HoldingXirrPanel";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

jest.mock("@/src/hooks/useReducedMotionPreference", () => ({ useReducedMotionPreference: jest.fn(() => true) }));
jest.mock("../useAssetHistory", () => ({ useAssetHistory: () => ({ loading: false, retry: jest.fn() }) }));

const metrics = { frame: { height: 640, width: 360, x: 0, y: 0 }, insets: { bottom: 0, left: 0, right: 0, top: 0 } };
const render = (ui: ReactElement) => renderNative(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
const now = new Date("2026-01-01T12:00:00");
const stock: Asset = { id: "stock", name: "Synthetic Bank", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };

function seed({ coverage = true, price = 110 } = {}) {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.getState().addAsset(stock);
  store.getState().addTrade({ id: "buy", assetId: "stock", type: "buy", date: "2025-01-01", quantity: 100, pricePerUnit: 100, totalValue: 10000 });
  store.getState().upsertQuote({ asOf: "2026-01-01T10:00:00.000Z", assetId: "stock", currency: "INR", price, source: "yahoo" });
  if (coverage) store.getState().setDistributionCoverage("stock", "2025-01-01");
  return store;
}

function openDetail(store: ReturnType<typeof seed>) {
  const screen = render(<HoldingsScreen now={now} onReviewTrades={jest.fn()} refreshQuotes={jest.fn(async ({ cachedQuotes }) => ({ failed: [], quoteCache: cachedQuotes ?? {}, timedOut: [], updated: [] }))} store={store} />);
  fireEvent.press(screen.getByTestId("holding-row-stock"));
  return screen;
}

describe("holding XIRR", () => {
  it.each([[110, "+10.00% a year"], [100, "0.00% a year"], [90, "-10.00% a year"]])(
    "shows the verified one-year rate for a value of %d per unit", (price, text) => {
      const screen = openDetail(seed({ price }));
      expect(screen.getByTestId("holding-xirr-rate")).toHaveTextContent(text);
      expect(screen.getByTestId("holding-xirr-period")).toHaveTextContent("01 Jan 2025 to 01 Jan 2026 · INR · price as of 01 Jan 2026");
    });

  it("explains why it is unavailable until payouts are confirmed, then updates", () => {
    const store = seed({ coverage: false });
    const screen = openDetail(store);
    expect(within(screen.getByTestId("holding-xirr-stock")).getByText("Dividends or payouts aren't recorded for this period.")).toBeTruthy();
    expect(screen.queryByTestId("holding-xirr-rate")).toBeNull();
    act(() => { store.getState().setDistributionCoverage("stock", "2025-01-01"); });
    expect(screen.getByTestId("holding-xirr-rate")).toHaveTextContent("+10.00% a year");
  });

  it("lists the cash flows behind the rate and masks their amounts", () => {
    const store = seed();
    store.getState().updatePreferences({ maskWealthValues: true });
    const screen = openDetail(store);
    fireEvent.press(screen.getByTestId("holding-xirr-flows-toggle"));
    const flows = within(screen.getByTestId("holding-xirr-flows"));
    expect(flows.getByText("Transaction")).toBeTruthy();
    expect(flows.getByText("Current value")).toBeTruthy();
    expect(flows.getAllByText(MASKED_INR_VALUE)).toHaveLength(2);
    expect(flows.queryByText(/11,000/)).toBeNull();
  });

  it("keeps the return behind the records disclosure in Minimal mode", () => {
    const store = seed();
    store.getState().updatePreferences({ displayMode: "minimal" });
    const screen = openDetail(store);
    expect(screen.queryByTestId("holding-xirr-stock")).toBeNull();
    fireEvent.press(screen.getByTestId("holding-view-records"));
    expect(screen.getByTestId("holding-xirr-rate")).toHaveTextContent("+10.00% a year");
  });

  it("labels a short period as annualised, not the period gain", () => {
    const screen = render(<HoldingXirrPanel assetId="a" masked={false} summary={{ status: "rate", rate: 0.25, startDate: "2025-10-01",
      endDate: "2026-01-01", days: 92, shortPeriod: true, valueAsOf: "2026-01-01", flows: [], notes: [] }} />);
    expect(screen.getByTestId("holding-xirr-period")).toHaveTextContent(/^Annualised over 92 days, not the gain for the period\./);
  });
});
