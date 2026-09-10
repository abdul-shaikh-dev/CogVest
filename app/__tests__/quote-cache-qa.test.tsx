jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ token: "test-token" }),
}));

jest.mock("@/src/components/common", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  return {
    AppButton: () => null,
    AppText: ({ children }: { children: unknown }) => React.createElement(Text, null, children),
    ScreenContainer: ({ children, testID }: { children: unknown; testID?: string }) =>
      React.createElement(View, { testID }, children),
  };
});

jest.mock("react-native-mmkv", () => ({ createMMKV: jest.fn() }));
jest.mock("@/src/services/storage", () => ({ createMmkvJsonStorage: jest.fn() }));
jest.mock("@/src/services/quotes/dailyPriceCache", () => ({ createDailyPriceCache: jest.fn() }));
jest.mock("@/src/testing/dailyPriceCacheFixture", () => ({
  dailyPriceCacheFixtureAssetCount: 10,
  dailyPriceCacheFixtureNow: new Date("2026-01-01T12:00:00.000Z"),
  dailyPriceCacheFixturePointCount: 36530,
  runDailyPriceCacheFixtureBenchmark: jest.fn(),
}));
jest.mock("@/src/testing/visualQaSeed", () => ({
  canUseVisualQaHarness: () => false,
}));

import { render } from "@testing-library/react-native";
import { createMMKV } from "react-native-mmkv";

import QuoteCacheQaRoute from "@/app/quote-cache-qa";

describe("quote-cache QA route gate", () => {
  it("does not initialize its MMKV instance when the QA gate blocks the route", () => {
    const screen = render(<QuoteCacheQaRoute />);

    expect(screen.getByTestId("quote-cache-qa-blocked")).toBeTruthy();
    expect(createMMKV).not.toHaveBeenCalled();
  });
});
