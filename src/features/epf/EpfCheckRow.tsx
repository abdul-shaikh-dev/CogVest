import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText, androidRipple, getPressedStateStyle, minimumTouchTargetStyle } from "@/src/components/common";
import { spacing, useTheme } from "@/src/theme";

export function EpfCheckRow({ checked, label, helper, onToggle, testID }: {
  checked: boolean;
  label: string;
  helper?: string;
  onToggle: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      android_ripple={androidRipple()}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, getPressedStateStyle({ pressed })]}
      testID={testID}
    >
      <Ionicons color={checked ? colors.primary : colors.text.secondary} name={checked ? "checkbox" : "square-outline"} size={22} />
      <View style={styles.copy}>
        <AppText>{label}</AppText>
        {helper ? <AppText color="secondary" variant="caption">{helper}</AppText> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1 },
  row: { ...minimumTouchTargetStyle, alignItems: "center", flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
});
