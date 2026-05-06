import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import RootLayout from "../../app/_layout";

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

describe("RootLayout", () => {
  it("wraps navigation with the gesture handler root required by native navigation", () => {
    const layout = RootLayout() as TestElement;

    expect(layout.type).toBe(GestureHandlerRootView);
    expect(layout.props.style).toEqual({ flex: 1 });
  });

  it("registers the add holding route used by dashboard and holdings actions", () => {
    const layout = RootLayout();

    expect(collectScreenNames(layout)).toEqual(
      expect.arrayContaining(["(tabs)", "settings", "add-holding"]),
    );
  });
});
