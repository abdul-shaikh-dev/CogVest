import type { ComponentProps, Ref } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewInstance,
  type ViewStyle,
} from "react-native";

import { interaction, radii, spacing, createThemedStyles } from "@/src/theme";

import { AppText } from "./AppText";
import {
  androidRipple,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "./pressableStyles";

type ButtonVariant = "destructive" | "primary" | "secondary" | "ghost";

type AppButtonProps = Omit<PressableProps, "children" | "style"> & {
  buttonRef?: Ref<ViewInstance>;
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
  accessibilityLabel,
  accessibilityRole = "button",
  buttonRef,
  disabled,
  style,
  textColor,
  title,
  variant = "primary",
  ...props
}: AppButtonProps) {
  const styles = useStyles();
  const isDisabled = Boolean(disabled);
  const resolvedTextColor =
    textColor ??
    (variant === "primary" || variant === "destructive"
      ? "inverse"
      : "primary");

  return (
    <Pressable
      {...props}
      ref={buttonRef}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole={accessibilityRole}
      android_ripple={androidRipple(
        variant === "primary" || variant === "destructive"
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
      {/* The label spans the button rather than its own measured width (#746).
          After a configuration change such as a theme switch, Android can draw
          bold text a few pixels wider than React Native measured it; a label
          box exactly that measured width then wraps the last word onto a
          second line that the one-line height hides. */}
      <AppText align="center" color={resolvedTextColor} style={styles.label} variant="body" weight="bold">
        {title}
      </AppText>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radii.button,
    justifyContent: "center",
    ...minimumTouchTargetStyle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  label: {
    alignSelf: "stretch",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface.elevated,
  },
  destructive: {
    backgroundColor: colors.loss,
  },
}));
