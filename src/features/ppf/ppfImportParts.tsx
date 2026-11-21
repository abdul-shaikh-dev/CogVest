import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { AppText, MaskedValue, getAdaptiveLayoutMode } from "@/src/components/common";
import { formatINR } from "@/src/domain/formatters";
import { spacing, createThemedStyles } from "@/src/theme";
import type { PpfLedgerEntry } from "@/src/types";

export function Checkbox({ checked, disabled = false, label, onPress, testID }: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = usePartStyles();
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="checkbox" accessibilityState={{ checked, disabled }}
      disabled={disabled} onPress={onPress} style={styles.checkbox} testID={testID}>
      <AppText color={checked ? "primary" : "secondary"} weight="bold">{checked ? "✓" : "○"}</AppText>
      <AppText style={styles.checkboxText}>{label}</AppText>
    </Pressable>
  );
}

export function Summary({ label, masked = false, testID, value }: {
  label: string;
  masked?: boolean;
  testID?: string;
  value: number | string;
}) {
  const styles = usePartStyles();
  const { fontScale, width } = useWindowDimensions();
  const fullWidth = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  const display = typeof value === "number" ? formatINR(value) : value;
  return (
    <View style={[styles.summaryItem, fullWidth && styles.fullWidth]} testID={testID}>
      <AppText color="secondary" variant="caption">{label}</AppText>
      <MaskedValue masked={masked} value={display} weight="bold" />
    </View>
  );
}

export function friendlyEntryType(type: PpfLedgerEntry["type"]) {
  if (type === "interestCredit") return "Interest credited";
  if (type === "contribution") return "Contribution";
  if (type === "withdrawal") return "Withdrawal";
  return "Balance reconciliation";
}

const usePartStyles = createThemedStyles(() => StyleSheet.create({
  checkbox: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, minHeight: 48 },
  checkboxText: { flex: 1 },
  fullWidth: { flexBasis: "100%" },
  summaryItem: { flexGrow: 1, flexBasis: "42%", minWidth: 0, gap: spacing.xs },
}));
