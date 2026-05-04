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
  if (disabled) {
    return styles.disabled;
  }

  if (pressed) {
    return styles.pressed;
  }

  return undefined;
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
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.cardInner,
  },
  disabled: {
    opacity: interaction.disabledOpacity,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  secondary: {
    backgroundColor: colors.surface.elevated,
  },
});
