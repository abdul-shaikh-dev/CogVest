import { useEffect, type ReactNode } from "react";
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  getMotionDuration,
  interaction,
  motionDurations,
  pressedScale,
  pressSpring,
  radii,
  useTheme,
  type MotionKind,
} from "@/src/theme";

/**
 * A soft fade for content that appears (#783), or undefined when reduced motion
 * is on. Reanimated also checks the system setting, so either path skips it.
 */
export function useFadeIn(kind: MotionKind) {
  const duration = getMotionDuration(kind, useReducedMotion());
  return duration === null
    ? undefined
    : FadeIn.duration(duration).easing(Easing.out(Easing.quad)).reduceMotion(ReduceMotion.System);
}

/**
 * Fades its children in when it mounts: screen entry and cards revealed after loading.
 *
 * It animates opacity as a style, not as an `entering` layout animation. A screen's
 * safe area insets arrive a frame after mount and move this view down; while an
 * entering animation runs, Reanimated dropped that move, leaving the header under
 * the status bar (#792).
 */
export function FadeInView({ children, kind = "reveal", style, testID }: {
  children: ReactNode;
  kind?: MotionKind;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const duration = getMotionDuration(kind, useReducedMotion());
  const opacity = useSharedValue(duration === null ? 1 : 0);
  useEffect(() => {
    opacity.set(duration === null
      ? 1
      : withTiming(1, { duration, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }));
  }, [duration, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[style, fade]} testID={testID}>{children}</Animated.View>;
}

/**
 * Press feedback for a button (#785): the pressed control keeps 98% opacity
 * (DESIGN.md §2) and eases in with a spring that does not overshoot. Reduced
 * motion keeps the opacity change and skips the scale.
 *
 * The style is static, not a Pressable style function, so an animated
 * Pressable can take it.
 */
export function usePressFeedback(disabled = false, disabledOpacity: number = interaction.disabledOpacity) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    opacity: disabled
      ? disabledOpacity
      : pressed.get() === 1 ? interaction.pressedOpacity : 1,
    transform: [{ scale: scale.get() }],
  }), [disabled, disabledOpacity]);
  const springTo = (value: number) => (reduced
    ? 1
    : withSpring(value, { ...pressSpring, reduceMotion: ReduceMotion.System }));
  return {
    onPressIn: () => {
      pressed.set(1);
      scale.set(springTo(pressedScale));
    },
    onPressOut: () => {
      pressed.set(0);
      scale.set(springTo(1));
    },
    style,
  };
}

/**
 * The price refresh indicator (#785), after Material 3 Expressive's loading
 * indicator: a small shape that turns and softens from a rounded square to a
 * circle and back. It is neutral, not green, and holds still under reduced
 * motion. Pair it with a busy label; it is hidden from screen readers.
 */
export function ExpressiveLoader({ color, size = 18, testID = "expressive-loader" }: {
  color: string;
  size?: number;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      turn.set(0);
      return;
    }
    turn.set(withRepeat(
      withTiming(1, { duration: motionDurations.loader, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    ));
    return () => cancelAnimation(turn);
  }, [reduced, turn]);
  const shape = useAnimatedStyle(() => {
    const progress = turn.get();
    // A square looks the same after half a turn, so each loop joins up.
    return {
      borderRadius: size * (0.3 + 0.2 * Math.sin(progress * Math.PI)),
      transform: [{ rotate: `${progress * 180}deg` }],
    };
  }, [size]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: color, height: size, width: size }, shape]}
      testID={testID}
    />
  );
}

/**
 * A still placeholder bar shown while data or prices load. It does not pulse,
 * so it adds no motion, and screen readers hear one label for the group.
 */
export function Skeleton({ height = 14, style, width = "100%" }: {
  height?: number;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface.elevated, height, width }, style]}
      testID="skeleton-bar"
    />
  );
}

/** Rows of placeholder bars standing in for a list or card that is loading. */
export function SkeletonRows({ accessibilityLabel = "Loading", rows = 3, testID }: {
  accessibilityLabel?: string;
  rows?: number;
  testID?: string;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessible style={styles.rows} testID={testID}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width="45%" />
          <Skeleton width="20%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: radii.pill },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 40 },
  rows: { gap: 4 },
});
