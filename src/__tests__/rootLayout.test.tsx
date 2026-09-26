import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useMonthEndSnapshotAutomation } from "@/src/features/progress";

import RootLayout from "../../app/_layout";

const mockResetAffectedStorage = jest.fn();
let mockRestoreEpoch = 0;
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();

jest.mock("@/src/features/progress", () => ({
  useMonthEndSnapshotAutomation: jest.fn(),
}));

jest.mock("@/src/store", () => ({
  getPortfolioStore: () => ({
    getState: () => ({
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
  } };
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
    const view = render(<RootLayout />);
    await waitFor(() => expect(view.getByTestId("stack-screen-(tabs)")).toBeTruthy());
    expect(view.queryByTestId("backup-restore-done")).toBeNull();
    mockRestoreEpoch = 1;
    view.rerender(<RootLayout />);
    await waitFor(() => expect(view.getByTestId("backup-restore-done")).toBeTruthy());
    expect(view.getByText("Portfolio restored").props.accessibilityLiveRegion).toBe("polite");
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/");
    fireEvent.press(view.getByTestId("backup-restore-done"));
    expect(view.queryByTestId("backup-restore-done")).toBeNull();
    view.rerender(<RootLayout />);
    expect(view.queryByTestId("backup-restore-done")).toBeNull();
  });

  it("wraps navigation with the gesture handler root required by native navigation", async () => {
    const { getByTestId, UNSAFE_getByType } = render(<RootLayout />);
    const layout = UNSAFE_getByType(GestureHandlerRootView);

    expect(layout.props.style).toEqual({ flex: 1 });
    await waitFor(() => expect(getByTestId("stack-screen-(tabs)")).toBeTruthy());
  });

  it("registers the add holding route used by dashboard and holdings actions", async () => {
    const { getByTestId } = render(<RootLayout />);

    await waitFor(() => expect(getByTestId("stack-screen-(tabs)")).toBeTruthy());
    expect(getByTestId("stack-screen-settings")).toBeTruthy();
    expect(getByTestId("stack-screen-add-holding")).toBeTruthy();
    expect(getByTestId("stack-screen-visual-qa-seed")).toBeTruthy();
  });

  it("lets app screens own their premium headers", async () => {
    const { getByTestId } = render(<RootLayout />);

    await waitFor(() => expect(getByTestId("stack-screen-(tabs)")).toBeTruthy());
    expect(getByTestId("stack-screen-add-holding").props.options).toEqual({
      headerShown: false,
    });
    expect(getByTestId("stack-screen-settings").props.options).toEqual({
      headerShown: false,
    });
  });

  it("runs month-end snapshot automation on app launch", async () => {
    render(<RootLayout />);

    await waitFor(() =>
      expect(useMonthEndSnapshotAutomation).toHaveBeenCalledTimes(1),
    );
    expect(useMonthEndSnapshotAutomation).toHaveBeenCalledWith({
      enabled: true,
    });
  });
});
