import { StyleSheet, View } from "react-native";
import { spacing, createThemedStyles } from "@/src/theme";
import { AppText } from "./AppText";

export function EntryProgress({ label, step, stepName, total, testID }: {
  label: string; step: number;
  /** What the current step is for, announced after "Step n of m" (#670). */
  stepName?: string;
  total: number; testID?: string;
}) {
  const styles = useStyles();
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 1, max: total, now: step, text: `Step ${step} of ${total}${stepName ? `: ${stepName}` : ""}` }}
    style={styles.progress} testID={testID}>
    <AppText color="secondary" variant="caption">{step} of {total}</AppText>
    <View style={styles.track}>
      {Array.from({ length: total }, (_, index) => <View key={index}
        style={[styles.segment, index < step && styles.active]} />)}
    </View>
  </View>;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  progress: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  track: { flex: 1, flexDirection: "row", gap: spacing.xs },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border.subtle },
  active: { backgroundColor: colors.primary },
}));
