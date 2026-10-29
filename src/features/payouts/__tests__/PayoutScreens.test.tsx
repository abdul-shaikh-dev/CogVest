import { fireEvent, render } from "@testing-library/react-native";

import { PayoutEntryScreen, PayoutsScreen } from "@/src/features/payouts";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

const now = new Date("2026-10-05T10:00:00Z");
const stock: Asset = { id: "stock", name: "Synthetic Bank", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };

function setup() {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.getState().addAsset(stock);
  store.getState().addCashEntry({ id: "deposit", amount: 5000, date: "2026-01-01", label: "Deposit", purpose: "capitalContribution", type: "addition" });
  store.getState().addTrade({ id: "buy", assetId: "stock", type: "buy", date: "2026-01-05", quantity: 10, pricePerUnit: 100, totalValue: 1000 });
  return store;
}

function setDate(screen: ReturnType<typeof render>, testID: string, date: string) {
  fireEvent.press(screen.getByTestId(testID));
  fireEvent(screen.getByTestId(`${testID}-picker`), "onChange", {
    nativeEvent: { timestamp: new Date(`${date}T12:00:00.000Z`).getTime() }, type: "set",
  });
}

const listScreen = (store: ReturnType<typeof setup>) => render(
  <PayoutsScreen assetId="stock" now={now} onAddPayout={jest.fn()} onBack={jest.fn()} onReviewPayout={jest.fn()} store={store} />,
);

test("records a payout to Cash and stores the net Cash addition", () => {
  const store = setup();
  const onComplete = jest.fn();
  const screen = render(<PayoutEntryScreen assetId="stock" now={now} onBack={jest.fn()} onComplete={onComplete} store={store} />);
  setDate(screen, "payout-paid-on", "2026-06-01");
  fireEvent.changeText(screen.getByTestId("payout-gross-input"), "120");
  fireEvent.changeText(screen.getByTestId("payout-tax-input"), "12");
  expect(screen.getByTestId("payout-net")).toHaveTextContent("After tax: ₹108.00");
  fireEvent.press(screen.getByTestId("save-payout"));
  expect(onComplete).toHaveBeenCalledWith("Payout recorded.");
  const [payout] = store.getState().distributions;
  expect(payout).toMatchObject({ paidOn: "2026-06-01", grossAmount: 120, taxWithheld: 12, treatment: "paidToCash" });
  expect(store.getState().cashEntries.find((entry) => entry.linkedDistributionId === payout.id))
    .toMatchObject({ amount: 108, purpose: "distribution" });
});

test("shows field errors and writes nothing for an invalid payout", () => {
  const store = setup();
  const screen = render(<PayoutEntryScreen assetId="stock" now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  fireEvent.changeText(screen.getByTestId("payout-gross-input"), "10");
  fireEvent.changeText(screen.getByTestId("payout-tax-input"), "10");
  fireEvent.press(screen.getByTestId("save-payout"));
  expect(screen.getByText("Tax withheld must be less than the payout.")).toBeTruthy();
  expect(store.getState().distributions).toEqual([]);
});

test("deletes a payout together with its Cash", () => {
  const store = setup();
  store.getState().saveDistribution({ id: "div", assetId: "stock", paidOn: "2026-06-01", grossAmount: 100, taxWithheld: 0, treatment: "paidToCash" });
  const onComplete = jest.fn();
  const screen = render(
    <PayoutEntryScreen assetId="stock" distributionId="div" now={now} onBack={jest.fn()} onComplete={onComplete} store={store} />,
  );
  fireEvent.press(screen.getByTestId("delete-payout"));
  fireEvent.press(screen.getByTestId("confirm-delete-payout"));
  expect(onComplete).toHaveBeenCalledWith("Payout deleted.");
  expect(store.getState().distributions).toEqual([]);
  expect(store.getState().cashEntries.some((entry) => entry.purpose === "distribution")).toBe(false);
});

test("confirms and removes ongoing completeness, defaulting to the first purchase", () => {
  const store = setup();
  const screen = listScreen(store);
  expect(screen.getByTestId("payouts-coverage-status")).toHaveTextContent("Not confirmed complete");
  fireEvent.press(screen.getByTestId("payouts-coverage-edit"));
  fireEvent.press(screen.getByTestId("payouts-coverage-save"));
  expect(store.getState().distributionCoverage).toEqual([{ assetId: "stock", from: "2026-01-05", confirmedAt: now.toISOString() }]);
  expect(screen.getByTestId("payouts-coverage-status")).toHaveTextContent(/^All payouts since 05 Jan 2026 are recorded$/);
  fireEvent.press(screen.getByTestId("payouts-coverage-remove"));
  expect(store.getState().distributionCoverage).toEqual([]);
});

test("lists payouts after tax and masks their amounts", () => {
  const store = setup();
  store.getState().saveDistribution({ id: "div", assetId: "stock", paidOn: "2026-06-01", grossAmount: 100, taxWithheld: 10, treatment: "paidOutside" });
  const screen = listScreen(store);
  expect(screen.getByTestId("payout-row-div")).toHaveTextContent(/₹90\.00/);
  expect(screen.getByTestId("payouts-summary")).toHaveTextContent("1 recorded · not confirmed complete");
  store.getState().updatePreferences({ maskWealthValues: true });
  const masked = listScreen(store);
  expect(masked.getByTestId("payout-row-div")).not.toHaveTextContent(/₹90\.00|₹10\.00/);
});
