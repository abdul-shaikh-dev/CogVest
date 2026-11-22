import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useMonthEndSnapshotAutomation } from "@/src/features/progress";

import RootLayout from "../../app/_layout";
import { getByComponentType } from "@/src/testing/componentQueries";
import { setScreenSecureAsync } from "@/modules/cogvest-screen-security";
import { getAppLockStore } from "@/src/services/security/appLock";

const mockResetAffectedStorage = jest.fn();
let mockRestoreEpoch = 0;
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();

// App lock reads native storage; these tests run with it off (#761).
jest.mock("@/src/services/security/appLock", () => {
  const actual = jest.requireActual("@/src/services/security/appLock");
  const { createMemoryJsonStorage } = jest.requireActual("@/src/services/storage");
  const store = actual.createAppLockStore({
    auth: { authenticate: async () => ({ success: true }), hasDeviceLock: async () => true },
    storage: createMemoryJsonStorage(),
  });
  return { ...actual, getAppLockStore: () => store };
});
jest.mock("@/modules/cogvest-screen-security", () => ({ setScreenSecureAsync: jest.fn(async () => undefined) }));
jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0 },
  authenticateAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
}));

jest.mock("@/src/features/progress", () => ({
  useMonthEndSnapshotAutomation: jest.fn(),
}));

jest.mock("@/src/store", () => ({
  getPortfolioStore: () => ({
    getState: () => ({
      preferences: { appearance: "dark" },
      resetAffectedStorage: mockResetAffectedStorage,
      storageRecovery: undefined,
      restoreEpoch: mockRestoreEpoch,
    }),
    subscribe: () => () => undefined,
  }),
}));

jest.mock("expo-router", () => {
  const React = require("react");

  const Stack = ({ children }: { children: React.ReactNode }) =>
    React.createElement("Stack", {}, children);
  Stack.Screen = ({ name, options }: { name: string; options?: unknown }) =>
    React.createElement("Stack.Screen", {
      name,
      options,
      testID: `stack-screen-${name}`,
    });

  return { Stack, usePathname: () => "/dashboard", router: {
    canDismiss: () => true, dismissAll: () => mockDismissAll(), replace: (path: string) => mockReplace(path),
  }, useNavigationContainerRef: () => ({
    canGoBack: () => true, current: null,
  }), useRootNavigationState: () => undefined, useRouter: () => ({}) };
});

jest.mock("expo-status-bar", () => {
  const React = require("react");

  return {
    StatusBar: ({ style }: { style: string }) => React.createElement("StatusBar", { style }),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement("SafeAreaProvider", {}, children),
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement("SafeAreaView", {}, children),
  };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");

  return {
    GestureHandlerRootView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement("GestureHandlerRootView", { style }, children),
  };
});

describe("RootLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRestoreEpoch = 0;
  });

  it("keeps readable restore completion outside the remounted navigation tree", async () => {
    const view = await render(<RootLayout />);
    await waitFor(() => expect(view.getByTestId("stack-screen-(tabs)")).toBeTruthy());
    expect(view.queryByTestId("backup-restore-done")).toBeNull();
    mockRestoreEpoch = 1;
    await view.rerender(<RootLayout />);
    await waitFor(() => expect(view.getByTestId("backup-restore-done")).toBeTruthy());
    expect(view.getByText("Portfolio restored").props.accessibilityLiveRegion).toBe("polite");
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/");
    await fireEvent.press(view.getByTestId("backup-restore-done"));
    expect(view.queryByTestId("backup-restore-done")).toBeNull();
    await view.rerender(<RootLayout />);
    expect(view.queryByTestId("backup-restore-done")).toBeNull();
  });

  it("covers every route and blocks the recent-apps preview while App lock is on (#761)", async () => {
    const view = await render(<RootLayout />);
    await waitFor(() => expect(view.getByTestId("stack-screen-(tabs)")).toBeTruthy());
    expect(view.queryByTestId("app-lock-screen")).toBeNull();
    expect(setScreenSecureAsync).not.toHaveBeenCalled();

    const store = getAppLockStore();
    await act(async () => {
      store.setState({ locked: true, settings: { enabled: true, relockAfterSeconds: 60 } });
    });
    // The navigator stays mounted under the lock, so a linked route is hidden too.
    expect(view.getByTestId("app-lock-screen")).toBeTruthy();
    expect(view.getByTestId("stack-screen-settings")).toBeTruthy();
    expect(setScreenSecureAsync).toHaveBeenCalledWith(true);

    await act(async () => {
      store.setState({ locked: false, settings: { enabled: false, relockAfterSeconds: 60 } });
    });
    expect(view.queryByTestId("app-lock-screen")).toBeNull();
    expect(setScreenSecureAsync).toHaveBeenLastCalledWith(false);
  });

  it("wraps navigation with the gesture handler root required by native navigation", async () => {
    const { getByTestId, container } = await render(<RootLayout />);
    const layout = getByComponentType({ container }, GestureHandlerRootView);

    expect(layout.props.style).toEqual({ flex: 1, backgroundColor: "#181A1B" });
    await waitFor(() => expect(getByTestId("stack-screen-(tabs)")).toBeTruthy());
  });

  it("registers the add holding route used by dashboard and holdings actions", async () => {
    const { getByTestId } = await render(<RootLayout />);

    await waitFor(() => expect(getByTestId("stack-screen-(tabs)")).toBeTruthy());
    expect(getByTestId("stack-screen-settings")).toBeTruthy();
    expect(getByTestId("stack-screen-add-holding")).toBeTruthy();
    expect(getByTestId("stack-screen-visual-qa-seed")).toBeTruthy();
  });

  it("lets app screens own their premium headers", async () => {
    const { getByTestId } = await render(<RootLayout />);

    await waitFor(() => expect(getByTestId("stack-screen-(tabs)")).toBeTruthy());
    expect(getByTestId("stack-screen-index").props.options).toEqual({
      headerShown: false,
      animation: "none",
    });
    expect(getByTestId("stack-screen-add-holding").props.options).toEqual({
      headerShown: false,
    });
    expect(getByTestId("stack-screen-settings").props.options).toEqual({
      headerShown: false,
    });
  });

  it("runs month-end snapshot automation on app launch", async () => {
    await render(<RootLayout />);

    await waitFor(() =>
      expect(useMonthEndSnapshotAutomation).toHaveBeenCalledTimes(1),
    );
    expect(useMonthEndSnapshotAutomation).toHaveBeenCalledWith({
      enabled: true,
    });
  });
});
