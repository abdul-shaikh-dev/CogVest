import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import ProgressEdgeQaRoute from "@/app/progress-edge-qa";
import { getPortfolioStore } from "@/src/store";
import { ProgressScreen } from "@/src/features/progress";
import { createProgressEdgeFixture, progressEdgeNow } from "@/src/testing/progressEdgeFixture";

let mockParams: { token?: string; scenario?: string; mode?: string } = {};
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams, Stack: { Screen: () => null } }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/src/store", () => ({
  ...jest.requireActual("@/src/store"),
  getPortfolioStore: jest.fn(() => { throw new Error("Persistent store must not be accessed"); }),
}));
jest.mock("@/src/hooks", () => ({ useReducedMotionPreference: () => true }));

beforeEach(() => { mockParams = { token: "cogvest-local-visual-qa" }; });

it("blocks missing tokens and release access", () => {
  mockParams = {};
  const screen = render(<ProgressEdgeQaRoute />);
  expect(screen.getByTestId("progress-edge-qa-blocked")).toBeTruthy();
  const development = __DEV__;
  try {
    Object.assign(globalThis, { __DEV__: false });
    mockParams = { token: "cogvest-local-visual-qa" };
    screen.rerender(<ProgressEdgeQaRoute />);
    expect(screen.getByTestId("progress-edge-qa-blocked")).toBeTruthy();
  } finally { Object.assign(globalThis, { __DEV__: development }); }
});

it.each(["single", "gap", "zero"])("keeps %s fixture records unchanged through chart navigation and masking", async (scenario) => {
  const fixture = createProgressEdgeFixture(scenario, false);
  expect(fixture.store.getState().monthlySnapshots.map(({ month, portfolioValue }) => [month, portfolioValue])).toEqual(
    scenario === "single" ? [["2026-08", 12000]] : scenario === "zero" ? [["2026-07", 0], ["2026-08", 0]] : [["2026-05", 10000], ["2026-07", 13000], ["2026-08", 12000]],
  );
  const saved = fixture.store.getState().monthlySnapshots;
  const screen = render(<ProgressScreen store={fixture.store} now={progressEdgeNow} historicalPriceFetcher={fixture.fetcher} />);
  await waitFor(() => expect(screen.queryByTestId("progress-trends-building")).toBeNull());
  expect(screen.queryByText("Waiting for the first month-end")).toBeNull();
  fireEvent.press(screen.getByTestId("progress-mask-toggle"));
  fireEvent.press(screen.getByTestId("open-monthly-history"));
  expect(screen.queryByTestId("history-bar-scale")).toBeNull();
  expect(fixture.store.getState().monthlySnapshots).toBe(saved);
  expect(getPortfolioStore).not.toHaveBeenCalled();
});

it("uses the real pending fetch and resumes to generated snapshots", async () => {
  mockParams.scenario = "building";
  const screen = render(<ProgressEdgeQaRoute />);
  expect(await screen.findByText("Building monthly history")).toBeTruthy();
  expect(screen.getByTestId("progress-trends-building")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByTestId("progress-edge-finish")); });
  await waitFor(() => expect(screen.queryByTestId("progress-trends-building")).toBeNull());
  expect(screen.getAllByText("₹15K").length).toBeGreaterThan(0);
  expect(getPortfolioStore).not.toHaveBeenCalled();
});

it("still waits for month-end when activity exists only in the current month", async () => {
  const fixture = createProgressEdgeFixture("empty", false);
  fixture.store.getState().addCashEntry({
    id: "current-deposit", date: "2026-09-01", amount: 1000,
    type: "addition", purpose: "capitalContribution", label: "Synthetic deposit",
  });
  const screen = render(<ProgressScreen store={fixture.store} now={progressEdgeNow} historicalPriceFetcher={fixture.fetcher} />);
  expect(await screen.findByText("Waiting for the first month-end")).toBeTruthy();
  expect(fixture.store.getState().monthlySnapshots).toEqual([]);
});

it("shows the real historical-price failure and retains retry", async () => {
  const fixture = createProgressEdgeFixture("error", false);
  const saved = fixture.store.getState().monthlySnapshots;
  const screen = render(<ProgressScreen store={fixture.store} now={progressEdgeNow} historicalPriceFetcher={fixture.fetcher} />);
  expect(await screen.findByText("Historical prices are unavailable")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Snapshot status details"));
  expect(screen.getByLabelText("Retry monthly history")).toBeTruthy();
  expect(screen.getByText(/2 months are waiting/)).toBeTruthy();
  const attempts = fixture.attempts();
  fireEvent.press(screen.getByLabelText("Retry monthly history"));
  await waitFor(() => expect(fixture.attempts()).toBeGreaterThan(attempts));
  expect(fixture.store.getState().monthlySnapshots).toBe(saved);
});

it("generates exact month-end values in memory without replacing the stored June record", async () => {
  const fixture = createProgressEdgeFixture("building", false);
  const june = fixture.store.getState().monthlySnapshots[0];
  render(<ProgressScreen store={fixture.store} now={progressEdgeNow} historicalPriceFetcher={fixture.fetcher} />);
  await waitFor(() => expect(fixture.attempts()).toBe(1));
  expect(fixture.store.getState().monthlySnapshots).toEqual([june]);
  await act(async () => { fixture.release(); });
  await waitFor(() => expect(fixture.store.getState().monthlySnapshots).toHaveLength(3));
  expect(fixture.store.getState().monthlySnapshots.find(({ month }) => month === "2026-06")).toEqual(june);
  for (const month of ["2026-07", "2026-08"]) {
    expect(fixture.store.getState().monthlySnapshots.find((entry) => entry.month === month))
      .toMatchObject({ portfolioValue: 15000, investedValue: 10000, equityValue: 15000, monthlyInvestment: 0 });
  }
  fixture.dispose();
});
