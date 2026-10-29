import { StyleSheet } from "react-native";

import { createThemedStyles, interaction, radii, spacing } from "@/src/theme";

export const useStyles = createThemedStyles((colors) => StyleSheet.create({
  stackedContent: { flexDirection: "column", alignItems: "stretch" },
  stackedValue: { alignItems: "flex-start" },
  pendingValuationCopy: { flexGrow: 1, flexShrink: 1 },
  performanceLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: colors.text.primary,
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
  listHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: spacing.md,
  },
  listActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  listAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  detailScreen: { flex: 1, backgroundColor: colors.background },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  detailContent: { padding: spacing.md, paddingBottom: spacing.xl },
  detailStatus: { paddingHorizontal: spacing.md },
  detailIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  detailActions: {
    gap: spacing.xs,
  },
  detailValuation: {
    gap: spacing.sm,
  },
  detailInvested: {
    gap: spacing.xs,
  },
  detailPosition: {
    gap: spacing.sm,
  },

  assetCopy: {
    flex: 1,
    gap: 2,
  },
  compactRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  destinationTab: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
  },
  destinationTabActive: {
    borderBottomColor: colors.primary,
  },
  destinationTabs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  detail: {
    flexBasis: "45%",
    flexGrow: 1,
    gap: 2,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.md,
    rowGap: spacing.sm,
  },
  expandedSection: {
    gap: spacing.md,
  },
  exposureCard: {
    gap: spacing.sm,
  },
  exposureLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.md,
    rowGap: spacing.sm,
  },
  exposureRail: {
    borderRadius: radii.pill,
    flexDirection: "row",
    height: 10,
    overflow: "hidden",
  },
  exposureSegment: {
    height: "100%",
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.pill,
    justifyContent: "center",
    paddingHorizontal: spacing.cardInner,
    paddingVertical: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  holdingCard: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
    gap: spacing.sm,
    overflow: "hidden",
    paddingVertical: spacing.cardGap,
    paddingHorizontal: spacing.xs,
  },
  holdingMetric: {
    flex: 1,
    gap: 2,
    minWidth: 84,
  },
  holdingMetricHalf: {
    flexBasis: "45%",
  },
  holdingCardPressed: {
    backgroundColor: colors.surface.card,
  },
  holdingMetrics: {
    columnGap: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.xs,
  },
  holdingNumber: {
    fontVariant: ["tabular-nums"],
  },
  holdingWeightMetric: {
    alignItems: "flex-end",
  },
  minimalWeightMetric: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  holdingWeightTrack: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    height: 3,
    overflow: "hidden",
    width: "100%",
  },
  holdingWeightFill: {
    backgroundColor: colors.primary,
    height: "100%",
  },
  holdingsList: {
    backgroundColor: colors.background,
  },
  insightCard: {
    flex: 1,
    gap: spacing.xs,
    minHeight: 88,
  },
  insightGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  insightTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  legendCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  legendDot: {
    borderRadius: radii.pill,
    height: 8,
    marginTop: 4,
    width: 8,
  },
  legendItem: {
    alignItems: "flex-start",
    flexBasis: "46%",
    flexGrow: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minWidth: 144,
  },
  negativeText: {
    color: colors.loss,
  },
  openingRecordCopy: {
    flex: 1,
    gap: 2,
  },
  openingRecordRow: {
    alignItems: "center",
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  openingRecords: {
    gap: spacing.sm,
  },
  positiveText: {
    color: colors.profit,
  },
  ppfAccountCard: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.cardInner,
  },
  ppfEmptyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  ppfSection: {
    gap: spacing.sm,
  },
  epfTotalRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: interaction.minimumTouchTarget,
  },
  ppfValue: {
    alignItems: "flex-end",
  },
  pendingValuationRow: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  panelBackdrop: {
    backgroundColor: colors.scrim,
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
  },
  addOptionGroup: {
    gap: spacing.xs,
  },
  panelContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  panelHeader: {
    alignItems: "center",
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  panelTitle: {
    flex: 1,
    minWidth: 0,
  },
  panelSheet: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.sheet,
    gap: spacing.md,
    maxHeight: "90%",
    padding: spacing.md,
  },
  quoteStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quoteStatusCopy: {
    flex: 1,
    gap: 2,
  },
  quoteStatusProminent: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    padding: spacing.cardInner,
  },
  quoteDetailsAction: {
    paddingHorizontal: spacing.xs,
  },
  recordAction: {
    flexGrow: 0,
  },
  recordActions: {
    alignSelf: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  resumeRow: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  sectionHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionActionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionHeadingCopy: {
    gap: 2,
  },
  statusCard: {
    backgroundColor: colors.surface.card,
    paddingVertical: spacing.sm,
  },
  topThreeCard: {
    gap: spacing.xs,
  },
  valueColumn: {
    alignItems: "flex-end",
    minWidth: 72,
  },
  valueQuoteContext: {
    borderColor: colors.border.subtle,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  warningText: {
    color: colors.warning,
  },
}));
