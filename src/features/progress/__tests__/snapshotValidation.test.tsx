import { act, fireEvent, render } from "@testing-library/react-native";
import { ProgressScreen, ReviewSnapshotScreen } from "@/src/features/progress";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { MonthlySnapshot } from "@/src/types";
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }) };
});
const snapshot: MonthlySnapshot = { id: "snapshot", month: "2026-08", portfolioValue: 1000, cashValue: 1000, equityValue: 0, debtValue: 0, cryptoValue: 0, investedValue: 0, monthlyInvestment: 0 };
const now = new Date("2026-09-02T10:00:00Z");
function setup() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage });
  store.getState().addMonthlySnapshot(snapshot);
  return { storage, store };
}
describe("snapshot validation and recovery UI", () => {
  it("suggests the rounded generated total without saving until confirmation", () => {
    const { store } = setup();
    const legacy = { ...snapshot, portfolioValue: 60891.74, equityValue: 1611.27,
      debtValue: 59280.46, cashValue: 0,
      generated: { source: "auto" as const, generatedAt: now.toISOString(), priceBasis: "manual-fallback" as const, priceEvidence: [], warnings: [] } };
    store.setState({ monthlySnapshots: [legacy] });
    const progress = render(<ProgressScreen store={store} now={now} />);
    expect(progress.queryByText("Checking monthly history")).toBeNull();
    expect(progress.queryByText("Trend history is still building")).toBeNull();
    progress.unmount();
    const onComplete = jest.fn();
    const view = render(<ReviewSnapshotScreen store={store} now={now} onCancel={jest.fn()} onComplete={onComplete} />);
    expect(view.getByTestId("snapshot-rounding-guidance")).toBeTruthy();
    expect(view.getByTestId("snapshot-portfolio-input").props.value).toBe("60891.73");
    expect(store.getState().monthlySnapshots).toEqual([legacy]);
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(store.getState().captureBackup().payload.portfolio.monthlySnapshots[0]).toMatchObject({
      id: snapshot.id, portfolioValue: 60891.73, equityValue: 1611.27, debtValue: 59280.46,
    });
  });
  it("does not carry classified flows from the old month into a corrected month", () => {
    const { store } = setup();
    store.getState().updateMonthlySnapshot({ ...snapshot, performanceBasis: { status: "complete", netExternalFlow: 100, weightedExternalFlow: 50, warnings: [] } });
    const view = render(<ReviewSnapshotScreen store={store} now={now} onCancel={jest.fn()} onComplete={jest.fn()} />);
    fireEvent.changeText(view.getByTestId("snapshot-month-input"), "2026-07");
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(store.getState().monthlySnapshots[0]).toMatchObject({ id: snapshot.id, month: "2026-07", performanceBasis: { status: "unavailable" } });
  });
  it("allows correction without changing a supported signed Cash balance", () => {
    const { store } = setup();
    store.getState().updateMonthlySnapshot({ ...snapshot, cashValue: -100, equityValue: 1000, portfolioValue: 900 });
    const onComplete = jest.fn();
    const view = render(<ReviewSnapshotScreen store={store} now={now} onCancel={jest.fn()} onComplete={onComplete} />);
    fireEvent.changeText(view.getByTestId("snapshot-notes-input"), "Verified balances");
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(store.getState().monthlySnapshots[0]).toMatchObject({ cashValue: -100, equityValue: 1000, portfolioValue: 900, notes: "Verified balances" });
  });
  it("repairs an invalid legacy month on the same record rather than appending a duplicate", () => {
    const { store } = setup();
    store.setState({ monthlySnapshots: [{ ...snapshot, month: "2026-13" }] });
    const view = render(<ReviewSnapshotScreen store={store} now={now} onCancel={jest.fn()} onComplete={jest.fn()} />);
    fireEvent.changeText(view.getByTestId("snapshot-month-input"), "2026-08");
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(store.getState().monthlySnapshots).toHaveLength(1);
    expect(store.getState().monthlySnapshots[0]).toMatchObject({ id: snapshot.id, month: "2026-08" });
    expect(store.getState().captureBackup().payload.portfolio.monthlySnapshots).toHaveLength(1);
  });
  it("blocks inconsistent totals and non-calendar months with field feedback", () => {
    const { store } = setup();
    const onComplete = jest.fn();
    const view = render(<ReviewSnapshotScreen store={store} now={now} onCancel={jest.fn()} onComplete={onComplete} />);
    fireEvent.changeText(view.getByTestId("snapshot-portfolio-input"), "2000");
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(view.getByText("Portfolio value must equal Equity + Debt + Crypto + Cash.")).toBeTruthy();
    fireEvent.changeText(view.getByTestId("snapshot-month-input"), "2026-13");
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(view.getByText("Use a valid month in YYYY-MM format.")).toBeTruthy();
    expect(store.getState().monthlySnapshots).toEqual([snapshot]);
    expect(onComplete).not.toHaveBeenCalled();
  });
  it("keeps the form and stored values on a failed save and allows retry", () => {
    const { storage, store } = setup();
    const onComplete = jest.fn();
    const view = render(<ReviewSnapshotScreen store={store} now={now} onCancel={jest.fn()} onComplete={onComplete} />);
    const write = storage.setItem;
    storage.setItem = () => { throw new Error("Storage full"); };
    fireEvent.changeText(view.getByTestId("snapshot-portfolio-input"), "2000");
    fireEvent.changeText(view.getByTestId("snapshot-cash-input"), "2000");
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(view.getByText(/Snapshot could not be saved/)).toBeTruthy();
    expect(view.getByTestId("snapshot-cash-input").props.value).toBe("2000");
    expect(store.getState().monthlySnapshots[0].cashValue).toBe(1000);
    expect(onComplete).not.toHaveBeenCalled();
    storage.setItem = write;
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(store.getState().monthlySnapshots[0].cashValue).toBe(2000);
  });
  it("offers explicit repair and prefills the inconsistent record without silently changing it", () => {
    const { store } = setup();
    act(() => store.setState({ monthlySnapshots: [{ ...snapshot, portfolioValue: 2000 }] }));
    const onReviewSnapshot = jest.fn();
    const progress = render(<ProgressScreen store={store} now={now} onReviewSnapshot={onReviewSnapshot} />);
    fireEvent.press(progress.getByTestId("snapshot-repair-action"));
    expect(onReviewSnapshot).toHaveBeenCalledTimes(1);
    progress.unmount();
    const view = render(<ReviewSnapshotScreen store={store} now={now} onCancel={jest.fn()} onComplete={jest.fn()} />);
    expect(view.getByTestId("snapshot-repair-guidance")).toBeTruthy();
    expect(view.getByTestId("snapshot-portfolio-input").props.value).toBe("2000");
    expect(view.getByTestId("snapshot-cash-input").props.value).toBe("1000");
    expect(store.getState().monthlySnapshots[0].portfolioValue).toBe(2000);
    fireEvent.changeText(view.getByTestId("snapshot-cash-input"), "2000");
    fireEvent.press(view.getByTestId("save-monthly-snapshot-button"));
    expect(store.getState().captureBackup().payload.portfolio.monthlySnapshots[0].cashValue).toBe(2000);
  });
});
