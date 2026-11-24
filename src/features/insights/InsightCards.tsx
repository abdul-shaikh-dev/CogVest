import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";
import { AppText, DisclosureButton, PremiumCard, SectionHeader } from "@/src/components/common";
import type { InsightKind } from "@/src/domain/calculations/behaviorInsightDetails";
import type { PortfolioStoreState } from "@/src/store";
import { interaction, spacing, useTheme } from "@/src/theme";
import { hasObservation } from "./insightCardsModel";
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
  const { colors } = useTheme();
  const { details, masked, minimal } = useBehaviorInsights(store, now);
  const [showEmpty, setShowEmpty] = useState(false);
  if (minimal) return null;
  // With nothing to observe yet, one line beats a list of placeholders (#806).
  const quiet = !masked && !details.some(hasObservation);
  return (
    <PremiumCard style={styles.group} testID="dashboard-insights">
      <SectionHeader title="Investment patterns" />
      <AppText color="secondary">
        {quiet
          ? "Patterns appear as you record buys, sells and planned holding periods."
          : "Optional observations, grounded in your records."}
      </AppText>
      {quiet ? (
        <DisclosureButton
          expanded={showEmpty}
          onPress={() => setShowEmpty((value) => !value)}
          testID="insights-empty-toggle"
          title="What each pattern needs"
        />
      ) : null}
      {quiet && !showEmpty ? null : details.map((detail) => (
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
  pressed: { opacity: interaction.pressedOpacity },
});
