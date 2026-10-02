import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, type PressableProps } from "react-native";

import { colors, spacing } from "@/src/theme";
import { AppText } from "./AppText";
import { androidRipple, getPressedStateStyle, minimumTouchTargetStyle } from "./pressableStyles";

type DisclosureButtonProps = Pick<PressableProps, "onPress" | "testID"> & {
  expanded: boolean;
  title: string;
};

export function DisclosureButton({ expanded, title, ...props }: DisclosureButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      android_ripple={androidRipple()}
      style={({ pressed }) => [styles.row, getPressedStateStyle({ pressed })]}
    >
      <AppText style={styles.label} weight="medium">{title}</AppText>
      <Ionicons
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        name={expanded ? "chevron-up" : "chevron-down"}
        size={20}
        color={colors.text.secondary}
        testID={props.testID ? `${props.testID}-indicator` : undefined}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...minimumTouchTargetStyle,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  label: { flex: 1, flexShrink: 1 },
});
