import type { PressableProps, ViewStyle } from "react-native";

import { interaction } from "@/src/theme";

export function androidRipple(
  color: string = interaction.rippleColor,
): PressableProps["android_ripple"] {
  return {
    borderless: false,
    color,
    foreground: true,
  };
}

export const minimumTouchTargetStyle: ViewStyle = {
  minHeight: interaction.minimumTouchTarget,
  minWidth: interaction.minimumTouchTarget,
};

export function getPressedStateStyle({
  disabled,
  pressed,
}: {
  disabled?: boolean;
  pressed: boolean;
}) {
  if (disabled) {
    return {
      opacity: interaction.disabledOpacity,
    };
  }

  if (pressed) {
    return {
      opacity: interaction.pressedOpacity,
    };
  }

  return undefined;
}
