import { useWindowDimensions, View } from "react-native";

import {
  AppText,
  GapLabel,
  MaskedValue,
  TargetBar,
  PremiumCard,
  getAdaptiveLayoutMode,
} from "@/src/components/common";

import { annualContributionMaximum } from "@/src/domain/ppf/calculations";
import { decimal, normalizePercentage } from "@/src/domain/precision";
import { useTheme } from "@/src/theme";

import { useStyles } from "./ppfAccountStyles";

export function Metric({ label, masked, value }: { label: string; masked: boolean; value: string }) {
  const styles = useStyles();
  return (
    <PremiumCard section style={styles.metric}>
      <AppText color="secondary" variant="caption">{label}</AppText>
      <MaskedValue masked={masked} value={value} weight="bold" />
    </PremiumCard>
  );
}

export function Detail({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  return (
    <View style={[styles.detailRow, stacked && styles.stacked]}>
      <AppText color="secondary">{label}</AppText>
      <AppText style={[styles.detailValue, stacked && styles.stackedValue]} weight="bold">{value}</AppText>
    </View>
  );
}

/**
 * This financial year's contributions against the ₹1.5 lakh limit, as a bar
 * with the share in words. Hidden while values are masked, since the share of a
 * known limit reveals the amount.
 */
export function ContributionLimitBar({ contributed, masked }: { contributed: number; masked: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (masked) return null;
  const pct = normalizePercentage(decimal(contributed).dividedBy(annualContributionMaximum).times(100));
  const over = contributed > annualContributionMaximum;
  const text = over
    ? "Over the ₹1.5 lakh yearly limit"
    : `${Math.round(pct)}% of the ₹1.5 lakh yearly limit`;
  return (
    <View accessibilityLabel={text} accessible style={styles.limit} testID="ppf-contribution-limit">
      <TargetBar color={colors.blue} fillPct={pct} />
      <GapLabel icon={over ? "alert-circle-outline" : pct >= 100 ? "checkmark" : "pie-chart-outline"} text={text} />
    </View>
  );
}
