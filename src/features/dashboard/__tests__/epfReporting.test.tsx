import { act, fireEvent, render, renderHook, within } from "@testing-library/react-native";
import { DashboardScreen } from "../DashboardScreen";
import { useDashboard } from "../useDashboard";
import { createEpfReportingFixture, epfReportingDate } from "@/src/testing/epfReportingFixture";

test("EPF + PPF + Debt is 200000 once, with unknown capital and no snapshot mutation", () => {
  const store = createEpfReportingFixture();
  const before = store.getState().captureBackup().payload;
  const { result } = renderHook(() => useDashboard({ store, now: epfReportingDate }));
  expect(result.current.totalValue).toBe(200000);
  expect(result.current.allocation.find(item => item.assetClass === "debt")).toMatchObject({ value: 200000, percentage: 100 });
  expect(result.current.investedCapitalComplete).toBe(false);
  expect(result.current.rollupTotals.pnl).toBeNull();
  expect(store.getState().captureBackup().payload).toEqual(before);
  act(() => store.getState().applyEpfCommand({ commandId: "delete", reason: "Remove test account",
    change: { type: "accountRemove", id: "epf" } }, store.getState().getBackupRevision()));
  expect(result.current.totalValue).toBe(60000);
  expect(result.current.investedCapitalComplete).toBe(true);
});

test.each(["standard", "minimal"] as const)("shows EPF evidence, unknown basis and masking in %s mode", displayMode => {
  const store = createEpfReportingFixture();
  store.getState().updatePreferences({ displayMode });
  const screen = render(<DashboardScreen store={store} now={epfReportingDate} />);
  expect(within(screen.getByTestId("dashboard-allocation-debt")).getByLabelText("₹2,00,000.00")).toBeTruthy();
  expect(screen.getByTestId("dashboard-epf-value").props.accessibilityLabel).toBe("₹1,40,000.00");
  expect(screen.getByText("Last evidence 2026-01-01 · later activity unconfirmed")).toBeTruthy();
  if (displayMode === "minimal") fireEvent.press(screen.getByTestId("dashboard-performance-toggle"));
  expect(screen.getByText("Unknown")).toBeTruthy();
  expect(screen.getAllByText("Unavailable")).toHaveLength(2);
  fireEvent.press(screen.getByTestId("dashboard-mask-toggle"));
  expect(screen.getByTestId("dashboard-epf-value").props.accessibilityLabel).toBe("Amount hidden");
});
