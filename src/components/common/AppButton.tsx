import type { ComponentProps, Ref } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewInstance,
  type ViewStyle,
} from "react-native";

import Animated from "react-native-reanimated";

import { interaction, radii, spacing, createThemedStyles } from "@/src/theme";

import { AppText } from "./AppText";
import { usePressFeedback } from "./Motion";
import {
  androidRipple,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "./pressableStyles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  onPressIn,
  onPressOut,
  style,
  textColor,
  title,
  variant = "primary",
  ...props
}: AppButtonProps) {
  const styles = useStyles();
  const isDisabled = Boolean(disabled);
  const press = usePressFeedback(isDisabled);
  const resolvedTextColor =
    textColor ??
    (variant === "primary" || variant === "destructive"
      ? "inverse"
      : "primary");

  return (
    <AnimatedPressable
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
      onPressIn={(event) => {
        press.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.onPressOut();
        onPressOut?.(event);
      }}
      // Pressed and disabled opacity come from the press feedback (#785).
      style={[styles.base, styles[variant], style, press.style]}
    >
      {/* The label spans the button rather than its own measured width (#746).
          After a configuration change such as a theme switch, Android can draw
          bold text a few pixels wider than React Native measured it; a label
          box exactly that measured width then wraps the last word onto a
          second line that the one-line height hides. */}
      <AppText align="center" color={resolvedTextColor} style={styles.label} variant="body" weight="bold">
        {title}
      </AppText>
    </AnimatedPressable>
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
  // The main action stands apart by shape and size (#785): a taller pill,
  // where other buttons keep the rounded rectangle.
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    minHeight: interaction.primaryActionHeight,
    paddingHorizontal: spacing.lg,
  },
  secondary: {
    backgroundColor: colors.surface.elevated,
  },
  destructive: {
    backgroundColor: colors.loss,
  },
}));
