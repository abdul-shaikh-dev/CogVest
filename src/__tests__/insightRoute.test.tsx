import { render } from "@testing-library/react-native";
import { BackHandler } from "react-native";

const backPress = { type: "hardwareBackPress", timeStamp: 0 };

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockParams: { kind?: string | string[] } = { kind: "conviction" };
let mockProps: { kind: string; onClose: () => void };
jest.mock("expo-router", () => ({
  router: { back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => () => void) =>
    require("react").useEffect(callback, [callback]),
}));
jest.mock("@/src/features/insights", () => ({
  InsightDetailScreen: (props: typeof mockProps) => {
    mockProps = props;
    return null;
  },
}));
const InsightRoute = require("../../app/insight").default;

describe("Insight route", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReturnValue(true);
    mockParams = { kind: "conviction" };
  });
  it("returns to the caller or Dashboard when launched without history", async () => {
    await render(<InsightRoute />);
    expect(mockProps.kind).toBe("conviction");
    mockProps.onClose();
    expect(mockBack).toHaveBeenCalledTimes(1);
    mockCanGoBack.mockReturnValue(false);
    mockProps.onClose();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });
  it("handles hardware Back and cleans up its listener", async () => {
    const remove = jest.fn();
    const listener = jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove });
    const screen = await render(<InsightRoute />);
    expect(listener.mock.calls[0][0]).toBe("hardwareBackPress");
    expect(listener.mock.calls[0][1](backPress)).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(1);
    await screen.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    listener.mockRestore();
  });
  it("does not accept ambiguous repeated kind parameters", async () => {
    mockParams = { kind: ["conviction", "frequency"] };
    await render(<InsightRoute />);
    expect(mockProps.kind).toBe("");
  });
});
