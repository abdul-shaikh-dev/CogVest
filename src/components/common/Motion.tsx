import type { ReactNode } from "react";
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, FadeIn, ReduceMotion, useReducedMotion } from "react-native-reanimated";

import { getMotionDuration, radii, useTheme, type MotionKind } from "@/src/theme";

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

/** Fades its children in when it mounts: screen entry and cards revealed after loading. */
export function FadeInView({ children, kind = "reveal", style, testID }: {
  children: ReactNode;
  kind?: MotionKind;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const entering = useFadeIn(kind);
  return <Animated.View entering={entering} style={style} testID={testID}>{children}</Animated.View>;
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
