import { useWindowDimensions, View } from "react-native";

import {
  AppText,
  MaskedValue,
  PremiumCard,
  getAdaptiveLayoutMode,
} from "@/src/components/common";

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
