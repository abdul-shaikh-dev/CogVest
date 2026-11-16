import { StyleSheet } from "react-native";

import { createThemedStyles, interaction, spacing } from "@/src/theme";

export const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  balanceCard: { gap: spacing.sm },
  balanceHeading: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  // A matching line height keeps comma descenders visible at this size.
  balanceValue: { fontSize: 34, lineHeight: 42 },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  detailValue: { flex: 1, textAlign: "right" },
  error: { color: colors.loss },
  flex: { flex: 1 },
  formSection: { paddingVertical: spacing.sm },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between", minHeight: interaction.minimumTouchTarget },
  separator: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
  stacked: { alignItems: "stretch", flexDirection: "column" },
  stackedValue: { flex: 0, textAlign: "left" },
}));
