import { fireEvent, render } from "@testing-library/react-native";
import LegacyEntryRoute from "../../app/(tabs)/add-trade";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));

describe("legacy entry compatibility", () => {
  beforeEach(() => mockReplace.mockClear());

  it("does not automatically enter a financial form or expose raw fields", () => {
    const screen = render(<LegacyEntryRoute />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByText("Quote source ID")).toBeNull();
    expect(screen.queryByTestId("add-trade-screen")).toBeNull();
    expect(screen.getByTestId("legacy-entry-screen")).toBeTruthy();
  });

  it.each([
    ["legacy-existing-holding", "/add-holding"],
    ["legacy-record-purchase", "/record-purchase"],
    ["legacy-sell-holding", "/(tabs)/holdings"],
    ["legacy-cancel", "/(tabs)/holdings"],
  ])("replaces the obsolete route after an explicit %s choice", (id, destination) => {
    const screen = render(<LegacyEntryRoute />);
    fireEvent.press(screen.getByTestId(id));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(destination);
  });
});
