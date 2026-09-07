import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";
import { AppText, PremiumCard, SectionHeader } from "@/src/components/common";
import type { InsightKind } from "@/src/domain/calculations/behaviorInsightDetails";
import type { PortfolioStoreState } from "@/src/store";
import { colors, spacing } from "@/src/theme";
import { useBehaviorInsights } from "./useBehaviorInsights";

export function InsightCards({
  store,
  now,
  onOpen,
}: {
  store: StoreApi<PortfolioStoreState>;
  now?: Date;
  onOpen?: (kind: InsightKind) => void;
}) {
  const { details, masked, minimal } = useBehaviorInsights(store, now);
  if (minimal) return null;
  return (
    <PremiumCard style={styles.group} testID="dashboard-insights">
      <SectionHeader title="Investment patterns" />
      <AppText color="secondary">
        Optional observations, grounded in your records.
      </AppText>
      {details.map((detail) => (
        <Pressable
          key={detail.kind}
          accessibilityRole="button"
          accessibilityLabel={`Open ${detail.title}`}
          onPress={() => onOpen?.(detail.kind)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          testID={`open-insight-${detail.kind}`}
        >
          <View style={styles.text}>
            <AppText weight="medium">{detail.title}</AppText>
            <AppText color="secondary" variant="caption">
              {masked
                ? "Details hidden while values are masked."
                : detail.availability === "available"
                  ? detail.summary
                  : "Not enough data yet · learn what contributes"}
            </AppText>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.text.secondary}
            accessible={false}
          />
        </Pressable>
      ))}
    </PremiumCard>
  );
}
const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.7 },
});
