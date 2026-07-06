import React from "react";
import { render } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useMonthEndSnapshotAutomation } from "@/src/features/progress";

import RootLayout from "../../app/_layout";

jest.mock("@/src/features/progress", () => ({
  useMonthEndSnapshotAutomation: jest.fn(),
}));

jest.mock("expo-router", () => {
  const React = require("react");

  const Stack = ({ children }: { children: React.ReactNode }) =>
    React.createElement("Stack", {}, children);
  Stack.Screen = ({ name, options }: { name: string; options?: unknown }) =>
    React.createElement("Stack.Screen", { name, options });

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

type TestElement = React.ReactElement<{
  children?: React.ReactNode;
  name?: string;
  options?: unknown;
  style?: unknown;
}>;

function isElement(node: unknown): node is TestElement {
  return React.isValidElement(node);
}

function collectScreenNames(node: unknown): string[] {
  if (!isElement(node)) {
    return [];
  }

  const ownName = typeof node.props.name === "string" ? [node.props.name] : [];
  const childNames = React.Children.toArray(node.props.children).flatMap(collectScreenNames);

  return [...ownName, ...childNames];
}

function collectScreenOptions(node: unknown): Record<string, unknown> {
  if (!isElement(node)) {
    return {};
  }

  const ownOptions =
    typeof node.props.name === "string"
      ? { [node.props.name]: node.props.options }
      : {};
  const childOptions = React.Children.toArray(node.props.children).reduce(
    (accumulator, child) => ({
      ...accumulator,
      ...collectScreenOptions(child),
    }),
    {},
  );

  return { ...ownOptions, ...childOptions };
}

describe("RootLayout", () => {
  it("wraps navigation with the gesture handler root required by native navigation", () => {
    const layout = RootLayout() as TestElement;

    expect(layout.type).toBe(GestureHandlerRootView);
    expect(layout.props.style).toEqual({ flex: 1 });
  });

  it("registers the add holding route used by dashboard and holdings actions", () => {
    const layout = RootLayout();

    expect(collectScreenNames(layout)).toEqual(
      expect.arrayContaining([
        "(tabs)",
        "settings",
        "add-holding",
        "visual-qa-seed",
      ]),
    );
  });

  it("lets app screens own their premium headers", () => {
    const layout = RootLayout();
    const screenOptions = collectScreenOptions(layout);

    expect(screenOptions["add-holding"]).toEqual({ headerShown: false });
    expect(screenOptions.settings).toEqual({ headerShown: false });
  });

  it("runs month-end snapshot automation on app launch", () => {
    render(<RootLayout />);

    expect(useMonthEndSnapshotAutomation).toHaveBeenCalledTimes(1);
  });
});
