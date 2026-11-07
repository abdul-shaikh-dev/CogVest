import { fireEvent, render } from "@testing-library/react-native";

import { wholePortfolioXirrSummary } from "@/src/features/dashboard/portfolioXirr";
import { PayoutCoverageScreen } from "@/src/features/payouts";
import { payoutCoverageRows } from "@/src/features/payouts/payoutCoverageModel";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const now = new Date("2026-10-05T10:00:00Z");
const holdings = [["alpha", "Synthetic Alpha"], ["beta", "Synthetic Beta"], ["gamma", "Synthetic Gamma"]] as const;

// Three holdings bought after the automatic start (a December 2025 snapshot), none
// with payouts confirmed. Gamma has a payout recorded in the period.
function setup() {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.setState({ monthlySnapshots: [{ id: "dec", month: "2025-12", portfolioValue: 0, equityValue: 0, debtValue: 0,
    cryptoValue: 0, cashValue: 0, investedValue: 0, monthlyInvestment: 0 }] });
  for (const [id, name] of holdings) {
    store.getState().addAsset({ id, name, symbol: id.toUpperCase(), ticker: `${id.toUpperCase()}.NS`, currency: "INR", assetClass: "stock", exchange: "NSE" });
    store.getState().addTrade({ id: `${id}-buy`, assetId: id, type: "buy", date: "2026-01-05", quantity: 10, pricePerUnit: 100, totalValue: 1000 });
    store.getState().upsertQuote({ asOf: "2026-10-05T09:00:00.000Z", assetId: id, currency: "INR", price: 110, source: "yahoo" });
  }
  expect(store.getState().saveDistribution({ id: "gamma-payout", assetId: "gamma", grossAmount: 50, taxWithheld: 0,
    paidOn: "2026-06-01", treatment: "paidOutside" })).toMatchObject({ status: "applied" });
  return store;
}

const payoutNote = (store: ReturnType<typeof setup>) => {
  const summary = wholePortfolioXirrSummary(store.getState(), now);
  if (summary.status !== "rate") throw new Error(JSON.stringify(summary));
  return summary.notes.find((note) => note.startsWith("Dividends aren't recorded"));
};

const show = async (store: ReturnType<typeof setup>, onReviewHolding = jest.fn()) =>
  await render(<PayoutCoverageScreen now={now} onBack={jest.fn()} onReviewHolding={onReviewHolding} store={store} />);

test("splits the holdings behind the note by whether payouts are recorded in the period", () => {
  const store = setup();
  const rows = payoutCoverageRows(store.getState(), now);
  expect(rows.confirmable.map((row) => [row.assetId, row.requiredFrom])).toEqual([["alpha", "2026-01-05"], ["beta", "2026-01-05"]]);
  expect(rows.withPayouts.map((row) => [row.assetId, row.recordedPayouts])).toEqual([["gamma", 1]]);
  expect(payoutNote(store)).toBe("Dividends aren't recorded for 3 holdings, so the return may be understated.");
});

test("selects nothing by default and does not offer a holding with recorded payouts", async () => {
  const store = setup();
  const screen = await show(store);
  expect(screen.getByTestId("payout-coverage-select-alpha")).not.toBeChecked();
  expect(screen.getByTestId("payout-coverage-select-beta")).not.toBeChecked();
  expect(screen.queryByTestId("payout-coverage-select-gamma")).toBeNull();
  expect(screen.getByTestId("payout-coverage-open-gamma")).toHaveTextContent(/1 recorded since 05 Jan 2026/);
  expect(screen.getByTestId("payout-coverage-continue")).toBeDisabled();
});

test("saves coverage for the reviewed selection only, and the note counts what is left", async () => {
  const store = setup();
  const screen = await show(store);
  await fireEvent.press(screen.getByTestId("payout-coverage-select-alpha"));
  await fireEvent.press(screen.getByTestId("payout-coverage-select-beta"));
  await fireEvent.press(screen.getByTestId("payout-coverage-select-beta"));
  expect(screen.getByTestId("payout-coverage-select-alpha")).toBeChecked();
  expect(screen.getByTestId("payout-coverage-select-beta")).not.toBeChecked();
  await fireEvent.press(screen.getByTestId("payout-coverage-continue"));

  // Reviewing writes nothing.
  expect(screen.getByTestId("payout-coverage-review-alpha")).toHaveTextContent(/Synthetic Alpha.*Since 05 Jan 2026/);
  expect(screen.queryByTestId("payout-coverage-review-beta")).toBeNull();
  expect(store.getState().distributionCoverage).toEqual([]);

  await fireEvent.press(screen.getByTestId("payout-coverage-confirm"));
  expect(store.getState().distributionCoverage).toEqual([
    { assetId: "alpha", from: "2026-01-05", confirmedAt: now.toISOString() },
  ]);
  expect(screen.getByTestId("payout-coverage-saved")).toHaveTextContent("Payouts confirmed for 1 holding.");
  expect(screen.queryByTestId("payout-coverage-select-alpha")).toBeNull();
  expect(screen.getByTestId("payout-coverage-select-beta")).not.toBeChecked();
  expect(payoutNote(store)).toBe("Dividends aren't recorded for 2 holdings, so the return may be understated.");
});

test("goes back from review without saving, keeping the selection", async () => {
  const store = setup();
  const screen = await show(store);
  await fireEvent.press(screen.getByTestId("payout-coverage-select-beta"));
  await fireEvent.press(screen.getByTestId("payout-coverage-continue"));
  await fireEvent.press(screen.getByTestId("payout-coverage-edit"));
  expect(screen.getByTestId("payout-coverage-select-beta")).toBeChecked();
  expect(store.getState().distributionCoverage).toEqual([]);
});

test("opens one holding to record its payouts", async () => {
  const store = setup();
  const onReviewHolding = jest.fn();
  const screen = await show(store, onReviewHolding);
  await fireEvent.press(screen.getByTestId("payout-coverage-record-alpha"));
  await fireEvent.press(screen.getByTestId("payout-coverage-open-gamma"));
  expect(onReviewHolding.mock.calls).toEqual([["alpha"], ["gamma"]]);
});

test("says when every holding is confirmed", async () => {
  const store = setup();
  store.getState().confirmDistributionCoverage(holdings.map(([assetId]) => ({ assetId, from: "2026-01-05" })));
  const screen = await show(store);
  expect(screen.getByText("Payouts confirmed")).toBeTruthy();
  expect(payoutNote(store)).toBeUndefined();
});
