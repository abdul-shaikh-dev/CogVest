import { render } from "@testing-library/react-native";

import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  MaskedValue,
  androidRipple,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "@/src/components/common";
import { getButtonInteractionStyle } from "@/src/components/common/AppButton";
import { colors, interaction } from "@/src/theme";

describe("common UI primitives", () => {
  it("renders AppText with CogVest text colors", () => {
    const { getByText } = render(
      <AppText color="secondary">Local-first portfolio tracker</AppText>,
    );

    expect(getByText("Local-first portfolio tracker")).toHaveStyle({
      color: colors.text.secondary,
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

  it("exposes Android ripple and 48dp touch target helpers", () => {
    expect(androidRipple()).toEqual({
      borderless: false,
      color: interaction.rippleColor,
      foreground: true,
    });
    expect(minimumTouchTargetStyle).toEqual({
      minHeight: interaction.minimumTouchTarget,
      minWidth: interaction.minimumTouchTarget,
    });
  });

  it("renders icon buttons with the minimum Android touch target", () => {
    const { getByTestId } = render(
      <IconButton
        accessibilityLabel="Mask values"
        icon="eye-outline"
        testID="mask-toggle"
      />,
    );

    expect(getByTestId("mask-toggle")).toHaveStyle({
      height: interaction.minimumTouchTarget,
      minHeight: interaction.minimumTouchTarget,
      minWidth: interaction.minimumTouchTarget,
      width: interaction.minimumTouchTarget,
    });
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
});
