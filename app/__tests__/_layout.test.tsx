import { render } from "@testing-library/react-native";

const mockUseMonthEndSnapshotAutomation = jest.fn();
const mockResetAffectedStorage = jest.fn();
let mockRecoveryState: { incidents: Array<Record<string, unknown>> } | undefined;

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children }: { children: unknown }) =>
    React.createElement(View, { testID: "app-stack" }, children);
  Stack.Screen = () => null;

  return { Stack };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    GestureHandlerRootView: ({ children }: { children: unknown }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SafeAreaProvider: ({ children }: { children: unknown }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({ children, ...props }: { children: unknown }) =>
      React.createElement(View, props, children),
  };
});

jest.mock("@/src/features/progress", () => ({
  useMonthEndSnapshotAutomation: () => mockUseMonthEndSnapshotAutomation(),
}));

jest.mock("@/src/store", () => ({
  getPortfolioStore: () => ({
    getState: () => ({
      resetAffectedStorage: mockResetAffectedStorage,
      storageRecovery: mockRecoveryState,
    }),
    subscribe: () => () => undefined,
  }),
}));

import RootLayout from "../_layout";

describe("RootLayout storage recovery boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecoveryState = undefined;
  });

  it("renders normal routes and month-end automation when storage is healthy", () => {
    const { getByTestId, queryByTestId } = render(<RootLayout />);

    expect(getByTestId("app-stack")).toBeTruthy();
    expect(queryByTestId("storage-recovery-screen")).toBeNull();
    expect(mockUseMonthEndSnapshotAutomation).toHaveBeenCalledTimes(1);
  });

  it("blocks routes and automation when recovery is required", () => {
    mockRecoveryState = {
      incidents: [
        {
          displayName: "Portfolio records",
          preserved: true,
        },
      ],
    };

    const { getByTestId, queryByTestId } = render(<RootLayout />);

    expect(getByTestId("storage-recovery-screen")).toBeTruthy();
    expect(queryByTestId("app-stack")).toBeNull();
    expect(mockUseMonthEndSnapshotAutomation).not.toHaveBeenCalled();
  });
});
