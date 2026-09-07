import { render } from "@testing-library/react-native";
import { BackHandler } from "react-native";
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockClose: () => void;
jest.mock("expo-router", () => ({
  router: { back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack },
  useFocusEffect: (callback: () => () => void) =>
    require("react").useEffect(callback, [callback]),
}));
jest.mock("@/src/features/holdings/HoldingDurationScreen", () => ({
  HoldingDurationScreen: ({ onClose }: { onClose: () => void }) => {
    mockClose = onClose;
    return null;
  },
}));
const Route = require("../../app/holding-duration").default;
it("returns to the caller, safely handles direct launch and cleans up hardware Back", () => {
  const remove = jest.fn();
  const listener = jest
    .spyOn(BackHandler, "addEventListener")
    .mockReturnValue({ remove });
  const screen = render(<Route />);
  mockClose();
  expect(mockBack).toHaveBeenCalledTimes(1);
  mockCanGoBack.mockReturnValue(false);
  expect(listener.mock.calls[0][1]()).toBe(true);
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/holdings");
  screen.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  listener.mockRestore();
});
