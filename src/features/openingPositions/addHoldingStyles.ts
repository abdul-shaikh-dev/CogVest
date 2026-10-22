import { StyleSheet } from "react-native";

import { createThemedStyles, interaction, radii, spacing } from "@/src/theme";

export const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  assetChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: "48%",
  },
  assetChipActive: {
    backgroundColor: colors.selected,
  },
  assetChipCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  assetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  classChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  classChipActive: {
    backgroundColor: colors.selected,
  },
  classRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cashImpact: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  convictionChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
  },
  convictionChipActive: {
    backgroundColor: colors.primary,
  },
  convictionGroup: {
    gap: spacing.xs,
  },
  convictionRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  errorText: {
    color: colors.loss,
  },
  exitBackdrop: {
    backgroundColor: colors.scrim,
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  exitSheet: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.sheet,
    gap: spacing.md,
    padding: spacing.md,
  },
  flex: {
    flex: 1,
  },
  lookupGroup: {
    gap: spacing.xs,
  },
  lookupResults: {
    gap: spacing.xs,
  },
  lookupStatus: {
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  manualFields: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  negativeText: {
    color: colors.loss,
  },
  positiveText: {
    color: colors.profit,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  previewCell: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    width: "48%",
  },
  financialValue: { fontVariant: ["tabular-nums"] },
  positionIdentity: { alignItems: "center", flexDirection: "row", gap: spacing.sm, borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.md },
  reviewPnl: { borderTopColor: colors.border.subtle, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingVertical: spacing.sm },
  reviewPnlCell: { flex: 1, minWidth: 0, gap: spacing.xs },
  reviewPnlValues: { flexDirection: "row", columnGap: spacing.md },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stackedIdentifiers: {
    flexDirection: "column",
    gap: spacing.sm,
  },
  secondaryPositionFields: {
    gap: spacing.sm,
  },
  reviewDetailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  reviewDetailValue: {
    flex: 1,
    textAlign: "right",
  },
  reviewEditAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    minWidth: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  reviewSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewSections: {
    gap: spacing.cardGap,
  },
  selectedAssetSummary: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectedAssetChange: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    minWidth: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  successText: {
    color: colors.profit,
  },
  stepDot: {
    backgroundColor: colors.text.muted,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  stepDotActive: {
    backgroundColor: colors.profit,
  },
  stepDotComplete: {
    backgroundColor: colors.primary,
  },
  stepItem: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  stepLabel: {
    flexShrink: 1,
  },
  stepItemActive: {
    borderBottomColor: colors.primary,
  },
  stepItemComplete: {
    borderBottomColor: colors.border.subtle,
  },
  stepItemDisabled: {
    opacity: 0.72,
  },
  stepper: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  discoveryAction: {
    alignItems: "center",
    flexShrink: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  discoveryActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  discoveryProgress: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  progressTrack: { flex: 1, flexDirection: "row", gap: spacing.xs },
  progressSegment: { flex: 1, height: 3, backgroundColor: colors.border.subtle },
  progressSegmentActive: { backgroundColor: colors.primary },
  summaryCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  summaryCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  unknownDateControl: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    minHeight: interaction.minimumTouchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  unknownDateControlSelected: {
    backgroundColor: colors.selected,
  },
  unknownDateSummary: {
    gap: spacing.xs,
    minHeight: interaction.minimumTouchTarget,
    justifyContent: "center",
  },
}));
