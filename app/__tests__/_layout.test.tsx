import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

const { Ionicons } = require("@expo/vector-icons") as {
  Ionicons: { loadFont: jest.Mock };
};

const mockUseMonthEndSnapshotAutomation = jest.fn();
const mockResetAffectedStorage = jest.fn();
let mockRecoveryState: { incidents: Array<Record<string, unknown>> } | undefined;
let mockPathname = "/dashboard";

// App lock reads native storage; these tests run with it off (#761).
jest.mock("@/src/services/security/appLock", () => {
  const actual = jest.requireActual("@/src/services/security/appLock");
  const { createMemoryJsonStorage } = jest.requireActual("@/src/services/storage");
  const store = actual.createAppLockStore({
    auth: { authenticate: async () => ({ success: true }), hasDeviceLock: async () => true },
    storage: createMemoryJsonStorage(),
  });
  return { ...actual, getAppLockStore: () => store };
});
jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0 },
  authenticateAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children }: { children: unknown }) =>
    React.createElement(View, { testID: "app-stack" }, children);
  Stack.Screen = () => null;

  return {
    Stack,
    get router() {
      return mockGlobalRouter;
    },
    useNavigationContainerRef: () => mockNavigationRef,
    usePathname: () => mockPathname,
    useRootNavigationState: () => mockRootState,
    useRouter: () => mockBoundRouter,
  };
});

let mockCanGoBack = false;
const mockNavigationRef: { current: string | null; canGoBack: () => boolean } = {
  current: null,
  canGoBack: () => mockCanGoBack,
};

const mockNavigate = jest.fn();
const mockGlobalRouter: Record<string, unknown> = { navigate: (path: string) => mockNavigate(path) };
let mockBoundRouter: Record<string, unknown> = {};
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
      readRecoveryCopies: () => [],
      resetAffectedStorage: mockResetAffectedStorage,
      storageRecovery: mockRecoveryState,
    }),
    subscribe: () => () => undefined,
  }),
}));

import { BackHandler } from "react-native";

import { sessionMemory } from "@/src/services/session";

import RootLayout, { loadRequiredFonts } from "../_layout";

describe("RootLayout storage recovery boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Ionicons.loadFont.mockResolvedValue(undefined);
    mockRecoveryState = undefined;
    mockPathname = "/dashboard";
    mockRootState = { key: "root" };
    mockTakeStartupLinkPath.mockReturnValue(undefined);
    mockCanGoBack = false;
    mockNavigationRef.current = null;
    mockBoundRouter = {};
  });

  describe("after a font-size relaunch (#529)", () => {
    it("keeps global navigation working after the old surface unmounts", async () => {
      const navigateBefore = mockGlobalRouter.navigate;
      // Android starts the relaunched surface before it stops the old one.
      mockNavigationRef.current = "old container";
      mockBoundRouter = { push: () => "old surface" };
      const oldSurface = await render(<RootLayout />);
      await waitFor(() => expect(oldSurface.getByTestId("app-stack")).toBeTruthy());

      mockNavigationRef.current = "new container";
      mockBoundRouter = { push: () => "new surface" };
      const newSurface = await render(<RootLayout />);
      await waitFor(() => expect(newSurface.getByTestId("app-stack")).toBeTruthy());

      // The old tree's cleanup empties the shared ref and unbinds the router.
      mockNavigationRef.current = null;
      mockGlobalRouter.push = () => {
        throw new Error("The imperative router is unavailable before the first render has finished.");
      };
      await oldSurface.unmount();

      expect(mockNavigationRef.current).toBe("new container");
      expect((mockGlobalRouter.push as () => string)()).toBe("new surface");
      delete mockGlobalRouter.push;
      mockGlobalRouter.navigate = navigateBefore;
    });

    it("forgets unsaved input when Back leaves the app", async () => {
      type BackHandlerListener = Parameters<typeof BackHandler.addEventListener>[1];
      const handlers: BackHandlerListener[] = [];
      const addListener = jest.spyOn(BackHandler, "addEventListener")
        .mockImplementation((_event, handler) => {
          handlers.push(handler);
          return { remove: () => undefined };
        });
      try {
        const { getByTestId } = await render(<RootLayout />);
        await waitFor(() => expect(getByTestId("app-stack")).toBeTruthy());
        sessionMemory.write("cashEntryDraft", { amount: "1" });

        mockCanGoBack = true;
        const press = () => handlers.forEach((handler) =>
          expect(handler({} as Parameters<BackHandlerListener>[0])).toBe(false));
        press();
        expect(sessionMemory.read("cashEntryDraft")).toEqual({ amount: "1" });

        mockCanGoBack = false;
        press();
        expect(sessionMemory.read("cashEntryDraft")).toBeUndefined();
      } finally {
        addListener.mockRestore();
      }
    });
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
