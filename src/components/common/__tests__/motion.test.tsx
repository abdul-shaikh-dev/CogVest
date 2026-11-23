import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { useReducedMotion, withRepeat, withSpring, withTiming } from "react-native-reanimated";

import {
  AppButton,
  ExpressiveLoader,
  FadeInView,
  IconButton,
  MASKED_INR_VALUE,
  MaskedValue,
  SkeletonRows,
} from "@/src/components/common";
import { interaction, motionDurations, pressedScale, pressSpring } from "@/src/theme";

const mockedReducedMotion = jest.mocked(useReducedMotion);

afterEach(() => mockedReducedMotion.mockReturnValue(false));

describe("motion components (#783)", () => {
  it("fades content in for its kind of motion", async () => {
    const view = await render(<FadeInView kind="entry" testID="fade"><Text>Ready</Text></FadeInView>);
    expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: motionDurations.entry }));
    // A style fade, not a layout animation, so a safe area inset can still move the view (#792).
    expect(view.getByTestId("fade").props.entering).toBeUndefined();
  });

  it("skips the fade when reduced motion is on", async () => {
    mockedReducedMotion.mockReturnValue(true);
    jest.mocked(withTiming).mockClear();
    const view = await render(<FadeInView testID="fade"><Text>Ready</Text></FadeInView>);
    expect(withTiming).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(view.getByTestId("fade").props.style).opacity).toBe(1);
  });

  it("reads placeholder rows as one loading label", async () => {
    const view = await render(<SkeletonRows accessibilityLabel="Loading allocation" rows={2} testID="rows" />);
    expect(view.getByLabelText("Loading allocation")).toBeTruthy();
    expect(view.getAllByTestId("skeleton-bar")).toHaveLength(4);
  });
});

describe("mask transition (#783)", () => {
  it("does not fade an amount on first render", async () => {
    const view = await render(<MaskedValue value="₹1,200" />);
    expect(view.getByText("₹1,200").props.entering).toBeUndefined();
  });

  it("swaps to the mask at once and fades the mask in, so digits never stay on screen", async () => {
    const view = await render(<MaskedValue value="₹1,200" />);
    await view.rerender(<MaskedValue masked value="₹1,200" />);
    expect(view.queryByText("₹1,200")).toBeNull();
    expect(view.getByText(MASKED_INR_VALUE).props.entering.mockDuration).toBe(motionDurations.mask);
  });

  it("fades the amount in when it is revealed", async () => {
    const view = await render(<MaskedValue masked value="₹1,200" />);
    await view.rerender(<MaskedValue value="₹1,200" />);
    expect(view.queryByText(MASKED_INR_VALUE)).toBeNull();
    expect(view.getByText("₹1,200").props.entering.mockDuration).toBe(motionDurations.mask);
  });

  it("swaps without a fade when reduced motion is on", async () => {
    mockedReducedMotion.mockReturnValue(true);
    const view = await render(<MaskedValue value="₹1,200" />);
    await view.rerender(<MaskedValue masked value="₹1,200" />);
    expect(view.getByText(MASKED_INR_VALUE).props.entering).toBeUndefined();
  });
});

describe("expressive touches (#785)", () => {
  beforeEach(() => {
    jest.mocked(withSpring).mockClear();
    jest.mocked(withRepeat).mockClear();
  });

  it("eases a pressed button in with a spring that does not overshoot, then back", async () => {
    const view = await render(<AppButton title="Save" />);
    const button = view.getByRole("button", { name: "Save" });

    await fireEvent(button, "pressIn");
    expect(withSpring).toHaveBeenLastCalledWith(pressedScale, expect.objectContaining({ overshootClamping: true }));
    await fireEvent(button, "pressOut");
    expect(withSpring).toHaveBeenLastCalledWith(1, expect.objectContaining({ damping: pressSpring.damping }));
  });

  it("keeps the 98% pressed opacity and skips the spring under reduced motion", async () => {
    mockedReducedMotion.mockReturnValue(true);
    const pressIn = jest.fn();
    const view = await render(<AppButton onPressIn={pressIn} title="Save" />);

    await fireEvent(view.getByRole("button", { name: "Save" }), "pressIn");
    expect(withSpring).not.toHaveBeenCalled();
    expect(pressIn).toHaveBeenCalledTimes(1);
  });

  it("fades a disabled button to the disabled opacity", async () => {
    const view = await render(<AppButton disabled title="Save" />);
    expect(view.getByRole("button", { name: "Save" })).toHaveStyle({ opacity: interaction.disabledOpacity });
  });

  it("shows the refresh indicator in place of the icon while busy", async () => {
    const view = await render(
      <IconButton busy accessibilityLabel="Refreshing quotes" icon="refresh-outline" testID="refresh" />,
    );
    // Hidden from screen readers: the button's busy label speaks for it.
    expect(view.getByTestId("refresh-loader", { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByRole("button", { name: "Refreshing quotes" }).props.accessibilityState).toMatchObject({ busy: true });
  });

  it("turns the indicator on a repeating loop, and holds it still under reduced motion", async () => {
    await render(<ExpressiveLoader color="#555" />);
    expect(withRepeat).toHaveBeenCalledWith(expect.anything(), -1, false);

    jest.mocked(withRepeat).mockClear();
    mockedReducedMotion.mockReturnValue(true);
    await render(<ExpressiveLoader color="#555" />);
    expect(withRepeat).not.toHaveBeenCalled();
  });
});
