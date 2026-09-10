let mockIsFocused = true;
let mockParams: { profile?: string; token: string } = {
  profile: "1",
  token: "test-token",
};
const mockProfilerRender = jest.fn();

jest.mock("react", () => {
  const React = jest.requireActual("react");

  return {
    ...React,
    Profiler: ({ children, onRender }: { children: unknown; onRender: Function }) => {
      mockProfilerRender();
      React.useEffect(() => {
        onRender("asset-search-qa-form", "mount", 1);
      });

      return children;
    },
  };
});

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockIsFocused,
}));

jest.mock("@/src/components/common", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  return {
    AppButton: ({ onPress, testID, title }: { onPress: () => void; testID: string; title: string }) =>
      React.createElement(Pressable, { onPress, testID }, title),
    AppText: ({ children, testID }: { children: unknown; testID?: string }) =>
      React.createElement(Text, { testID }, children),
    ScreenContainer: ({ children, testID }: { children: unknown; testID?: string }) =>
      React.createElement(View, { testID }, children),
  };
});

jest.mock("@/src/features/openingPositions", () => {
  const React = require("react");
  const { Pressable, View } = require("react-native");

  return {
    AddOpeningPositionForm: ({
      onDiscoveryAction,
      onDiscoverySettled,
    }: {
      onDiscoveryAction?: (kind: "filter") => void;
      onDiscoverySettled?: (kind: "provider" | "saved") => void;
    }) => React.createElement(
      View,
      { testID: "mock-add-opening-position-form" },
      React.createElement(Pressable, {
        onPress: () => onDiscoveryAction?.("filter"),
        testID: "mock-discovery-filter",
      }),
      React.createElement(Pressable, {
        onPress: () => onDiscoverySettled?.("saved"),
        testID: "mock-discovery-settled-saved",
      }),
      React.createElement(Pressable, {
        onPress: () => onDiscoverySettled?.("provider"),
        testID: "mock-discovery-settled-provider",
      }),
    ),
  };
});

jest.mock("@/src/services/storage", () => ({
  createMemoryJsonStorage: () => ({}),
}));

jest.mock("@/src/store", () => ({
  createPortfolioStore: () => ({
    getState: () => ({ assets: [], openingPositions: [] }),
  }),
}));

jest.mock("@/src/testing/assetSearchFixture", () => ({
  assetSearchQaFixtureCounts: { providerCandidates: 200, savedAssets: 500 },
  createAssetSearchQaLookup: () => [],
  seedAssetSearchQaStore: jest.fn(),
}));

jest.mock("@/src/testing/visualQaSeed", () => ({
  canUseVisualQaHarness: () => true,
}));

import { act, fireEvent, render } from "@testing-library/react-native";

import AssetSearchQaRoute from "@/app/asset-search-qa";

function exportedMetrics(consoleInfo: { mock: { calls: unknown[][] } }) {
  const call = consoleInfo.mock.calls.at(-1);

  expect(call?.[0]).toBe("[asset-search-qa] metrics");
  return JSON.parse(call?.[1] as string) as {
    coverage: { profileRenders: boolean };
    droppedMeasurements: number;
    measurements: Array<{ detail: string; kind: string }>;
  };
}

describe("asset-search QA instrumentation", () => {
  beforeEach(() => {
    mockIsFocused = true;
    mockParams = { profile: "1", token: "test-token" };
    mockProfilerRender.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("does not log profiler events, and capture exports then freezes the buffer", async () => {
    const consoleInfo = jest.spyOn(console, "info").mockImplementation();
    const screen = render(<AssetSearchQaRoute />);

    await act(async () => {});
    fireEvent.press(screen.getByTestId("asset-search-qa-warmup"));
    await act(async () => {});
    expect(consoleInfo).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("asset-search-qa-capture-metrics"));
    const firstExport = exportedMetrics(consoleInfo);

    expect(firstExport.measurements.length).toBeGreaterThan(0);
    expect(firstExport.droppedMeasurements).toBe(0);

    fireEvent.press(screen.getByTestId("asset-search-qa-warmup"));
    await act(async () => {});
    fireEvent.press(screen.getByTestId("asset-search-qa-capture-metrics"));

    expect(exportedMetrics(consoleInfo)).toEqual(firstExport);
  });

  it("reset starts a new window that records the next warm-up render", async () => {
    const consoleInfo = jest.spyOn(console, "info").mockImplementation();
    const screen = render(<AssetSearchQaRoute />);

    await act(async () => {});
    fireEvent.press(screen.getByTestId("asset-search-qa-capture-metrics"));
    fireEvent.press(screen.getByTestId("asset-search-qa-reset-metrics"));
    await act(async () => {});
    fireEvent.press(screen.getByTestId("asset-search-qa-warmup"));
    await act(async () => {});
    fireEvent.press(screen.getByTestId("asset-search-qa-capture-metrics"));

    const metrics = exportedMetrics(consoleInfo);

    expect(metrics.measurements).toHaveLength(1);
    expect(metrics.measurements[0].detail).toContain("warm-up form remount");
  });

  it("cleans up the event-loop timer when the route loses focus", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const screen = render(<AssetSearchQaRoute />);

    mockIsFocused = false;
    screen.rerender(<AssetSearchQaRoute />);

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("keeps filter timing pending until both default-path result lists settle", () => {
    mockParams = { token: "test-token" };
    const consoleInfo = jest.spyOn(console, "info").mockImplementation();
    const screen = render(<AssetSearchQaRoute />);

    expect(mockProfilerRender).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId("mock-discovery-filter"));
    fireEvent.press(screen.getByTestId("mock-discovery-settled-saved"));
    fireEvent.press(screen.getByTestId("asset-search-qa-capture-metrics"));

    const metrics = exportedMetrics(consoleInfo);

    expect(metrics.coverage.profileRenders).toBe(false);
    expect(metrics.measurements.some((measurement) => measurement.kind === "filter-to-render"))
      .toBe(false);
  });

  it("retains the default-path filter metric after both lists settle", () => {
    mockParams = { token: "test-token" };
    const consoleInfo = jest.spyOn(console, "info").mockImplementation();
    const screen = render(<AssetSearchQaRoute />);

    fireEvent.press(screen.getByTestId("mock-discovery-filter"));
    fireEvent.press(screen.getByTestId("mock-discovery-settled-saved"));
    fireEvent.press(screen.getByTestId("mock-discovery-settled-provider"));
    fireEvent.press(screen.getByTestId("asset-search-qa-capture-metrics"));

    const metrics = exportedMetrics(consoleInfo);

    expect(metrics.coverage.profileRenders).toBe(false);
    expect(metrics.measurements).toEqual([
      expect.objectContaining({ kind: "filter-to-render" }),
    ]);
  });
});
