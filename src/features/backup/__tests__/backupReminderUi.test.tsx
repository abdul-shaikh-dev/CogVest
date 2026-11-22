import { act, fireEvent, render } from "@testing-library/react-native";

import { backupReminderRecordThreshold } from "@/src/domain/backupReminder";
import { DashboardScreen } from "@/src/features/dashboard";
import { SettingsScreen } from "@/src/features/settings";
import { createBackupStatusStore } from "@/src/services/backup/backupStatus";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, selectRawSnapshot } from "@/src/store";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "test-version" } } }));
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));

const start = new Date("2026-01-01T09:00:00.000Z");
const later = (days: number) => new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

function setup(entries: number) {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now: () => start });
  for (let index = 0; index < entries; index += 1) {
    store.getState().addCashEntry({
      id: `cash-${index}`, type: "addition", purpose: "capitalContribution",
      label: "Synthetic cash", date: "2026-01-01", amount: 100,
    });
  }
  let clock = start;
  const backupStatusStore = createBackupStatusStore({ storage, now: () => clock });
  return { backupStatusStore, setClock: (date: Date) => { clock = date; }, storage, store };
}

describe("backup reminder on the Dashboard (#759)", () => {
  beforeEach(() => mockPush.mockClear());

  it("is absent until a backup is due, then links to Back up", async () => {
    const { backupStatusStore, store } = setup(2);
    const early = await render(<DashboardScreen backupStatusStore={backupStatusStore} now={later(29)} store={store} />);
    expect(early.queryByTestId("dashboard-backup-reminder")).toBeNull();
    await early.unmount();

    const due = await render(<DashboardScreen backupStatusStore={backupStatusStore} now={later(30)} store={store} />);
    expect(due.getByText("Back up your portfolio")).toBeTruthy();
    expect(due.getByText("Your records are only on this phone. A backup lets you restore them if it is lost or reset.")).toBeTruthy();
    await fireEvent.press(due.getByTestId("dashboard-backup-reminder-backup"));
    expect(mockPush).toHaveBeenCalledWith("/backup?mode=export");
  });

  it("hides for one interval after Not now, and the snooze survives a restart", async () => {
    const { backupStatusStore, setClock, storage, store } = setup(2);
    setClock(later(30));
    const view = await render(<DashboardScreen backupStatusStore={backupStatusStore} now={later(30)} store={store} />);
    await fireEvent.press(view.getByTestId("dashboard-backup-reminder-dismiss"));
    expect(view.queryByTestId("dashboard-backup-reminder")).toBeNull();
    await view.unmount();

    const restarted = createBackupStatusStore({ storage });
    const nextWeek = await render(<DashboardScreen backupStatusStore={restarted} now={later(37)} store={store} />);
    expect(nextWeek.queryByTestId("dashboard-backup-reminder")).toBeNull();
    await nextWeek.unmount();
    const nextMonth = await render(<DashboardScreen backupStatusStore={restarted} now={later(60)} store={store} />);
    expect(nextMonth.getByTestId("dashboard-backup-reminder")).toBeTruthy();
  });

  it("names the records added since the last backup", async () => {
    const { backupStatusStore, store } = setup(1);
    backupStatusStore.getState().recordExport(selectRawSnapshot(store.getState()));
    for (let index = 0; index < backupReminderRecordThreshold; index += 1) {
      store.getState().addCashEntry({
        id: `new-${index}`, type: "addition", purpose: "capitalContribution",
        label: "Synthetic cash", date: "2026-01-01", amount: 10,
      });
    }
    const view = await render(<DashboardScreen backupStatusStore={backupStatusStore} now={later(2)} store={store} />);
    expect(view.getByText(`${backupReminderRecordThreshold} records added since your last backup`)).toBeTruthy();
  });

  it("stays out of Minimal Mode until the gap is long", async () => {
    const { backupStatusStore, store } = setup(2);
    store.getState().updatePreferences({ displayMode: "minimal" });
    const view = await render(<DashboardScreen backupStatusStore={backupStatusStore} now={later(60)} store={store} />);
    expect(view.queryByTestId("dashboard-backup-reminder")).toBeNull();
    await view.unmount();
    const long = await render(<DashboardScreen backupStatusStore={backupStatusStore} now={later(90)} store={store} />);
    expect(long.getByTestId("dashboard-backup-reminder")).toBeTruthy();
  });
});

describe("backup reminder in Settings (#759)", () => {
  it("shows no backup yet, then the local date of the last backup", async () => {
    const { backupStatusStore, setClock, store } = setup(1);
    const view = await render(<SettingsScreen backupStatusStore={backupStatusStore} store={store} />);
    expect(view.getByTestId("backup-last-date").props.children).toBe("No backup recorded on this phone yet.");

    setClock(new Date(2026, 10, 21, 8, 30));
    await act(async () => backupStatusStore.getState().recordExport(selectRawSnapshot(store.getState())));
    expect(view.getByTestId("backup-last-date").props.children).toBe("Last backup: 21 Nov 2026");
  });

  it("saves the chosen reminder interval", async () => {
    const { backupStatusStore, storage, store } = setup(1);
    const view = await render(<SettingsScreen backupStatusStore={backupStatusStore} store={store} />);
    expect(view.getByTestId("backup-reminder-30").props.accessibilityState.checked).toBe(true);
    await fireEvent.press(view.getByTestId("backup-reminder-0"));
    expect(view.getByTestId("backup-reminder-0").props.accessibilityState.checked).toBe(true);
    expect(createBackupStatusStore({ storage }).getState().status.reminderDays).toBe(0);
  });
});
