import { render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { useReducedMotion, withTiming } from "react-native-reanimated";

import {
  FadeInView,
  MASKED_INR_VALUE,
  MaskedValue,
  SkeletonRows,
} from "@/src/components/common";
import { motionDurations } from "@/src/theme";

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
