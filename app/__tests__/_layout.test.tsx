import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

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

  return {
    Stack,
    router: { navigate: (path: string) => mockNavigate(path) },
    usePathname: () => mockPathname,
    useRootNavigationState: () => mockRootState,
  };
});

const mockNavigate = jest.fn();
const mockTakeStartupLinkPath = jest.fn<string | undefined, []>();
let mockRootState: { key: string } | undefined = { key: "root" };

jest.mock("@/src/services/linking", () => ({
  takeStartupLinkPath: () => mockTakeStartupLinkPath(),
}));

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
      preferences: { appearance: "dark" },
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
    mockRootState = { key: "root" };
    mockTakeStartupLinkPath.mockReturnValue(undefined);
  });

  it("opens a link that arrived before the navigator mounted", async () => {
    mockTakeStartupLinkPath.mockReturnValue("/settings?section=privacy");

    const { getByTestId } = await render(<RootLayout />);

    await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/settings?section=privacy"),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when no startup link arrived", async () => {
    const { getByTestId } = await render(<RootLayout />);

    await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());
    expect(mockTakeStartupLinkPath).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps a startup link until the root navigator is ready", async () => {
    mockRootState = undefined;
    mockTakeStartupLinkPath.mockReturnValue("/settings");

    const { getByTestId } = await render(<RootLayout />);

    await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());
    expect(mockTakeStartupLinkPath).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps a startup link until the launch route has redirected", async () => {
    mockPathname = "/";
    mockTakeStartupLinkPath.mockReturnValue("/settings");

    const { getByTestId, rerender } = await render(<RootLayout />);

    await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());
    expect(mockTakeStartupLinkPath).not.toHaveBeenCalled();

    mockPathname = "/dashboard";
    await rerender(<RootLayout />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/settings"));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not open a startup link while storage recovery blocks routes", async () => {
    mockRecoveryState = { incidents: [{ displayName: "Portfolio records", preserved: true }] };
    mockTakeStartupLinkPath.mockReturnValue("/settings");

    const { getByTestId } = await render(<RootLayout />);

    await waitFor(() =>
      expect(getByTestId("storage-recovery-screen")).toBeTruthy(),
    );
    expect(mockTakeStartupLinkPath).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("loads required assets before rendering normal routes", async () => {
    // Hold the font load open so the gate is observable after an awaited render.
    let finishFonts: () => void = () => undefined;
    Ionicons.loadFont.mockImplementation(() => new Promise<void>((resolve) => { finishFonts = resolve; }));
    const { getByTestId, queryByTestId } = await render(<RootLayout />);

    expect(getByTestId("app-asset-gate")).toBeTruthy();
    expect(queryByTestId("app-stack")).toBeNull();

    await act(() => finishFonts());
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

    const { getByTestId, queryByTestId } = await render(<RootLayout />);

    await waitFor(() =>
      expect(getByTestId("storage-recovery-screen")).toBeTruthy(),
    );
    expect(queryByTestId("app-stack")).toBeNull();
    expect(mockUseMonthEndSnapshotAutomation).not.toHaveBeenCalled();
  });

  it("does not run month-end automation on the visual QA seed route", async () => {
    mockPathname = "/visual-qa-seed";

    const { getByTestId } = await render(<RootLayout />);

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

    const { getByTestId, getByText } = await render(<RootLayout />);

    await waitFor(() =>
      expect(getByText("CogVest could not finish loading")).toBeTruthy(),
    );
    expect(Ionicons.loadFont).toHaveBeenCalledTimes(3);

    Ionicons.loadFont.mockResolvedValue(undefined);
    await fireEvent.press(getByTestId("retry-app-assets"));

    await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());
    expect(Ionicons.loadFont).toHaveBeenCalledTimes(4);
  });
});
