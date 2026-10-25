import { StyleSheet } from "react-native";

import { interaction, spacing, createThemedStyles } from "@/src/theme";

export const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  balanceCard: { gap: spacing.sm },
  balanceHeading: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  // A matching line height keeps comma descenders visible at this size.
  balanceValue: { fontSize: 34, lineHeight: 42 },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  detailRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between", minHeight: interaction.minimumTouchTarget },
  detailValue: { flex: 1, textAlign: "right" },
  error: { color: colors.loss },
  flex: { flex: 1 },
  formSection: { paddingVertical: spacing.sm },
  ledgerRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
  ledgerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metric: { flexGrow: 1, flexBasis: "auto", minWidth: 0 },
  metricRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  stackedValue: { flex: 0, textAlign: "left" },
  intrinsic: { flex: 0 },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  separator: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
}));
