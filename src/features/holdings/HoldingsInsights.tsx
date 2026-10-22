import { View } from "react-native";

import { AppText, PremiumCard } from "@/src/components/common";
import { useTheme } from "@/src/theme";

import type { ExposureSegment } from "./holdingsReview";
import { useStyles } from "./holdingsStyles";

export function InsightCard({
  detail,
  eyebrow,
  positive,
  title,
}: {
  detail: string;
  eyebrow: string;
  positive?: boolean;
  title: string;
}) {
  const styles = useStyles();
  return (
    <PremiumCard style={styles.insightCard}>
      <AppText color="secondary" variant="caption" weight="medium">
        {eyebrow}
      </AppText>
      <AppText numberOfLines={2} style={styles.insightTitle} weight="bold">
        {title}
      </AppText>
      <AppText
        color="secondary"
        style={positive === false ? styles.negativeText : undefined}
        variant="caption"
      >
        {detail}
      </AppText>
    </PremiumCard>
  );
}

export function ExposurePanel({ segments }: { segments: ExposureSegment[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <PremiumCard style={styles.exposureCard}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionHeadingCopy}>
          <AppText weight="bold">Asset mix</AppText>
          <AppText color="secondary" variant="caption">
            Portfolio split by asset class
          </AppText>
        </View>
      </View>

      <View style={styles.exposureRail}>
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={[
              styles.exposureSegment,
              {
                backgroundColor: ({ amber: colors.cryptoAmber, blue: colors.blue, green: colors.primary })[segment.color],
                flex: Math.max(segment.percentage, 1),
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.exposureLegend}>
        {segments.map((segment) => (
          <View key={segment.key} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: ({ amber: colors.cryptoAmber, blue: colors.blue, green: colors.primary })[segment.color] },
              ]}
            />
            <View style={styles.legendCopy}>
              <AppText variant="caption" weight="bold">
                {segment.label} {segment.percentage.toFixed(0)}%
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </PremiumCard>
  );
}
