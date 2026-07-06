import type { ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, interaction, radii, spacing } from "@/src/theme";

import { AppText } from "./AppText";
import { androidRipple, getPressedStateStyle } from "./pressableStyles";

type ButtonVariant = "primary" | "secondary" | "ghost";

type AppButtonProps = Omit<PressableProps, "children" | "style"> & {
  style?: StyleProp<ViewStyle>;
  textColor?: ComponentProps<typeof AppText>["color"];
  title: string;
  variant?: ButtonVariant;
};

export function getButtonInteractionStyle({
  disabled,
  pressed,
}: {
  disabled?: boolean;
  pressed: boolean;
}) {
  return getPressedStateStyle({ disabled, pressed });
}

export function AppButton({
  disabled,
  style,
  textColor,
  title,
  variant = "primary",
  ...props
}: AppButtonProps) {
  const isDisabled = Boolean(disabled);
  const resolvedTextColor =
    textColor ?? (variant === "primary" ? "inverse" : "primary");

  return (
    <Pressable
      {...props}
      android_ripple={androidRipple(
        variant === "primary"
          ? interaction.primaryRippleColor
          : interaction.rippleColor,
      )}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        getButtonInteractionStyle({ disabled: isDisabled, pressed }),
        style,
      ]}
    >
      <AppText color={resolvedTextColor} variant="body" weight="bold">
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radii.button,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface.elevated,
  },
});
