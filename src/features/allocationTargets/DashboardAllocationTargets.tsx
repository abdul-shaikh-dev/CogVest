import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, CategoryIcon, DisclosureButton, GapLabel, MaskedValue, TargetBar } from "@/src/components/common";
import {
  calculateAllocationDrift,
  type AllocationActual,
  type AllocationDrift,
  type AllocationDriftRow,
} from "@/src/domain/allocationTargets";
import type { ReportingAllocationClass } from "@/src/domain/calculations/reportingAllocation";
import { formatCompactINR, formatINR } from "@/src/domain/formatters";
import { getAllocationColor } from "@/src/features/dashboard/dashboardViewModel";
import { spacing, createThemedStyles, useTheme } from "@/src/theme";
import type { AllocationTargets, DisplayMode } from "@/src/types";

import { allocationLabel, gapText, newMoneyNote, rowAccessibilityLabel, wholeRupees } from "./targetViewModel";

/**
 * Target against actual on the Dashboard allocation (#764). Information only:
 * it says how far each class is from its target, never what to buy or sell.
 * The class rows live in the allocation legend, so each share is shown once;
 * Minimal Mode keeps the comparison folded until opened.
 */
export type AllocationTargetComparison = {
  drift: AllocationDrift;
  expanded: boolean;
  minimal: boolean;
  /** Drift rows by class, only while the comparison is shown and available. */
  rows: ReadonlyMap<ReportingAllocationClass, AllocationDriftRow>;
  toggle: () => void;
  visible: boolean;
};

export function useAllocationTargetComparison({ allocation, displayMode, targets }: {
  /** The complete allocation, or null when part of it is unavailable. */
  allocation: readonly AllocationActual[] | null;
  displayMode: DisplayMode;
  targets: AllocationTargets | undefined;
}): AllocationTargetComparison | null {
  const [expanded, setExpanded] = useState(false);
  if (!targets) return null;
  const minimal = displayMode === "minimal";
  const visible = !minimal || expanded;
  const drift: AllocationDrift = allocation ? calculateAllocationDrift(allocation, targets) : { status: "unavailable" };
  const rows = new Map(visible && drift.status === "available"
    ? drift.rows.map((row) => [row.assetClass, row] as const) : []);
  return { drift, expanded, minimal, rows, toggle: () => setExpanded((value) => !value), visible };
}

/** Above the legend: the Minimal Mode toggle, and what the marker means. */
export function AllocationTargetsKey({ comparison }: { comparison: AllocationTargetComparison | null }) {
  if (!comparison) return null;
  return (
    <>
      {comparison.minimal ? (
        <DisclosureButton
          expanded={comparison.expanded}
          onPress={comparison.toggle}
          testID="dashboard-targets-toggle"
          title="Compare with targets"
        />
      ) : null}
      {comparison.rows.size ? (
        <AppText color="secondary" testID="dashboard-targets-key" variant="caption">
          Each bar shows the class now. The line marks your target.
        </AppText>
      ) : null}
    </>
  );
}

/**
 * Under one legend row: a bar of the actual share with a marker at the
 * target, and the gap written out beside an arrow, so direction never relies
 * on colour.
 */
export function AllocationTargetLine({ row }: { row: AllocationDriftRow }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const icon = row.gapPts === 0 ? "checkmark" : row.gapPts > 0 ? "arrow-up" : "arrow-down";
  return (
    <View
      accessibilityLabel={rowAccessibilityLabel(row)}
      accessible
      style={styles.line}
      testID={`dashboard-target-${row.assetClass}`}
    >
      <TargetBar color={getAllocationColor(colors, row.assetClass)} fillPct={row.actualPct} markerPct={row.targetPct} />
      <View style={styles.lineCaption}>
        <AppText color="secondary" variant="caption">{`Target ${row.targetPct}%`}</AppText>
        <GapLabel icon={icon} testID={`dashboard-target-gap-${row.assetClass}`} text={gapText(row.gapPts)} />
      </View>
    </View>
  );
}

/** Under the legend: why there is no comparison, or the new-money estimate. */
export function DashboardAllocationTargets({ comparison, masked }: {
  comparison: AllocationTargetComparison | null;
  masked: boolean;
}) {
  const styles = useStyles();
  if (!comparison?.visible) return null;
  const { drift } = comparison;

  return (
    <View style={styles.section} testID="dashboard-targets">
      {drift.status === "unavailable" ? (
        <AppText color="secondary" testID="dashboard-targets-unavailable" variant="caption">
          The comparison with your targets needs every holding priced, and Cash and Futures equity at zero or above.
        </AppText>
      ) : (
        <>
          {drift.newMoneyInr ? (
            <>
              <AppText color="secondary" variant="caption">New money to reach every target</AppText>
              <MaskedValue
                exactValue={formatINR(drift.newMoneyInr)}
                masked={masked}
                testID="dashboard-targets-new-money-total"
                value={`About ${wholeRupees(drift.newMoneyInr)}`}
                weight="bold"
              />
            </>
          ) : null}
          <AppText color="secondary" testID="dashboard-targets-new-money" variant="caption">
            {newMoneyNote(drift)}
          </AppText>
          {drift.newMoneyInr ? drift.rows.filter((row) => row.newMoneyInr > 0).map((row) => (
            <View key={row.assetClass} style={styles.split}>
              <View style={styles.label}>
                <CategoryIcon assetClass={row.assetClass === "equity" ? "stock" : row.assetClass} size={16} />
                <AppText variant="caption">{allocationLabel(row.assetClass)}</AppText>
              </View>
              <MaskedValue
                exactValue={formatINR(row.newMoneyInr)}
                masked={masked}
                testID={`dashboard-target-new-money-${row.assetClass}`}
                value={formatCompactINR(row.newMoneyInr)}
                variant="caption"
                weight="medium"
              />
            </View>
          )) : null}
        </>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  label: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  line: { gap: spacing.xs, paddingTop: spacing.xs },
  lineCaption: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  section: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  split: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
}));
