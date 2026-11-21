import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { ProgressScreen } from "@/src/features/progress";
import { buildGeneratedMonthEndSnapshot } from "@/src/domain/calculations/monthEndSnapshots";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

import { describeChangedFields, replaceLabel } from "../OutOfDateMonthsReview";

jest.mock("@/src/hooks", () => ({
  ...jest.requireActual("@/src/hooks"),
  useReducedMotionPreference: jest.fn(() => false),
}));

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: jest.fn(() => ({ bottom: 0, left: 0, right: 0, top: 0 })) };
});

jest.mock("../ProgressTrendPlot", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { ProgressTrendPlot: (props: Record<string, unknown>) => React.createElement(View, { ...props, testID: "progress-trend-plot" }) };
});

const now = new Date("2026-11-21T12:00:00Z");
const stock: Asset = {
  assetClass: "stock", currency: "INR", id: "stock", instrumentType: "stock",
  name: "Synthetic Stock", sectorType: "other", symbol: "SYN", ticker: "SYN.NS",
};
const reviewedMonths = ["2026-01", "2026-02"] as const;

/**
 * January and February 2026 reviewed and saved by the user, followed by a PPF
 * contribution back-dated to June 2025: neither saved month has it.
 */
function storeWithOutdatedMonths() {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  const state = store.getState();
  state.addAsset(stock);
  state.addOpeningPosition({ assetId: stock.id, averageCostPrice: 100, currentPrice: 100, date: "2024-09-01", id: "open", quantity: 10 });
  state.addPpfAccount({
    balanceAsOf: "2024-04-01", confirmedBalance: 30_000, createdAt: "2026-06-01T00:00:00Z", id: "ppf",
    nickname: "Synthetic PPF", opening: { kind: "financialYear", financialYearStart: 2024 }, provider: "Bank", status: "active",
  });
  for (const month of reviewedMonths) {
    const records = store.getState();
    const built = buildGeneratedMonthEndSnapshot({
      assets: records.assets, cashEntries: records.cashEntries, existingSnapshots: [], historicalQuotes: {}, now,
      openingPositions: records.openingPositions, ppfAccounts: records.ppfAccounts, ppfLedgerEntries: [],
      quoteCache: {}, targetMonth: month, trades: [],
    }).snapshot!;
    // Adding the account already saved automatic months; these become reviewed ones.
    const automatic = store.getState().monthlySnapshots.find((item) => item.month === month);
    if (automatic) store.getState().removeMonthlySnapshot(automatic.id);
    store.getState().addMonthlySnapshot({ ...built, generated: { ...built.generated!, source: "manual" }, id: `saved-${month}` });
  }
  store.getState().addPpfLedgerEntry({
    accountId: "ppf", amount: 50_000, date: "2025-06-10", fundingSource: "external",
    id: "ppf-june", recordedAt: "2026-11-01T00:00:00Z", type: "contribution",
  });
  return store;
}

const savedMonth = (store: ReturnType<typeof storeWithOutdatedMonths>, month: string) =>
  store.getState().monthlySnapshots.find((item) => item.month === month)!;

async function openReview(store: ReturnType<typeof storeWithOutdatedMonths>) {
  await render(<ProgressScreen historicalPriceFetcher={jest.fn().mockResolvedValue({ ok: false })} now={now} store={store} />);
  await fireEvent.press(screen.getByTestId("open-monthly-history"));
  const notice = await screen.findByTestId("out-of-date-months-notice");
  await fireEvent.press(within(notice).getByTestId("review-out-of-date-months"));
  await screen.findByTestId("out-of-date-review");
}

