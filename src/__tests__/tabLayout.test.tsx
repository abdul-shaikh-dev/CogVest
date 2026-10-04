import React from "react";
import { render } from "@testing-library/react-native";

import TabLayout from "../../app/(tabs)/_layout";

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const mocked = Object.create(actual);
  Object.defineProperty(mocked, "useWindowDimensions", {
    value: () => ({
      fontScale: 1,
      height: 800,
      scale: 1,
      width: 400,
    }),
  });
  return mocked;
});

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

describe("TabLayout", () => {
  it("configures bounded fitting without abbreviating the Dashboard label", () => {
    const layout = render(<TabLayout />);
    const options = layout.UNSAFE_getByType("Tabs" as never).props.screenOptions({ route: { name: "dashboard" } });
    const { getByText } = render(options.tabBarLabel({ color: "#98989D" }));
    expect(getByText("Dashboard").props).toMatchObject({
      adjustsFontSizeToFit: true,
      maxFontSizeMultiplier: 1.5,
      minimumFontScale: 0.85,
      numberOfLines: 1,
    });
  });

  it("registers Progress as the tab route name with stable automation ID", () => {
    const layout = render(<TabLayout />);
    const screens = layout.UNSAFE_getAllByType("Tabs.Screen" as never);
    const progress = screens.find((screen) => screen.props.name === "progress");

    expect(progress?.props.options).toMatchObject({
      tabBarAccessibilityLabel: "Progress",
      tabBarButtonTestID: "tab-progress",
      title: "Progress",
    });
    expect(screens.some((screen) => screen.props.name === "history")).toBe(false);
  });
});
