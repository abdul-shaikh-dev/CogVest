import { StyleSheet, View } from "react-native";

import { AppButton, AppText, PremiumCard } from "@/src/components/common";
import { radii, spacing, useTheme } from "@/src/theme";

import type { SectorRow } from "./holdingsSectors";

/**
 * Holdings by sector (#823), as shares of market holding value. Percentages
 * only, so nothing here needs masking. Unknown is shown, not hidden.
 */
export function SectorBreakdownCard({
  available,
  onReviewSuggestions,
  rows,
  suggestionCount,
}: {
  available: boolean;
  onReviewSuggestions?: () => void;
  rows: SectorRow[];
  suggestionCount: number;
}) {
  const { colors } = useTheme();
  return (
    <PremiumCard style={styles.card} testID="holdings-sector-breakdown">
      <AppText weight="bold">By sector</AppText>
      {available && rows.length ? (
        <>
          <AppText color="secondary" variant="caption">
            Share of market holding value, excluding cash and PPF accounts.
          </AppText>
          {rows.map((row) => (
            <View
              accessible
              accessibilityLabel={`${row.label} ${row.percentage.toFixed(0)} percent`}
              key={row.key}
              style={styles.row}
              testID={`holdings-sector-${row.key}`}
            >
              <View style={styles.rowText}>
                <AppText color={row.key === "other" ? "secondary" : undefined} variant="caption" weight="bold">
                  {row.label}
                </AppText>
                <AppText testID={`holdings-sector-${row.key}-pct`} variant="caption" weight="bold">
                  {row.percentage.toFixed(0)}%
                </AppText>
              </View>
              <View style={[styles.track, { backgroundColor: colors.border.subtle }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: row.key === "other" ? colors.border.strong : colors.primary,
                      width: `${Math.max(Math.min(row.percentage, 100), 1)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </>
      ) : (
        <AppText color="secondary" variant="caption">
          Unavailable until every market holding has a price.
        </AppText>
      )}
      {suggestionCount > 0 && onReviewSuggestions ? (
        <AppButton
          onPress={onReviewSuggestions}
          testID="holdings-sector-review"
          title={suggestionCount === 1 ? "Review 1 sector suggestion" : `Review ${suggestionCount} sector suggestions`}
          variant="secondary"
        />
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  fill: { borderRadius: radii.pill, height: "100%" },
  row: { gap: spacing.xs },
  rowText: { flexDirection: "row", justifyContent: "space-between" },
  track: { borderRadius: radii.pill, height: 6, overflow: "hidden" },
});
