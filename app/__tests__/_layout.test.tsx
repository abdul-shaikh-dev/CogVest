import { fireEvent, render, waitFor } from "@testing-library/react-native";

const { Ionicons } = require("@expo/vector-icons") as {
  Ionicons: { loadFont: jest.Mock };
};

const mockUseMonthEndSnapshotAutomation = jest.fn();
const mockResetAffectedStorage = jest.fn();
let mockRecoveryState: { incidents: Array<Record<string, unknown>> } | undefined;
let mockPathname = "/dashboard";

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children }: { children: unknown }) =>
    React.createElement(View, { testID: "app-stack" }, children);
  Stack.Screen = () => null;

  return { Stack, usePathname: () => mockPathname };
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
  useMonthEndSnapshotAutomation: (options: unknown) =>
    mockUseMonthEndSnapshotAutomation(options),
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

import RootLayout, { loadRequiredFonts } from "../_layout";

describe("RootLayout storage recovery boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Ionicons.loadFont.mockResolvedValue(undefined);
    mockRecoveryState = undefined;
    mockPathname = "/dashboard";
  });

  it("loads required assets before rendering normal routes", async () => {
    const { getByTestId, queryByTestId } = render(<RootLayout />);

    expect(getByTestId("app-asset-gate")).toBeTruthy();

    await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());

    expect(queryByTestId("storage-recovery-screen")).toBeNull();
    expect(mockUseMonthEndSnapshotAutomation).toHaveBeenCalledTimes(1);
  });

  it("blocks routes and automation when recovery is required", async () => {
    mockRecoveryState = {
      incidents: [
        {
          displayName: "Portfolio records",
          preserved: true,
        },
      ],
    };

    const { getByTestId, queryByTestId } = render(<RootLayout />);

    await waitFor(() =>
      expect(getByTestId("storage-recovery-screen")).toBeTruthy(),
    );
    expect(queryByTestId("app-stack")).toBeNull();
    expect(mockUseMonthEndSnapshotAutomation).not.toHaveBeenCalled();
  });

  it("does not run month-end automation on the visual QA seed route", async () => {
    mockPathname = "/visual-qa-seed";

    const { getByTestId } = render(<RootLayout />);

    await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());
    expect(mockUseMonthEndSnapshotAutomation).toHaveBeenCalledWith({
      enabled: false,
    });
  });

  it("times out required assets that never finish loading", async () => {
    Ionicons.loadFont.mockImplementation(() => new Promise(() => undefined));

    await expect(loadRequiredFonts({ timeoutMs: 1 })).rejects.toThrow(
      "Required interface assets timed out.",
    );
    expect(Ionicons.loadFont).toHaveBeenCalledTimes(3);
  });

  it("retries a failed asset load without exposing an unhandled rejection", async () => {
    Ionicons.loadFont.mockRejectedValue(new Error("asset unavailable"));

    const { getByTestId, getByText } = render(<RootLayout />);

    await waitFor(() =>
      expect(getByText("CogVest could not finish loading")).toBeTruthy(),
    );
    expect(Ionicons.loadFont).toHaveBeenCalledTimes(3);

    Ionicons.loadFont.mockResolvedValue(undefined);
    fireEvent.press(getByTestId("retry-app-assets"));

    await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());
    expect(Ionicons.loadFont).toHaveBeenCalledTimes(4);
  });
});
