import { act, fireEvent, render, within } from "@testing-library/react-native";

import { MASKED_INR_VALUE } from "@/src/components/common";
import { summariseXirr } from "@/src/domain/xirrSummary";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

import { DashboardScreen } from "../DashboardScreen";
import { DashboardXirrBlockers } from "../DashboardXirrBlockers";

const now = new Date("2026-01-01T12:00:00");
const tradeNote = "1 trade without a Cash record is counted as paid from outside CogVest.";

// One stock bought for 10,000 on the start date and worth 11,000 now: 10% a year.
// The buy has no Cash record, so it counts as money from outside (#610).
function seed({ price = 110, buyDate = "2025-01-01", basis = true } = {}) {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.getState().addAsset({ id: "stock", name: "Synthetic", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" });
  store.getState().addTrade({ id: "buy", assetId: "stock", type: "buy", date: buyDate, quantity: 100, pricePerUnit: 100, totalValue: 10000 });
  store.getState().upsertQuote({ asOf: "2026-01-01T10:00:00.000Z", assetId: "stock", currency: "INR", price, source: "yahoo" });
  store.getState().setDistributionCoverage("stock", buyDate);
  if (basis) store.getState().setMeasurementBasis({ startDate: buyDate, kind: "inception", openingBreakdown: [] });
  return store;
}
const screenFor = async (store: ReturnType<typeof seed>) => await render(<DashboardScreen now={now} store={store} />);

describe("Dashboard portfolio XIRR", () => {
  it.each([[110, "+10.00% a year"], [100, "0.00% a year"], [90, "-10.00% a year"]])("shows %d as %s with its period and totals", async (price, text) => {
    const screen = await screenFor(seed({ price }));
    expect(screen.getByText("Portfolio return (XIRR)")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-xirr-measure-investments")).toBeNull();
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent(text);
    await fireEvent.press(screen.getByTestId("dashboard-xirr-toggle"));
    expect(screen.getByTestId("dashboard-xirr-period")).toHaveTextContent("01 Jan 2025 to 01 Jan 2026 · INR · values as of 01 Jan 2026");
    expect(screen.getByTestId("dashboard-xirr-paid-in")).toHaveTextContent("₹10,000.00");
    expect(screen.getByTestId("dashboard-xirr-current")).toHaveTextContent(`₹${(price * 100).toLocaleString("en-IN")}.00`);
    expect(screen.getByText("Covers everything CogVest tracks, Cash included, since 01 Jan 2025.")).toBeTruthy();
  });

  it("masks the breakdown amounts but not the rate", async () => {
    const store = seed();
    store.getState().updatePreferences({ maskWealthValues: true });
    const screen = await screenFor(store);
    await fireEvent.press(screen.getByTestId("dashboard-xirr-toggle"));
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent("+10.00% a year");
    expect(within(screen.getByTestId("dashboard-xirr-details")).getAllByText(MASKED_INR_VALUE)).toHaveLength(3);
  });

  it("keeps the return behind Invested & returns in Minimal mode", async () => {
    const store = seed();
    store.getState().updatePreferences({ displayMode: "minimal" });
    const screen = await screenFor(store);
    expect(screen.queryByTestId("dashboard-xirr")).toBeNull();
    await fireEvent.press(screen.getByTestId("dashboard-performance-toggle"));
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent("+10.00% a year");
  });

  it("labels a short period", async () => {
    const screen = await screenFor(seed({ buyDate: "2025-10-01" }));
    expect(screen.getByTestId("dashboard-xirr-short")).toHaveTextContent("Annualised over 92 days, not the gain for the period.");
  });

  it("names its assumptions instead of blocking on missing payouts", async () => {
    const store = seed();
    await act(() => { store.getState().setDistributionCoverage("stock", null); });
    const screen = await screenFor(store);
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent("+10.00% a year");
    expect(screen.getByTestId("dashboard-xirr-assumptions")).toHaveTextContent("Estimate with 2 assumptions. Open Breakdown to see them.");
    await fireEvent.press(screen.getByTestId("dashboard-xirr-toggle"));
    expect(screen.getByText("Dividends aren't recorded for 1 holding, so the return may be understated.")).toBeTruthy();
    expect(screen.getByText(tradeNote)).toBeTruthy();
    await act(() => { store.getState().setDistributionCoverage("stock", "2025-01-01"); });
    expect(screen.queryByText("Dividends aren't recorded for 1 holding, so the return may be understated.")).toBeNull();
  });

  it("starts automatically from the earliest month-end snapshot", async () => {
    const store = seed({ basis: false, buyDate: "2024-06-01" });
    const screen = await screenFor(store);
    expect(screen.getByTestId("dashboard-xirr-reason"))
      .toHaveTextContent("Save a month-end snapshot in Progress, or set a start date, to measure the return.");
    // Worth 10,000 at the end of December 2024, 11,000 now (366 days later).
    await act(() => {
      store.setState({ monthlySnapshots: [{ id: "dec", month: "2024-12", portfolioValue: 10000, equityValue: 10000, debtValue: 0,
        cryptoValue: 0, cashValue: 0, investedValue: 10000, monthlyInvestment: 0 }] });
    });
    expect(screen.getByTestId("dashboard-xirr-rate")).toHaveTextContent("+9.97% a year");
    await fireEvent.press(screen.getByTestId("dashboard-xirr-toggle"));
    expect(screen.getByText("Covers everything CogVest tracks, Cash included, from your earliest month-end snapshot (31 Dec 2024).")).toBeTruthy();
  });

  it("lists what still blocks it, with holdings and where to fix it", async () => {
    const store = seed({ basis: false });
    store.getState().addAsset({ id: "fund", name: "Synthetic Income Fund", symbol: "SIF", ticker: "SIF.NS", currency: "INR", assetClass: "stock", exchange: "NSE" });
    store.getState().addTrade({ id: "in", assetId: "fund", type: "transferIn", date: "2025-03-01", quantity: 10 });
    store.getState().setMeasurementBasis({ startDate: "2025-02-01", kind: "inception", openingBreakdown: [] });
    const onSetBasis = jest.fn();
    const screen = await render(<DashboardScreen now={now} onSetBasis={onSetBasis} store={store} />);
    expect(screen.getByTestId("dashboard-xirr-reason"))
      .toHaveTextContent("Records exist before your start date. Use the automatic start, or choose an earlier date.");
    expect(screen.getByTestId("dashboard-xirr-more")).toHaveTextContent("1 more to fix. Open Breakdown for the full list.");
    await fireEvent.press(screen.getByTestId("dashboard-xirr-toggle"));
    expect(screen.getByTestId("dashboard-xirr-blocker-transfer-without-value-extent")).toHaveTextContent("1 holding: Synthetic Income Fund");
    await fireEvent.press(screen.getByTestId("dashboard-xirr-fix-records-before-start"));
    await fireEvent.press(screen.getByTestId("dashboard-xirr-set-basis"));
    expect(onSetBasis).toHaveBeenCalledTimes(2);
  });

  it("links payout blockers to each holding's payouts", async () => {
    const summary = summariseXirr({ status: "unavailable", reasons: [{ assetId: "fund", reason: "payout-before-purchase", recordId: "d1" }] });
    const onReviewPayouts = jest.fn();
    const screen = await render(<DashboardXirrBlockers blockers={summary.status === "unavailable" ? summary.blockers : []}
      names={{ fund: "Synthetic Income Fund" }} onReviewPayouts={onReviewPayouts} />);
    await fireEvent.press(screen.getByLabelText("Review payouts for Synthetic Income Fund"));
    expect(onReviewPayouts).toHaveBeenCalledWith("fund");
  });
});
