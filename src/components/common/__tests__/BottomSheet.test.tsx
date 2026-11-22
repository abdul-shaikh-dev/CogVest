import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { useReducedMotion, withTiming } from "react-native-reanimated";

import { BottomSheet, shouldCloseSheet } from "@/src/components/common";

function renderSheet(props: Partial<Parameters<typeof BottomSheet>[0]> = {}) {
  const onRequestClose = jest.fn();
  return {
    onRequestClose,
    view: render(
      <BottomSheet closeLabel="Close options" modalTestID="sheet-modal" onRequestClose={onRequestClose} visible {...props}>
        <Text>Options</Text>
      </BottomSheet>,
    ),
  };
}

afterEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
  jest.mocked(withTiming).mockClear();
});

describe("shouldCloseSheet (#784)", () => {
  it.each([
    [120, 0, true],
    [96, 0, false],
    [40, 1200, true],
    [20, 1200, false],
    [60, 300, false],
  ])("a drag of %sdp at %sdp/s closes: %s", (distance, velocity, closes) => {
    expect(shouldCloseSheet(distance, velocity)).toBe(closes);
  });
});

describe("BottomSheet (#784)", () => {
  it("renders nothing while closed", async () => {
    const { view } = renderSheet({ visible: false });
    expect((await view).queryByText("Options")).toBeNull();
  });

  it("asks to close on Back, a scrim tap and the handle", async () => {
    const { onRequestClose, view } = renderSheet();
    const screen = await view;
    await fireEvent(screen.getByTestId("sheet-modal"), "requestClose");
    await fireEvent.press(screen.getByTestId("bottom-sheet-scrim", { includeHiddenElements: true }));
    await fireEvent.press(screen.getByTestId("bottom-sheet-handle"));
    expect(onRequestClose).toHaveBeenCalledTimes(3);
  });

  it("stays open while it cannot be dismissed, such as during a save", async () => {
    const { onRequestClose, view } = renderSheet({ dismissible: false });
    const screen = await view;
    await fireEvent(screen.getByTestId("sheet-modal"), "requestClose");
    await fireEvent.press(screen.getByTestId("bottom-sheet-handle"));
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("names the handle for screen readers", async () => {
    const { view } = renderSheet();
    expect((await view).getByRole("button", { name: "Close options" })).toBeTruthy();
  });

  it("slides up, or with reduced motion appears in place", async () => {
    await renderSheet().view;
    expect(withTiming).toHaveBeenCalled();
    jest.mocked(withTiming).mockClear();
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderSheet().view;
    expect(withTiming).not.toHaveBeenCalled();
  });
});
