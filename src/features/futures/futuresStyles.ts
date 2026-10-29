import { StyleSheet } from "react-native";

import { spacing, createThemedStyles } from "@/src/theme";

export const useStyles = createThemedStyles((colors) => StyleSheet.create({
  conversionGroup: { gap: spacing.md, paddingTop: spacing.sm },
  fill: { flex: 1 },
  modal: { flex: 1, justifyContent: "center", padding: spacing.screenHorizontal, backgroundColor: colors.background },
  breakdown: { borderTopColor: colors.border.subtle, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.md },
  metric: { gap: spacing.xs, paddingVertical: spacing.xs },
  deleteAction: { alignSelf: "center", minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md },
  eventDelete: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md },
  content: { gap: spacing.cardGap, paddingTop: spacing.md, paddingBottom: spacing.xl },
  row: { borderTopColor: colors.border.subtle, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.md },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: { minHeight: 48, justifyContent: "center", borderColor: colors.border.strong, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selected: { borderColor: colors.primary, backgroundColor: colors.surface.elevated },
  checkbox: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  choiceLabel: { flex: 1 },
  error: { color: colors.loss },
}));
