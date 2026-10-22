import { Pressable, View } from "react-native";

import { AppText } from "@/src/components/common";
import { EntryProgress } from "@/src/components/common/EntryProgress";

import { useStyles } from "./addHoldingStyles";
import type { AddHoldingPhase, phases } from "./useAddOpeningPosition";

/** Step progress for Add Holding: a bar on the asset step, then tappable steps. */
export function AddHoldingStepper({
  currentPhase,
  displayPhases,
  moveToPhase,
  savedAssetId,
}: {
  currentPhase: AddHoldingPhase;
  displayPhases: typeof phases;
  moveToPhase: (phase: AddHoldingPhase) => void;
  savedAssetId: string;
}) {
  const styles = useStyles();
  if (currentPhase === "asset") {
    return (
      <EntryProgress label="Add Holding progress" step={1} total={displayPhases.length} testID="add-holding-step-asset" />
    );
  }

  return (
    <View style={styles.stepper}>
      {displayPhases.map((phase, index) => {
        const isActive = phase.key === currentPhase;
        const displayIndex = displayPhases.findIndex(
          (item) => item.key === currentPhase,
        );
        const isComplete = index < displayIndex;
        const isDisabled = Boolean(savedAssetId) || index > displayIndex;

        return (
          <Pressable
            accessibilityLabel={`${phase.label}, step ${index + 1} of ${displayPhases.length}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, selected: isActive }}
            disabled={isDisabled}
            key={phase.key}
            onPress={() => moveToPhase(phase.key)}
            style={({ pressed }) => [
              styles.stepItem,
              isActive && styles.stepItemActive,
              isComplete && styles.stepItemComplete,
              isDisabled && styles.stepItemDisabled,
              pressed && styles.pressed,
            ]}
            testID={`add-holding-step-${phase.key}`}
          >
            <View
              style={[
                styles.stepDot,
                isActive && styles.stepDotActive,
                isComplete && styles.stepDotComplete,
              ]}
            />
            <AppText
              color={isActive || isComplete ? "primary" : "secondary"}
              style={styles.stepLabel}
              variant="caption"
              weight="bold"
            >
              {phase.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
