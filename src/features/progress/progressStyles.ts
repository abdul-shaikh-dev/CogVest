import { StyleSheet } from "react-native";

import { interaction, radii, spacing, createThemedStyles } from "@/src/theme";

export const useStyles = createThemedStyles((colors) => StyleSheet.create({
  monthNavigation: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  monthNavigationLabel: { flex: 1, gap: 2 },

  monthlyAnswer: { gap: spacing.sm },
  summaryActions: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  heroValue: { fontSize: 40, lineHeight: 48 },
  answerMetrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  answerMetric: { flex: 1, minWidth: 120, gap: spacing.xs },
  assetSelectionStack: { flexDirection: "column" },

  assetSelectionGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  assetSelectionMetric: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  assetIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  assetRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  assetValue: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  chartPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 120,
    padding: spacing.md,
  },
  chartBlock: {
    gap: spacing.sm,
  },
  chartCardHeader: {
    alignItems: "flex-start",
    gap: spacing.xs,
    justifyContent: "space-between",
  },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  customRangeFields: {
    flexDirection: "column",
    gap: spacing.sm,
  },
  customRangeField: {
    gap: spacing.xs,
  },
  customRangeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  customRangeAction: {
    flexGrow: 1,
    minWidth: 120,
  },
  chartRangeContext: {
    gap: spacing.xs,
  },
  gapOutcome: {
    flex: 2,
    minWidth: 0,
    gap: spacing.xs,
  },
  comparisonMetricPair: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  comparisonMetric: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  gapValueRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  gapValues: {
    flex: 1,
    minWidth: 144,
    gap: spacing.xs,
  },
  gapAmount: {
    flex: 1,
    textAlign: "right",
  },
  legendItemDimmed: {
    opacity: 0.45,
  },
  legendItemFocused: {
    backgroundColor: colors.surface.elevated,
  },
  legendLine: {
    borderTopWidth: 2,
    width: 14,
  },
  legendLineDashed: {
    borderStyle: "dashed",
  },
  legendItem: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  monthPickerContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  monthPickerField: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  monthPickerHeader: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  monthPickerOption: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  monthPickerOptionSelected: {
    backgroundColor: colors.selected,
  },
  monthPickerOptions: {
    gap: spacing.xs,
  },
  monthChoice: {
    borderRadius: 12,
    flexBasis: "30%",
    flexGrow: 1,
    justifyContent: "center",
    minWidth: 84,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  monthChoiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  monthPickerOverlay: {
    backgroundColor: colors.scrim,
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  monthPickerSheet: {
    backgroundColor: colors.surface.card,
    borderRadius: 22,
    gap: spacing.sm,
    maxHeight: "72%",
    padding: spacing.md,
  },
  yearNavigator: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  yearPickerButton: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  yearPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  yearPickerOption: {
    alignItems: "center",
    borderRadius: 12,
    flexBasis: "30%",
    flexGrow: 1,
    justifyContent: "center",
    minWidth: 84,
    paddingHorizontal: spacing.sm,
  },
  neutralText: {
    color: colors.text.secondary,
  },
  portfolioSelectionContent: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.md,
  },
  rangeChip: {
    alignItems: "center",
    borderRadius: 999,
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: "auto",
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: spacing.xs,
  },
  rangeChipSelected: {
    backgroundColor: colors.primary,
  },
  rangeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  selectedPanel: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  snapshotCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  snapshotReviewAction: {
    alignSelf: "flex-start",
  },
  snapshotStatusCard: {
    minHeight: interaction.minimumTouchTarget,
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    gap: spacing.xs,
    paddingHorizontal: spacing.cardInner,
    paddingVertical: spacing.sm,
  },
  snapshotStatusHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  chartSurface: {
    flex: 1,
    backgroundColor: "transparent",
    overflow: "hidden",
    paddingBottom: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  axisText: {
    color: colors.text.secondary,
    fontSize: 11,
  },
  chartWithAxis: {
    alignItems: "stretch",
    flexDirection: "row",
  },
  gainText: {
    color: colors.profit,
  },
  lossText: {
    color: colors.loss,
  },
}));
