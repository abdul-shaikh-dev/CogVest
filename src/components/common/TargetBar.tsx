import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { radii, spacing, createThemedStyles, useTheme } from "@/src/theme";

import { AppText } from "./AppText";

/**
 * A thin bar filled to a share, with an optional marker at a target or limit
 * (#764). It is decoration for a value the screen also states in words, so it
 * is hidden from screen readers.
 */
export function TargetBar({ color, fillPct, markerPct, testID }: {
  color: string;
  fillPct: number;
  markerPct?: number;
  testID?: string;
}) {
  const styles = useStyles();
  const clamp = (value: number) => `${Math.max(0, Math.min(value, 100))}%` as const;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.track}
      testID={testID}
    >
      <View style={[styles.fill, { backgroundColor: color, width: clamp(fillPct) }]} />
      {markerPct === undefined ? null : <View style={[styles.marker, { left: clamp(markerPct) }]} />}
    </View>
  );
}

/** A small neutral label with an icon, for a gap or room left beside a TargetBar. */
export function GapLabel({ icon, testID, text }: {
  icon: ComponentProps<typeof Ionicons>["name"];
  testID?: string;
  text: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.gap} testID={testID}>
      <Ionicons accessible={false} color={colors.text.secondary} name={icon} size={14} />
      <AppText variant="caption" weight="medium">{text}</AppText>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  fill: { borderRadius: radii.pill, height: "100%" },
  gap: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  marker: {
    backgroundColor: colors.text.primary,
    borderRadius: 1,
    height: 16,
    marginLeft: -1,
    position: "absolute",
    top: -4,
    width: 2,
  },
  track: { backgroundColor: colors.surface.elevated, borderRadius: radii.pill, height: 8 },
}));
