import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";

import { ProgressScreen } from "@/src/features/progress";
import { buildGeneratedMonthEndSnapshot } from "@/src/domain/calculations/monthEndSnapshots";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

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

/**
 * A February 2026 month reviewed and saved by the user, followed by a PPF
 * contribution back-dated to June 2025: the saved month no longer has it.
 */
function storeWithOutdatedFebruary() {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  const state = store.getState();
  state.addAsset(stock);
  state.addOpeningPosition({ assetId: stock.id, averageCostPrice: 100, currentPrice: 100, date: "2024-09-01", id: "open", quantity: 10 });
  state.addPpfAccount({
    balanceAsOf: "2024-04-01", confirmedBalance: 30_000, createdAt: "2026-06-01T00:00:00Z", id: "ppf",
    nickname: "Synthetic PPF", opening: { kind: "financialYear", financialYearStart: 2024 }, provider: "Bank", status: "active",
  });
  const records = store.getState();
  const built = buildGeneratedMonthEndSnapshot({
    assets: records.assets, cashEntries: records.cashEntries, existingSnapshots: [], historicalQuotes: {}, now,
    openingPositions: records.openingPositions, ppfAccounts: records.ppfAccounts, ppfLedgerEntries: [],
    quoteCache: {}, targetMonth: "2026-02", trades: [],
  }).snapshot!;
  // Adding the account already saved automatic months; February becomes the reviewed one.
  const automatic = store.getState().monthlySnapshots.find((item) => item.month === "2026-02");
  if (automatic) store.getState().removeMonthlySnapshot(automatic.id);
  store.getState().addMonthlySnapshot({ ...built, generated: { ...built.generated!, source: "manual" }, id: "feb-saved" });
  store.getState().addPpfLedgerEntry({
    accountId: "ppf", amount: 50_000, date: "2025-06-10", fundingSource: "external",
    id: "ppf-june", recordedAt: "2026-11-01T00:00:00Z", type: "contribution",
  });
  return store;
}

async function openFebruary(store: ReturnType<typeof storeWithOutdatedFebruary>) {
  await render(<ProgressScreen historicalPriceFetcher={jest.fn().mockResolvedValue({ ok: false })} now={now} store={store} />);
  await fireEvent.press(screen.getByTestId("open-monthly-history"));
  await fireEvent.press(screen.getByTestId("snapshot-month-2026-02"));
}

describe("a saved month that no longer matches records (#747)", () => {
  test("says where its values came from, and replaces them only after the user compares", async () => {
    const store = storeWithOutdatedFebruary();
    const saved = store.getState().monthlySnapshots.find((item) => item.month === "2026-02")!;
    await openFebruary(store);
    expect(screen.getByTestId("snapshot-source")).toHaveTextContent("Values: Saved by you");
    const notice = within(await screen.findByTestId("snapshot-drift-notice"));
    expect(notice.getByText("Saved before later records were added")).toBeTruthy();

    await fireEvent.press(await screen.findByTestId("recalculate-snapshot"));
    expect(screen.getByTestId("snapshot-drift-saved-investedValue").props.accessibilityLabel).toBe("₹31,000.00");
    expect(screen.getByTestId("snapshot-drift-recalculated-investedValue").props.accessibilityLabel).toBe("₹81,000.00");
    expect(store.getState().monthlySnapshots.find((item) => item.month === "2026-02")).toEqual(saved);

    await fireEvent.press(screen.getByTestId("confirm-recalculate-snapshot"));
    const replaced = store.getState().monthlySnapshots.find((item) => item.month === "2026-02")!;
    expect(replaced).toMatchObject({ id: "feb-saved", investedValue: 81_000, debtValue: saved.debtValue + 50_000 });
    expect(replaced.generated?.source).toBe("auto");
    expect(screen.queryByTestId("snapshot-drift-notice")).toBeNull();
    expect(store.getState().ppfLedgerEntries).toHaveLength(1);
  });

  test("keeping the saved values changes nothing, and masked values stay hidden in the comparison", async () => {
    const store = storeWithOutdatedFebruary();
    store.getState().updatePreferences({ maskWealthValues: true });
    const before = store.getState().monthlySnapshots;
    await openFebruary(store);
    await fireEvent.press(await screen.findByTestId("recalculate-snapshot"));
    expect(screen.getByTestId("snapshot-drift-saved-investedValue").props.accessibilityLabel).toBe("Amount hidden");
    expect(screen.getByTestId("snapshot-drift-recalculated-investedValue").props.accessibilityLabel).toBe("Amount hidden");
    await fireEvent.press(screen.getByTestId("cancel-recalculate-snapshot"));
    expect(screen.getByTestId("recalculate-snapshot")).toBeTruthy();
    expect(store.getState().monthlySnapshots).toBe(before);
  });

  test("a failed replacement leaves the saved month and tells the user why", async () => {
    const store = storeWithOutdatedFebruary();
    await openFebruary(store);
    await fireEvent.press(await screen.findByTestId("recalculate-snapshot"));
    const before = store.getState().monthlySnapshots;
    // Saving fails, as it would with the device out of storage.
    store.setState({ updateMonthlySnapshot: () => { throw new Error("Storage is full"); } });
    await fireEvent.press(screen.getByTestId("confirm-recalculate-snapshot"));
    expect(screen.getByTestId("recalculate-snapshot-error")).toBeTruthy();
    expect(store.getState().monthlySnapshots).toBe(before);
  });
});

test("the Progress QA scenario for Maestro shows July out of date and August's month gain held back", async () => {
  const { createProgressEdgeFixture, progressEdgeNow } = jest.requireActual("@/src/testing/progressEdgeFixture");
  const fixture = createProgressEdgeFixture("outdated", false);
  await render(<ProgressScreen historicalPriceFetcher={fixture.fetcher} now={progressEdgeNow} store={fixture.store} />);
  await fireEvent.press(screen.getByTestId("open-monthly-history"));
  const heldBack = "Month gain unavailable: this month or the one before was saved before later records were added";
  await waitFor(() => expect(screen.getByTestId("snapshot-month-2026-08").props.accessibilityLabel).toContain(heldBack));
  expect(screen.getByTestId("snapshot-month-gain-2026-08")).toHaveTextContent("—");
  await fireEvent.press(screen.getByTestId("snapshot-month-2026-07"));
  expect(screen.getByTestId("snapshot-source")).toHaveTextContent("Values: Saved by you");
  await fireEvent.press(await screen.findByTestId("recalculate-snapshot"));
  expect(screen.getByTestId("snapshot-drift-saved-investedValue").props.accessibilityLabel).toBe("₹40,000.00");
  expect(screen.getByTestId("snapshot-drift-recalculated-investedValue").props.accessibilityLabel).toBe("₹90,000.00");
  await fireEvent.press(screen.getByTestId("confirm-recalculate-snapshot"));
  expect(screen.queryByTestId("snapshot-drift-notice")).toBeNull();
  // No historical price in the fixture, so July comes back as an estimate.
  expect(screen.getByTestId("snapshot-source")).toHaveTextContent("Values: Estimated");
  expect(fixture.store.getState().monthlySnapshots.find((item: { month: string }) => item.month === "2026-07"))
    .toMatchObject({ id: "progress-edge-2026-07", investedValue: 90000 });
  await screen.unmount();
  fixture.dispose();
});
