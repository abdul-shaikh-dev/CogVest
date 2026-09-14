import { act, render } from "@testing-library/react-native";

const mockParams: { openAddMenu?: string; statusMessage?: string } = {};
const mockSetParams = jest.fn();
const mockHoldingsProps = jest.fn();
let mockFocused = false;
let mockBlurListener: (() => void) | undefined;

jest.mock("@react-navigation/native", () => ({
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
    delete mockParams.openAddMenu;
    delete mockParams.statusMessage;
    mockFocused = false;
    mockBlurListener = undefined;
    mockSetParams.mockClear();
    mockHoldingsProps.mockClear();
  });

  it("waits until focus returns before consuming correction feedback", () => {
    mockParams.statusMessage = "Portfolio history updated.";
    const screen = render(<HoldingsRoute />);

    expect(mockHoldingsProps.mock.lastCall?.[0]).toMatchObject({
      isActive: false,
      statusMessage: undefined,
    });
    expect(mockSetParams).not.toHaveBeenCalled();

    mockFocused = true;
    screen.rerender(<HoldingsRoute />);

    expect(mockHoldingsProps.mock.lastCall?.[0]).toMatchObject({
      isActive: true,
      statusMessage: "Portfolio history updated.",
    });
    expect(mockSetParams).toHaveBeenCalledWith({ statusMessage: undefined });

    act(() => mockBlurListener?.());
    expect(mockHoldingsProps.mock.lastCall?.[0]).toMatchObject({
      statusMessage: undefined,
    });
  });
});
