import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";
import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  getAdaptiveLayoutMode,
} from "@/src/components/common";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";
import { useBehaviorInsights } from "./useBehaviorInsights";
import { ContextualNudge } from "@/src/features/onboarding/ContextualNudge";

export function InsightDetailScreen({
  kind,
  onClose,
  store = getPortfolioStore(),
  now,
}: {
  kind: string;
  onClose: () => void;
  store?: StoreApi<PortfolioStoreState>;
  now?: Date;
}) {
  const styles = useStyles();
  const { details, masked, minimal } = useBehaviorInsights(store, now);
  const detail = details.find((item) => item.kind === kind);
  const [recordsShown, setRecordsShown] = useState(0);
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  return (
    <ScreenContainer scroll testID="insight-detail-screen">
      <View style={styles.content}>
        <ScreenHeader
          title={detail && !minimal ? detail.title : "Insight details"}
          leading={
            <IconButton
              accessibilityLabel="Back"
              icon="arrow-back"
              onPress={onClose}
              testID="insight-back"
            />
          }
          action={
            <IconButton
              accessibilityLabel={masked ? "Show values" : "Mask values"}
              icon={masked ? "eye-off-outline" : "eye-outline"}
              onPress={() =>
                store
                  .getState()
                  .updatePreferences({ maskWealthValues: !masked })
              }
              testID="insight-mask-toggle"
            />
          }
        />
        {!detail ? (
          <EmptyState
            title="Insight unavailable"
            message="This link does not match an available insight. Your records have not changed."
            actionLabel="Back to Dashboard"
            onAction={onClose}
          />
        ) : minimal ? (
          <EmptyState
            title="Insights are paused"
            message="Minimal Mode keeps optional observations out of view. Your holdings and records are still available."
            actionLabel="Done"
            onAction={onClose}
          />
        ) : (
          <>
            <PremiumCard section style={styles.group} testID="insight-observation">
              {masked ? (
                <AppText color="secondary">
                  Values and supporting records are hidden. Tap Show values to view them.
                </AppText>
              ) : (
                <>
                  <AppText color="secondary" variant="caption">
                    {detail.period}
                  </AppText>
                  {detail.availability === "insufficientData" ? (
                    <AppText weight="bold">Not enough data yet</AppText>
                  ) : null}
                  <AppText weight="medium">{detail.summary}</AppText>
                </>
              )}
            </PremiumCard>
            <ContextualNudge kind="insights" store={store} />
            {!masked ? (
              <PremiumCard section style={styles.group} testID="insight-evidence">
                <SectionHeader title="What contributed" />
                {detail.facts.map((fact) => (
                  <View key={fact.label} style={[styles.fact, stacked && styles.stacked]} testID={`insight-fact-${fact.label}`}>
                    <AppText color="secondary" style={[styles.label, stacked && styles.intrinsic]}>
                      {fact.label}
                    </AppText>
                    <AppText style={[styles.value, stacked && styles.stackedValue]} weight="bold">{fact.value}</AppText>
                  </View>
                ))}
                {detail.records.slice(0, recordsShown).map((record) => (
                  <View key={record.id} style={styles.record}>
                    <AppText weight="medium">{record.assetName}</AppText>
                    <AppText color="secondary">{record.description}</AppText>
                    <AppText color="secondary" variant="caption">
                      {record.date ?? "Date not recorded"}
                    </AppText>
                  </View>
                ))}
                {recordsShown < detail.records.length ? (
                  <AppButton
                    title={
                      recordsShown === 0
                        ? "View supporting records"
                        : "Show more records"
                    }
                    variant="secondary"
                    onPress={() => setRecordsShown((count) => count + 10)}
                    testID="insight-show-records"
                  />
                ) : null}
                {recordsShown > 0 && detail.records.length > 0 ? (
                  <AppButton
                    title="Hide records"
                    variant="secondary"
                    onPress={() => setRecordsShown(0)}
                  />
                ) : null}
                {detail.records.length === 0 ? (
                  <AppText color="secondary">
                    {detail.kind === "frequency" &&
                    detail.availability === "available"
                      ? "No buys or sells were recorded in this window."
                      : "No supporting records yet. Extra details are optional."}
                  </AppText>
                ) : null}
              </PremiumCard>
            ) : null}
            <View style={styles.group}>
              <SectionHeader title="How to read this" />
              <AppText color="secondary">{detail.methodology}</AppText>
              <AppText color="secondary">{detail.limitation}</AppText>
              <AppText color="secondary" variant="caption">
                Recalculated from your current records. An observation, not
                financial or tax advice.
              </AppText>
            </View>
            <AppButton
              title="Done"
              variant="secondary"
              onPress={onClose}
              testID="insight-done"
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  content: { gap: spacing.cardGap, paddingTop: spacing.md },
  group: { gap: spacing.md },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  label: { flex: 1 },
  value: { flex: 1, textAlign: "right" },
  stacked: { flexDirection: "column" },
  intrinsic: { flex: 0 },
  stackedValue: { flex: 0, textAlign: "left" },
  record: { gap: spacing.xs, paddingVertical: spacing.sm },
}));
