import { act, fireEvent, render, renderHook, within } from "@testing-library/react-native";
import { DashboardScreen } from "../DashboardScreen";
import { useDashboard } from "../useDashboard";
import { createEpfReportingFixture, epfReportingDate } from "@/src/testing/epfReportingFixture";

test("EPF + PPF + Debt is 200000 once, with unknown capital and no snapshot mutation", async () => {
  const store = createEpfReportingFixture();
  const before = store.getState().captureBackup().payload;
  const { result } = await renderHook(() => useDashboard({ store, now: epfReportingDate }));
  expect(result.current.totalValue).toBe(200000);
  expect(result.current.allocation.find(item => item.assetClass === "debt")).toMatchObject({ value: 200000, percentage: 100 });
  expect(result.current.investedCapitalComplete).toBe(false);
  expect(result.current.rollupTotals.pnl).toBeNull();
  expect(store.getState().captureBackup().payload).toEqual(before);
  await act(() => store.getState().applyEpfCommand({ commandId: "delete", reason: "Remove test account",
    change: { type: "accountRemove", id: "epf" } }, store.getState().getBackupRevision()));
  expect(result.current.totalValue).toBe(60000);
  expect(result.current.investedCapitalComplete).toBe(true);
});

test("a linked legacy EPF holding is replaced by its account without deleting the holding", async () => {
  const store = createEpfReportingFixture();
  store.getState().addAsset({ id: "legacy-epf", name: "Old EPF", symbol: "EPF", ticker: "EPF",
    assetClass: "debt", currency: "INR", instrumentType: "other" });
  store.getState().addOpeningPosition({ id: "legacy-opening", assetId: "legacy-epf", date: "2025-06-01",
    quantity: 1, averageCostPrice: 130000, currentPrice: 140000 });
  const total = async (now: Date) => (await renderHook(() => useDashboard({ store, now }))).result.current.totalValue;
  expect(await total(epfReportingDate)).toBe(340000);
  const account = store.getState().epf.accounts[0];
  await act(() => store.getState().applyEpfCommand({ commandId: "link", reason: "Link old EPF holding",
    change: { type: "accountPut", account: { ...account, legacyAssetId: "legacy-epf" } } }, store.getState().getBackupRevision()));
  expect(await total(epfReportingDate)).toBe(200000);
  expect(store.getState().assets.some((asset) => asset.id === "legacy-epf")).toBe(true);
});

test.each(["standard", "minimal"] as const)("shows EPF evidence, unknown basis and masking in %s mode", async displayMode => {
  const store = createEpfReportingFixture();
  store.getState().updatePreferences({ displayMode });
  const screen = await render(<DashboardScreen store={store} now={epfReportingDate} />);
  expect(within(screen.getByTestId("dashboard-allocation-debt")).getByLabelText("₹2,00,000.00")).toBeTruthy();
  expect(screen.getByTestId("dashboard-epf-value").props.accessibilityLabel).toBe("₹1,40,000.00");
  expect(screen.getByText("EPF · as of 01 Jan 2026 · later activity unconfirmed")).toBeTruthy();
  if (displayMode === "minimal") await fireEvent.press(screen.getByTestId("dashboard-performance-toggle"));
  expect(screen.getByText("Unknown")).toBeTruthy();
  // P&L, P&L % and the portfolio return, which has no snapshot to start from.
  expect(screen.getAllByText("Unavailable")).toHaveLength(3);
  expect(within(screen.getByTestId("dashboard-xirr")).getByText("Save a month-end snapshot in Progress, or set a start date, to measure the return.")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("dashboard-mask-toggle"));
  expect(screen.getByTestId("dashboard-epf-value").props.accessibilityLabel).toBe("Amount hidden");
});

test("the EPF card opens the accounts and describes Progress scope accurately", async () => {
  const store = createEpfReportingFixture();
  const onOpenEpf = jest.fn();
  const screen = await render(<DashboardScreen store={store} now={epfReportingDate} onOpenEpf={onOpenEpf} />);
  expect(screen.getByText("Included in Debt. Progress shows EPF month-end values separately.")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("dashboard-open-epf"));
  expect(onOpenEpf).toHaveBeenCalledTimes(1);
  await screen.unmount();
  expect((await render(<DashboardScreen store={store} now={epfReportingDate} />)).queryByTestId("dashboard-open-epf")).toBeNull();
});
