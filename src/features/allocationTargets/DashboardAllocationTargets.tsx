import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, CategoryIcon, DisclosureButton, GapLabel, MaskedValue, TargetBar } from "@/src/components/common";
import {
  calculateAllocationDrift,
  type AllocationActual,
  type AllocationDriftRow,
} from "@/src/domain/allocationTargets";
import { formatCompactINR, formatINR } from "@/src/domain/formatters";
import { getAllocationColor } from "@/src/features/dashboard/dashboardViewModel";
import { spacing, createThemedStyles, useTheme } from "@/src/theme";
import type { AllocationTargets, DisplayMode } from "@/src/types";

import { allocationLabel, gapText, newMoneyNote, rowAccessibilityLabel, wholeRupees } from "./targetViewModel";

/**
 * Target against actual under the Dashboard allocation (#764). Information
 * only: it says how far each class is from its target, never what to buy or
 * sell. Minimal Mode keeps it folded until opened.
 */
export function DashboardAllocationTargets({ allocation, displayMode, masked, targets }: {
  /** The complete allocation, or null when part of it is unavailable. */
  allocation: readonly AllocationActual[] | null;
  displayMode: DisplayMode;
  masked: boolean;
  targets: AllocationTargets | undefined;
}) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  if (!targets) return null;
  const minimal = displayMode === "minimal";
  const drift = allocation ? calculateAllocationDrift(allocation, targets) : { status: "unavailable" as const };

  return (
    <View style={styles.section} testID="dashboard-targets">
      {minimal ? (
        <DisclosureButton
          expanded={expanded}
          onPress={() => setExpanded((value) => !value)}
          testID="dashboard-targets-toggle"
          title="Compare with targets"
        />
      ) : (
        <AppText accessibilityRole="header" weight="bold">Against your targets</AppText>
      )}
      {!minimal || expanded ? (
        drift.status === "unavailable" ? (
          <AppText color="secondary" testID="dashboard-targets-unavailable" variant="caption">
            The comparison needs every holding priced, and Cash and Futures equity at zero or above.
          </AppText>
        ) : (
          <>
            {drift.rows.map((row) => <TargetRow key={row.assetClass} row={row} />)}
            <View style={styles.newMoney}>
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
            </View>
          </>
        )
      ) : null}
    </View>
  );
}

/**
 * One class: a bar of its actual share with a marker at the target, and the
 * gap written out beside an arrow, so direction never relies on colour.
 */
function TargetRow({ row }: { row: AllocationDriftRow }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const icon = row.gapPts === 0 ? "checkmark" : row.gapPts > 0 ? "arrow-up" : "arrow-down";
  return (
    <View
      accessibilityLabel={rowAccessibilityLabel(row)}
      accessible
      style={styles.row}
      testID={`dashboard-target-${row.assetClass}`}
    >
      <View style={styles.heading}>
        <View style={styles.label}>
          <CategoryIcon assetClass={row.assetClass === "equity" ? "stock" : row.assetClass} size={18} />
          <AppText>{allocationLabel(row.assetClass)}</AppText>
        </View>
        <GapLabel icon={icon} testID={`dashboard-target-gap-${row.assetClass}`} text={gapText(row.gapPts)} />
      </View>
      <TargetBar color={getAllocationColor(colors, row.assetClass)} fillPct={row.actualPct} markerPct={row.targetPct} />
      <AppText color="secondary" variant="caption">{`${row.actualPct}% now · target ${row.targetPct}%`}</AppText>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  heading: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
  label: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  newMoney: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  row: { gap: spacing.xs },
  section: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  split: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
}));
