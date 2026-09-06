import { Ionicons } from "@expo/vector-icons";
import { render } from "@testing-library/react-native";

import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  MaskedValue,
  ScreenHeader,
  SectionHeader,
  androidRipple,
  getAdaptiveLayoutMode,
  getPressedStateStyle,
  getMetricColumnCount,
  minimumTouchTargetStyle,
} from "@/src/components/common";
import { getButtonInteractionStyle } from "@/src/components/common/AppButton";
import { colors, interaction } from "@/src/theme";
import { FormTextField } from "@/src/components/forms";

describe("common UI primitives", () => {
  it("separates screen and section heading roles without reducing contrast", () => {
    const { getByRole } = render(
      <>
        <ScreenHeader title="Settings" subtitle="Local-first controls" />
        <SectionHeader title="Display" />
      </>,
    );
    expect(getByRole("header", { name: "Settings" })).toHaveStyle({
      fontSize: 30,
      fontWeight: "700",
    });
    expect(getByRole("header", { name: "Display" })).toHaveStyle({
      fontSize: 17,
      lineHeight: 24,
      fontWeight: "600",
      color: colors.text.primary,
    });
    expect(getByRole("header", { name: "Display" }).props.numberOfLines).toBeUndefined();
  });

  it("renders AppText with CogVest text colors", () => {
    const { getByText } = render(
      <AppText color="secondary">Local-first portfolio tracker</AppText>,
    );

    expect(getByText("Local-first portfolio tracker")).toHaveStyle({
      color: colors.text.secondary,
    });
  });

  it.each([
    { expectedBackground: colors.primary, variant: "primary" as const },
    { expectedBackground: colors.loss, variant: "destructive" as const },
  ])("pairs $variant labels with inverse text", ({ expectedBackground, variant }) => {
    const { getByTestId, getByText } = render(
      <AppButton
        testID={`${variant}-button`}
        title={`${variant} action`}
        variant={variant}
      />,
    );

    expect(getByTestId(`${variant}-button`)).toHaveStyle({
      backgroundColor: expectedBackground,
    });
    expect(getByText(`${variant} action`)).toHaveStyle({
      color: colors.text.inverse,
    });
  });

  it("uses the standard press opacity during interaction", () => {
    expect(
      getButtonInteractionStyle({ disabled: false, pressed: true }),
    ).toEqual({ opacity: interaction.pressedOpacity });
    expect(getPressedStateStyle({ disabled: false, pressed: true })).toEqual({
      opacity: interaction.pressedOpacity,
    });
    expect(
      getButtonInteractionStyle({ disabled: false, pressed: false }),
    ).toBeUndefined();
  });

  it("exposes button semantics and a readable default label", () => {
    const { getByRole } = render(<AppButton title="Save holding" />);

    expect(getByRole("button", { name: "Save holding" })).toBeTruthy();
  });

  it("uses disabled opacity instead of pressed feedback", () => {
    const { getByTestId } = render(
      <AppButton
        disabled
        testID="disabled-button"
        title="Add Trade"
        onPress={jest.fn()}
      />,
    );
    expect(getByTestId("disabled-button")).toHaveStyle({
      opacity: interaction.disabledOpacity,
    });
    expect(
      getButtonInteractionStyle({ disabled: true, pressed: true }),
    ).toEqual({ opacity: interaction.disabledOpacity });
  });

  it.each([
    { expectedRipple: interaction.primaryRippleColor, variant: "primary" as const },
    { expectedRipple: interaction.primaryRippleColor, variant: "destructive" as const },
    { expectedRipple: interaction.rippleColor, variant: "secondary" as const },
  ])("routes $variant through its accessible Android ripple", ({ expectedRipple, variant }) => {
    const { UNSAFE_root } = render(
      <AppButton
        testID={`${variant}-ripple-button`}
        title={`${variant} action`}
        variant={variant}
      />,
    );

    const rippleNodes = UNSAFE_root.findAll(
      (node: { props: { android_ripple?: unknown } }) => node.props.android_ripple !== undefined,
    );
    expect(rippleNodes).toHaveLength(1);
    expect(rippleNodes[0].props.android_ripple).toEqual({
      borderless: false,
      color: expectedRipple,
      foreground: false,
    });
  });

  it("exposes the generic Android ripple and 48dp touch target helpers", () => {
    expect(androidRipple()).toEqual({
      borderless: false,
      color: interaction.rippleColor,
      foreground: false,
    });
    expect(minimumTouchTargetStyle).toEqual({
      minHeight: interaction.minimumTouchTarget,
      minWidth: interaction.minimumTouchTarget,
    });
  });

  it("renders icon buttons with the minimum Android touch target", () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <IconButton
        accessibilityLabel="Mask values"
        icon="eye-outline"
        testID="mask-toggle"
      />,
    );

    expect(getByTestId("mask-toggle")).toHaveStyle({
      height: 46,
      minHeight: interaction.minimumTouchTarget,
      minWidth: interaction.minimumTouchTarget,
      width: 46,
    });
    expect(UNSAFE_getByType(Ionicons).props.accessible).toBe(false);
  });

  it("selects adaptive shared layouts from the Android font scale", () => {
    expect(getAdaptiveLayoutMode(1)).toBe("standard");
    expect(getAdaptiveLayoutMode(1.3)).toBe("large");
    expect(getAdaptiveLayoutMode(1.5)).toBe("accessibility");
    expect(getMetricColumnCount(1)).toBe(4);
    expect(getMetricColumnCount(1.3)).toBe(2);
    expect(getMetricColumnCount(2)).toBe(1);
  });

  it("masks INR wealth values without masking percentages", () => {
    const { getByText } = render(
      <>
        <MaskedValue masked value="₹1,23,456.78" valueType="wealth" />
        <MaskedValue masked value="12.4%" valueType="percentage" />
      </>,
    );

    expect(getByText("₹**** **,***.**")).toBeTruthy();
    expect(getByText("12.4%")).toBeTruthy();
  });

  it("renders an empty state action when provided", () => {
    const { getByText } = render(
      <EmptyState
        title="No holdings yet"
        message="Holdings are created from confirmed trades."
        actionLabel="Add Trade"
        onAction={jest.fn()}
      />,
    );

    expect(getByText("No holdings yet")).toBeTruthy();
    expect(getByText("Holdings are created from confirmed trades.")).toBeTruthy();
    expect(getByText("Add Trade")).toBeTruthy();
  });

  it("uses readable secondary text for form placeholders", () => {
    const { getByPlaceholderText } = render(
      <FormTextField
        label="Amount"
        placeholder="1000"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    expect(getByPlaceholderText("1000").props.placeholderTextColor).toBe(
      colors.text.secondary,
    );
  });
});
