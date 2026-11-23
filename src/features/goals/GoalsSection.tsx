import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  DisclosureButton,
  MaskedValue,
  PremiumCard,
  SectionHeader,
  androidRipple,
  getPressedStateStyle,
} from "@/src/components/common";
import { formatCompactINR, formatDate, formatINR } from "@/src/domain/formatters";
import type { PortfolioStoreState } from "@/src/store";
import { radii, spacing, createThemedStyles } from "@/src/theme";

import { goalStatusText, reachedText } from "./goalViewModel";
import { useSavingsGoals, type SavingsGoalView } from "./useSavingsGoals";

/**
 * Savings goals on Progress (#767). Minimal Mode keeps them folded away until
 * the user opens them.
 */
export function GoalsSection({ now, onOpenGoal, store }: {
  now?: Date;
  onOpenGoal: (goalId?: string) => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const { displayMode, goals, maskWealthValues } = useSavingsGoals({ now, store });
  const [expanded, setExpanded] = useState(false);
  const minimal = displayMode === "minimal";
  const open = !minimal || expanded;

  return (
    <View style={styles.section} testID="goals-section">
      <SectionHeader title="Goals" />
      {minimal ? (
        <DisclosureButton
          expanded={expanded}
          onPress={() => setExpanded((value) => !value)}
          testID="goals-toggle"
          title={goals.length ? `Show goals (${goals.length})` : "Show goals"}
        />
      ) : null}
      {open ? (
        <>
          {goals.length === 0 ? (
            <AppText color="secondary" testID="goals-empty">
              Set a target amount and date, such as a house or retirement fund, and see what it takes to get there.
            </AppText>
          ) : (
            goals.map((view) => (
              <GoalCard key={view.goal.id} masked={maskWealthValues} onPress={() => onOpenGoal(view.goal.id)} view={view} />
            ))
          )}
          {goals.length < 20 ? (
            <AppButton onPress={() => onOpenGoal()} testID="goals-add" title="Add a goal" variant="secondary" />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function GoalCard({ masked, onPress, view }: { masked: boolean; onPress: () => void; view: SavingsGoalView }) {
  const styles = useStyles();
  const { goal, overlaps, progress } = view;
  const percent = progress.reachedPct ?? 0;
  return (
    <Pressable
      accessibilityHint="Opens the goal"
      accessibilityRole="button"
      android_ripple={androidRipple()}
      onPress={onPress}
      style={({ pressed }) => getPressedStateStyle({ pressed })}
      testID={`goal-card-${goal.id}`}
    >
      <PremiumCard style={styles.card}>
        <View style={styles.titleRow}>
          <AppText style={styles.title} weight="bold">{goal.name}</AppText>
          <AppText color="secondary" variant="caption">by {formatDate(goal.targetDate)}</AppText>
        </View>
        <View style={styles.valueRow}>
          {progress.currentValueInr === null ? (
            <AppText color="secondary" testID={`goal-value-${goal.id}`}>Waiting for prices</AppText>
          ) : (
            <MaskedValue
              exactValue={formatINR(progress.currentValueInr)}
              masked={masked}
              testID={`goal-value-${goal.id}`}
              value={formatCompactINR(progress.currentValueInr)}
              weight="bold"
            />
          )}
          <AppText color="secondary"> of </AppText>
          <MaskedValue
            exactValue={formatINR(goal.targetAmountInr)}
            masked={masked}
            value={formatCompactINR(goal.targetAmountInr)}
          />
        </View>
        <View
          accessibilityLabel={reachedText(progress)}
          accessible
          style={styles.track}
          testID={`goal-bar-${goal.id}`}
        >
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
        <AppText testID={`goal-reached-${goal.id}`} variant="caption" weight="medium">{reachedText(progress)}</AppText>
        <AppText color="secondary" testID={`goal-status-${goal.id}`} variant="caption">
          {goalStatusText(goal, progress, masked)}
        </AppText>
        {overlaps ? (
          <AppText color="secondary" testID={`goal-overlap-${goal.id}`} variant="caption">
            Shares holdings with another goal, so the same money counts toward both.
          </AppText>
        ) : null}
      </PremiumCard>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: { gap: spacing.xs },
  fill: { backgroundColor: colors.primary, borderRadius: radii.pill, height: "100%" },
  section: { gap: spacing.sm },
  title: { flex: 1 },
  titleRow: { alignItems: "baseline", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  track: { backgroundColor: colors.border.subtle, borderRadius: radii.pill, height: 8, overflow: "hidden" },
  valueRow: { alignItems: "baseline", flexDirection: "row", flexWrap: "wrap" },
}));