describe("reviewing every out-of-date month at once (#751)", () => {
  test("lists each flagged month ticked, and replaces only the ticked ones in one save", async () => {
    const store = storeWithOutdatedMonths();
    const january = savedMonth(store, "2026-01");
    await render(<ProgressScreen historicalPriceFetcher={jest.fn().mockResolvedValue({ ok: false })} now={now} store={store} />);
    await fireEvent.press(screen.getByTestId("open-monthly-history"));
    expect(await screen.findByText("2 saved months don't match your records")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("review-out-of-date-months"));
    await screen.findByTestId("out-of-date-review");

    for (const month of reviewedMonths) {
      expect(screen.getByTestId(`out-of-date-month-${month}`).props.accessibilityState).toMatchObject({ checked: true });
    }
    expect(screen.getByTestId("out-of-date-month-2026-02")).toHaveTextContent(/Changed: invested basis/);
    expect(screen.getByTestId("confirm-replace-out-of-date-months")).toHaveTextContent("Replace 2 months");

    await fireEvent.press(screen.getByTestId("out-of-date-month-2026-01"));
    expect(screen.getByTestId("out-of-date-month-2026-01").props.accessibilityState).toMatchObject({ checked: false });
    const save = jest.spyOn(store.getState(), "replaceMonthlySnapshots");
    await fireEvent.press(screen.getByTestId("confirm-replace-out-of-date-months"));

    expect(save).toHaveBeenCalledTimes(1);
    expect(savedMonth(store, "2026-02")).toMatchObject({ id: "saved-2026-02", investedValue: 81_000 });
    expect(savedMonth(store, "2026-02").generated?.source).toBe("auto");
    expect(savedMonth(store, "2026-01")).toBe(january);
    expect(store.getState().ppfLedgerEntries).toHaveLength(1);
    // Back on the overview, only the unticked month is still out of date.
    expect(await screen.findByText("1 saved month doesn't match your records")).toBeTruthy();
  });

  test("keeping the saved values changes nothing, and masked amounts stay hidden", async () => {
    const store = storeWithOutdatedMonths();
    store.getState().updatePreferences({ maskWealthValues: true });
    const before = store.getState().monthlySnapshots;
    await openReview(store);
    expect(screen.getByTestId("out-of-date-saved-2026-02").props.accessibilityLabel).toBe("Amount hidden");
    expect(screen.getByTestId("out-of-date-recalculated-2026-02").props.accessibilityLabel).toBe("Amount hidden");
    await fireEvent.press(screen.getByTestId("cancel-replace-out-of-date-months"));
    expect(screen.getByTestId("out-of-date-months-notice")).toBeTruthy();
    expect(store.getState().monthlySnapshots).toBe(before);
  });

  test("a failed save replaces no month and tells the user why", async () => {
    const store = storeWithOutdatedMonths();
    await openReview(store);
    const before = store.getState().monthlySnapshots;
    // Saving fails, as it would with the device out of storage.
    store.setState({ replaceMonthlySnapshots: () => { throw new Error("Storage is full"); } });
    await fireEvent.press(screen.getByTestId("confirm-replace-out-of-date-months"));
    expect(screen.getByTestId("replace-out-of-date-months-error")).toBeTruthy();
    expect(store.getState().monthlySnapshots).toBe(before);
  });

  test("with every month unticked there is nothing to replace", async () => {
    const store = storeWithOutdatedMonths();
    await openReview(store);
    for (const month of reviewedMonths) await fireEvent.press(screen.getByTestId(`out-of-date-month-${month}`));
    const button = screen.getByTestId("confirm-replace-out-of-date-months");
    expect(button).toHaveTextContent("Replace 0 months");
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  test("the notice is hidden when every saved month matches its records", async () => {
    const store = storeWithOutdatedMonths();
    store.getState().deletePpfLedgerEntry("ppf-june");
    await render(<ProgressScreen historicalPriceFetcher={jest.fn().mockResolvedValue({ ok: false })} now={now} store={store} />);
    await fireEvent.press(screen.getByTestId("open-monthly-history"));
    await screen.findByTestId("snapshot-month-2026-02");
    expect(screen.queryByTestId("out-of-date-months-notice")).toBeNull();
  });
});

test("labels read naturally", () => {
  expect(describeChangedFields(["investedValue"])).toBe("Changed: invested basis");
  expect(describeChangedFields(["investedValue", "cashValue", "monthlyInvestment"]))
    .toBe("Changed: invested basis, cash and monthly investment");
  expect(replaceLabel(1)).toBe("Replace 1 month");
  expect(replaceLabel(17)).toBe("Replace 17 months");
});

test("the Progress QA scenario for Maestro fixes two of three out-of-date months in one go", async () => {
  const { createProgressEdgeFixture, progressEdgeNow } = jest.requireActual("@/src/testing/progressEdgeFixture");
  const fixture = createProgressEdgeFixture("outdated-many", false);
  await render(<ProgressScreen historicalPriceFetcher={fixture.fetcher} now={progressEdgeNow} store={fixture.store} />);
  await fireEvent.press(screen.getByTestId("open-monthly-history"));
  expect(await screen.findByText("3 saved months don't match your records")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("review-out-of-date-months"));
  await screen.findByTestId("out-of-date-review");
  await fireEvent.press(screen.getByTestId("out-of-date-month-2026-05"));
  expect(screen.getByTestId("confirm-replace-out-of-date-months")).toHaveTextContent("Replace 2 months");
  await fireEvent.press(screen.getByTestId("confirm-replace-out-of-date-months"));
  expect(await screen.findByText("1 saved month doesn't match your records")).toBeTruthy();
  const saved = (month: string) => fixture.store.getState().monthlySnapshots
    .find((item: { month: string }) => item.month === month);
  expect(saved("2026-05")).toMatchObject({ investedValue: 40000 });
  expect(saved("2026-06")).toMatchObject({ investedValue: 90000 });
  expect(saved("2026-07")).toMatchObject({ investedValue: 90000 });
  await screen.unmount();
  fixture.dispose();
});
