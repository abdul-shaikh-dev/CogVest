import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, DisclosureButton, MaskedValue } from "@/src/components/common";
import {
  calculateAllocationDrift,
  type AllocationActual,
  type AllocationDriftRow,
} from "@/src/domain/allocationTargets";
import { formatCompactINR, formatINR } from "@/src/domain/formatters";
import { spacing, createThemedStyles } from "@/src/theme";
import type { AllocationTargets, DisplayMode } from "@/src/types";

import { allocationLabel, gapText, newMoneySummary } from "./targetViewModel";

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
        <AppText weight="bold">Against your targets</AppText>
      )}
      {!minimal || expanded ? (
        drift.status === "unavailable" ? (
          <AppText color="secondary" testID="dashboard-targets-unavailable" variant="caption">
            The comparison needs every holding priced, and Cash and Futures equity at zero or above.
          </AppText>
        ) : (
          <>
            {drift.rows.map((row) => <TargetRow key={row.assetClass} row={row} />)}
            <AppText color="secondary" testID="dashboard-targets-new-money" variant="caption">
              {newMoneySummary(drift, masked)}
            </AppText>
            {drift.newMoneyInr ? (
              <View style={styles.splits}>
                {drift.rows.filter((row) => row.newMoneyInr > 0).map((row) => (
                  <View key={row.assetClass} style={styles.split}>
                    <AppText color="secondary" variant="caption">{allocationLabel(row.assetClass)}</AppText>
                    <MaskedValue
                      color="secondary"
                      exactValue={formatINR(row.newMoneyInr)}
                      masked={masked}
                      testID={`dashboard-target-new-money-${row.assetClass}`}
                      value={formatCompactINR(row.newMoneyInr)}
                      variant="caption"
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )
      ) : null}
    </View>
  );
}

function TargetRow({ row }: { row: AllocationDriftRow }) {
  const styles = useStyles();
  return (
    <View style={styles.row} testID={`dashboard-target-${row.assetClass}`}>
      <AppText style={styles.label}>{allocationLabel(row.assetClass)}</AppText>
      <AppText color="secondary" style={styles.detail} variant="caption">
        {`${row.actualPct}% · target ${row.targetPct}% · ${gapText(row.gapPts)}`}
      </AppText>
    </View>
  );
}

const useStyles = createThemedStyles(() => StyleSheet.create({
  detail: { flexShrink: 1, textAlign: "right" },
  label: { flexShrink: 0 },
  row: { alignItems: "baseline", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
  section: { gap: spacing.xs, paddingTop: spacing.sm },
  split: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  splits: { gap: 2 },
}));
