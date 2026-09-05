const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockIsFocused = jest.fn(() => true);

jest.mock("@react-navigation/native", () => ({
  useIsFocused: mockIsFocused,
}));

jest.mock("expo-router", () => ({
  router: {
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
  },
  useLocalSearchParams: () => ({}),
}));

const AddHoldingRoute =
  require("../../app/add-holding").default as typeof import("../../app/add-holding").default;

describe("Add Holding route", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockBack.mockClear();
    mockCanGoBack.mockReturnValue(true);
    mockIsFocused.mockReturnValue(true);
  });

  it("only enables hardware Back when the route is focused", () => {
    expect(AddHoldingRoute().props.hardwareBackEnabled).toBe(true);
    mockIsFocused.mockReturnValue(false);
    expect(AddHoldingRoute().props.hardwareBackEnabled).toBe(false);
  });

  it("returns to the caller or falls back to Holdings without navigation history", () => {
    AddHoldingRoute().props.onCancel();
    expect(mockBack).toHaveBeenCalledTimes(1);
    mockCanGoBack.mockReturnValue(false);
    AddHoldingRoute().props.onCancel();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/holdings");
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("replaces the completed wizard with Holdings", () => {
    const routeElement = AddHoldingRoute() as {
      props: { onComplete: () => void };
    };

    routeElement.props.onComplete();

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/holdings");
  });
});
