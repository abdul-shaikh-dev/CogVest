import { StyleSheet, View } from "react-native";

import { AppButton, AppText, MASKED_VALUE_ACCESSIBILITY_LABEL, MaskedValue, PremiumCard } from "@/src/components/common";
import { formatCurrency } from "@/src/domain/formatters";
import { radii, spacing, useTheme } from "@/src/theme";

import type { SectorRow } from "./holdingsSectors";

/**
 * Holdings by sector (#823), as shares of market holding value, with the INR
 * value masked like every other amount. Unknown is shown, not hidden.
 */
export function SectorBreakdownCard({
  available,
  masked,
  onReviewSectors,
  rows,
  suggestionCount,
  unknownCount,
}: {
  available: boolean;
  masked: boolean;
  onReviewSectors?: () => void;
  rows: SectorRow[];
  suggestionCount: number;
  unknownCount: number;
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
          {rows.map((row) => {
            const value = row.value === undefined ? undefined : formatCurrency(row.value, "INR");
            const spokenValue = value === undefined ? "" : `, ${masked ? MASKED_VALUE_ACCESSIBILITY_LABEL : value}`;
            return (
              <View
                accessible
                accessibilityLabel={`${row.label} ${row.percentage.toFixed(0)} percent${spokenValue}`}
                key={row.key}
                style={styles.row}
                testID={`holdings-sector-${row.key}`}
              >
                <View style={styles.rowText}>
                  <AppText color={row.key === "other" ? "secondary" : undefined} variant="caption" weight="bold">
                    {row.label}
                  </AppText>
                  <View style={styles.figures}>
                    {value === undefined ? null : (
                      <MaskedValue
                        color="secondary"
                        masked={masked}
                        testID={`holdings-sector-${row.key}-value`}
                        value={value}
                        variant="caption"
                      />
                    )}
                    <AppText testID={`holdings-sector-${row.key}-pct`} variant="caption" weight="bold">
                      {row.percentage.toFixed(0)}%
                    </AppText>
                  </View>
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
            );
          })}
          {rows.some((row) => row.value === undefined) ? (
            <AppText color="secondary" variant="caption">
              Amounts are hidden because some holdings aren&apos;t priced in INR.
            </AppText>
          ) : null}
        </>
      ) : (
        <AppText color="secondary" variant="caption">
          Unavailable until every market holding has a price.
        </AppText>
      )}
      {(suggestionCount > 0 || unknownCount > 0) && onReviewSectors ? (
        <AppButton
          onPress={onReviewSectors}
          testID="holdings-sector-review"
          title={reviewTitle(suggestionCount, unknownCount)}
          variant="secondary"
        />
      ) : null}
    </PremiumCard>
  );
}

function reviewTitle(suggestionCount: number, unknownCount: number) {
  if (suggestionCount > 0) {
    return suggestionCount === 1 ? "Review 1 sector suggestion" : `Review ${suggestionCount} sector suggestions`;
  }
  return unknownCount === 1 ? "Set the sector of 1 Unknown holding" : `Set sectors for ${unknownCount} Unknown holdings`;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  figures: { alignItems: "baseline", flexDirection: "row", gap: spacing.sm },
  fill: { borderRadius: radii.pill, height: "100%" },
  row: { gap: spacing.xs },
  rowText: { flexDirection: "row", justifyContent: "space-between" },
  track: { borderRadius: radii.pill, height: 6, overflow: "hidden" },
});
