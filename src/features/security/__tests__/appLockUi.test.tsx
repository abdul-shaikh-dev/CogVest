import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { LocalAuthenticationResult } from "expo-local-authentication";
import { Alert, AppState } from "react-native";

import { createAppLockStore, type DeviceAuth } from "@/src/services/security/appLock";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { appLockStorageKey } from "@/src/services/storage/backupKeys";

import { AppLockGate } from "../AppLockGate";
import { AppLockSettings } from "../AppLockSettings";

jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0 },
  authenticateAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
}));

function harness({ enabled = false, hasLock = true, results = [] as LocalAuthenticationResult[] } = {}) {
  const storage = createMemoryJsonStorage();
  if (enabled) storage.setItem(appLockStorageKey, { version: 1, enabled: true, relockAfterSeconds: 60 });
  const auth: DeviceAuth & { authenticate: jest.Mock } = {
    hasDeviceLock: jest.fn(async () => hasLock),
    authenticate: jest.fn(async (): Promise<LocalAuthenticationResult> => results.shift() ?? { success: true }),
  };
  return { auth, storage, store: createAppLockStore({ auth, storage }) };
}

describe("App lock screen (#761)", () => {
  beforeEach(() => {
    Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  });

  it("covers the app on a cold start and asks for the phone's lock at once", async () => {
    const { auth, store } = harness({ enabled: true, results: [{ success: false, error: "user_cancel" }] });
    const view = await render(<AppLockGate appLockStore={store} />);
    expect(view.getByTestId("app-lock-screen")).toBeTruthy();
    expect(view.getByText("CogVest is locked")).toBeTruthy();
    await waitFor(() => expect(auth.authenticate).toHaveBeenCalledTimes(1));
    expect(store.getState().locked).toBe(true);

    await fireEvent.press(view.getByTestId("app-lock-unlock"));
    await waitFor(() => expect(store.getState().locked).toBe(false));
    expect(view.queryByTestId("app-lock-screen")).toBeNull();
  });

  it("shows why an attempt failed", async () => {
    const { store } = harness({ enabled: true, results: [{ success: false, error: "lockout" }] });
    const view = await render(<AppLockGate appLockStore={store} />);
    expect(await view.findByText("Too many attempts. Wait a moment, then try again.")).toBeTruthy();
  });

  it("renders nothing while unlocked", async () => {
    const { store } = harness();
    const view = await render(<AppLockGate appLockStore={store} />);
    expect(view.queryByTestId("app-lock-screen")).toBeNull();
  });

  it("explains when it turned itself off because the screen lock was removed", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const { store } = harness({ enabled: true, hasLock: false });
    const view = await render(<AppLockGate appLockStore={store} />);
    await waitFor(() => expect(view.queryByTestId("app-lock-screen")).toBeNull());
    expect(alert).toHaveBeenCalledWith("App lock is off", expect.stringContaining("no longer has a screen lock"));
    alert.mockRestore();
  });
});

describe("App lock in Settings (#761)", () => {
  it("explains why it is unavailable on a phone without a screen lock", async () => {
    const { auth, store } = harness({ hasLock: false });
    const view = await render(<AppLockSettings appLockStore={store} auth={auth} />);
    expect(await view.findByTestId("app-lock-unavailable")).toBeTruthy();
    expect(view.getByTestId("app-lock-toggle").props.accessibilityState).toMatchObject({ checked: false, disabled: true });
  });

  it("turns on after the phone's lock, then offers the relock delay", async () => {
    const { auth, store } = harness();
    const view = await render(<AppLockSettings appLockStore={store} auth={auth} />);
    await waitFor(() => expect(view.getByTestId("app-lock-toggle").props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(view.getByTestId("app-lock-toggle"));
    await waitFor(() => expect(view.getByTestId("app-lock-toggle").props.accessibilityState.checked).toBe(true));
    expect(view.getByText("Screenshots and the recent-apps preview are blocked while App lock is on.")).toBeTruthy();
    expect(view.getByTestId("app-lock-relock-60").props.accessibilityState.checked).toBe(true);

    await fireEvent.press(view.getByTestId("app-lock-relock-0"));
    expect(store.getState().settings.relockAfterSeconds).toBe(0);
  });

  it("stays off and says so when the prompt is cancelled", async () => {
    const { auth, store } = harness({ results: [{ success: false, error: "user_cancel" }] });
    const view = await render(<AppLockSettings appLockStore={store} auth={auth} />);
    await waitFor(() => expect(view.getByTestId("app-lock-toggle").props.accessibilityState.disabled).toBe(false));
    await act(async () => { fireEvent.press(view.getByTestId("app-lock-toggle")); });
    expect(await view.findByText("App lock was not changed.")).toBeTruthy();
    expect(store.getState().settings.enabled).toBe(false);
  });
});
