import { StyleSheet } from "react-native";

import { radii, spacing, createThemedStyles } from "@/src/theme";

export const useStyles = createThemedStyles((colors) => StyleSheet.create({
  xirrLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  xirrMeasure: { borderRadius: radii.pill, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.md },
  xirrMeasureSelected: { backgroundColor: colors.surface.elevated },
  xirrMeasures: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, paddingTop: spacing.sm },
  xirrLabel: {
    flex: 1,
    minWidth: 160,
  },
  priceDisclosure: {
    minHeight: 48,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  priceDisclosureLabel: {
    flexShrink: 1,
  },
  priceDetails: {
    gap: spacing.sm,
  },
  allocationHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  allocationHeaderStacked: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing.xs,
  },
  allocationTitle: {
    flexShrink: 1,
  },
  allocationLegend: {
    gap: spacing.md,
  },
  allocationItem: {
    gap: spacing.xs,
  },
  allocationLegendLabel: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  allocationLegendRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 40,
  },
  allocationLegendValue: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  allocationPercentage: {
    minWidth: 72,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  allocationAmount: {
    minWidth: 80,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  allocationTrack: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    height: 4,
    overflow: "hidden",
  },
  brandText: {
    color: colors.primary,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  quietActivity: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  compactSection: { paddingVertical: spacing.sm },
  heroCard: {
    gap: spacing.sm,
  },
  heroContextRow: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
  heroContextText: {
    flexShrink: 1,
    width: "100%",
  },
  heroMetricCell: {
    flex: 1,
    flexBasis: 0,
    gap: spacing.xs,
    minWidth: 0,
  },
  heroMetricCellFull: {
    flexBasis: "100%",
  },
  heroMetricCellHalf: {
    flexBasis: "45%",
  },
  heroMetrics: {
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  heroMetricsWrapped: {
    flexWrap: "wrap",
  },
  heroValue: {
    fontSize: 36,
    lineHeight: 40,
  },
  infoCardCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  infoCardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  liabilityCard: {
    gap: spacing.cardInner,
  },
  liabilityCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  liabilityHeader: {
    flexDirection: "row",
  },
  inlineAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  negativeText: {
    color: colors.loss,
  },
  positiveText: {
    color: colors.profit,
  },
  supportCard: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  supportRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  supportRowStacked: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
  warningText: {
    color: colors.warning,
  },
}));
