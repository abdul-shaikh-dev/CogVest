import React from "react";

import TabLayout from "../../app/(tabs)/_layout";

jest.mock("expo-router", () => {
  const React = require("react");

  const Tabs = ({
    children,
    screenOptions,
  }: {
    children: React.ReactNode;
    screenOptions?: unknown;
  }) => React.createElement("Tabs", { screenOptions }, children);
  Tabs.Screen = ({
    name,
    options,
  }: {
    name: string;
    options?: Record<string, unknown>;
  }) => React.createElement("Tabs.Screen", { name, options });

  return { Tabs };
});

type TestElement = React.ReactElement<{
  children?: React.ReactNode;
  name?: string;
  options?: Record<string, unknown>;
}>;

function isElement(node: unknown): node is TestElement {
  return React.isValidElement(node);
}

function collectScreens(node: unknown): TestElement[] {
  if (!isElement(node)) {
    return [];
  }

  const ownScreen = node.props.name ? [node] : [];
  const childScreens = React.Children.toArray(node.props.children).flatMap(
    collectScreens,
  );

  return [...ownScreen, ...childScreens];
}

describe("TabLayout", () => {
  it("registers Progress as the tab route name with stable automation ID", () => {
    const layout = TabLayout();
    const screens = collectScreens(layout);
    const progress = screens.find((screen) => screen.props.name === "progress");

    expect(progress?.props.options).toMatchObject({
      tabBarButtonTestID: "tab-progress",
      title: "Progress",
    });
    expect(screens.some((screen) => screen.props.name === "history")).toBe(false);
  });
});
