import React from "react";
import { render } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useMonthEndSnapshotAutomation } from "@/src/features/progress";

import RootLayout from "../../app/_layout";

const mockResetAffectedStorage = jest.fn();

jest.mock("@/src/features/progress", () => ({
  useMonthEndSnapshotAutomation: jest.fn(),
}));

jest.mock("@/src/store", () => ({
  getPortfolioStore: () => ({
    getState: () => ({
      resetAffectedStorage: mockResetAffectedStorage,
      storageRecovery: undefined,
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

  return { Stack };
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
  });

  it("wraps navigation with the gesture handler root required by native navigation", () => {
    const { UNSAFE_getByType } = render(<RootLayout />);
    const layout = UNSAFE_getByType(GestureHandlerRootView);

    expect(layout.props.style).toEqual({ flex: 1 });
  });

  it("registers the add holding route used by dashboard and holdings actions", () => {
    const { getByTestId } = render(<RootLayout />);

    expect(getByTestId("stack-screen-(tabs)")).toBeTruthy();
    expect(getByTestId("stack-screen-settings")).toBeTruthy();
    expect(getByTestId("stack-screen-add-holding")).toBeTruthy();
    expect(getByTestId("stack-screen-visual-qa-seed")).toBeTruthy();
  });

  it("lets app screens own their premium headers", () => {
    const { getByTestId } = render(<RootLayout />);

    expect(getByTestId("stack-screen-add-holding").props.options).toEqual({
      headerShown: false,
    });
    expect(getByTestId("stack-screen-settings").props.options).toEqual({
      headerShown: false,
    });
  });

  it("runs month-end snapshot automation on app launch", () => {
    render(<RootLayout />);

    expect(useMonthEndSnapshotAutomation).toHaveBeenCalledTimes(1);
  });
});
