import { act, render } from "@testing-library/react-native";

const mockParams: { destination?: string; openAddMenu?: string; status?: string; statusMessage?: string } = {};
const mockSetParams = jest.fn();
const mockHoldingsProps = jest.fn();
let mockFocused = false;
let mockBlurListener: (() => void) | undefined;

jest.mock("expo-router/react-navigation", () => ({
  useIsFocused: () => mockFocused,
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    setParams: mockSetParams,
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({
    addListener: (event: string, listener: () => void) => {
      if (event === "blur") mockBlurListener = listener;
      return jest.fn();
    },
  }),
}));

jest.mock("@/src/features/holdings", () => ({
  getHoldingsStatusMessage: jest.requireActual("@/src/features/holdings/holdingsStatus").getHoldingsStatusMessage,
  HoldingsScreen: (props: unknown) => {
    mockHoldingsProps(props);
    return null;
  },
}));

jest.mock("@/src/features/quickSetup", () => ({
  useQuickSetupSession: () => ({ session: undefined }),
}));

const HoldingsRoute =
  require("../../app/(tabs)/holdings").default as typeof import("../../app/(tabs)/holdings").default;

describe("Holdings route", () => {
  beforeEach(() => {
    delete mockParams.destination;
    delete mockParams.openAddMenu;
    delete mockParams.status;
    delete mockParams.statusMessage;
    mockFocused = false;
    mockBlurListener = undefined;
    mockSetParams.mockClear();
    mockHoldingsProps.mockClear();
  });

  it("waits until focus returns before consuming correction feedback", async () => {
    mockParams.status = "openingPositionSaved";
    const screen = await render(<HoldingsRoute />);

    expect(mockHoldingsProps.mock.lastCall?.[0]).toMatchObject({
      isActive: false,
      statusMessage: undefined,
    });
    expect(mockSetParams).not.toHaveBeenCalled();

    mockFocused = true;
    await screen.rerender(<HoldingsRoute />);

    expect(mockHoldingsProps.mock.lastCall?.[0]).toMatchObject({
      isActive: true,
      statusMessage: "Portfolio history updated.",
    });
    expect(mockSetParams).toHaveBeenCalledWith({ status: undefined });

    await act(() => mockBlurListener?.());
    expect(mockHoldingsProps.mock.lastCall?.[0]).toMatchObject({
      statusMessage: undefined,
    });
  });

  describe("outside links (#657)", () => {
    const lastProps = () => mockHoldingsProps.mock.lastCall?.[0] as {
      destinationRequest?: unknown;
      openAddMenu: boolean;
      statusMessage?: string;
    };

    it("never shows free text from a statusMessage parameter", async () => {
      mockFocused = true;
      mockParams.statusMessage = "Your portfolio is locked. Call +91 00000 00000.";

      await render(<HoldingsRoute />);

      expect(lastProps().statusMessage).toBeUndefined();
      expect(JSON.stringify(mockHoldingsProps.mock.calls)).not.toContain("locked");
    });

    it("ignores a status that is not an allowlisted code, and clears it", async () => {
      mockFocused = true;
      mockParams.status = "Your portfolio is locked.";

      await render(<HoldingsRoute />);

      expect(lastProps().statusMessage).toBeUndefined();
      expect(mockSetParams).toHaveBeenCalledWith({ status: undefined });
    });

    it("does not treat an inherited object key as a code", async () => {
      mockFocused = true;
      mockParams.status = "toString";

      await render(<HoldingsRoute />);

      expect(lastProps().statusMessage).toBeUndefined();
    });

    it("accepts only the exact allowlisted values for openAddMenu and destination", async () => {
      mockFocused = true;
      mockParams.openAddMenu = "yes";
      mockParams.destination = "settings";

      await render(<HoldingsRoute />);

      expect(lastProps().openAddMenu).toBe(false);
      expect(lastProps().destinationRequest).toBeUndefined();
    });
  });
});
