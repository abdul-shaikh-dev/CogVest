import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppButton,
  AppText,
  PremiumCard,
  ScreenContainer,
} from "@/src/components/common";
import { spacing, createThemedStyles } from "@/src/theme";

type RecoveryScreenProps = {
  affectedAreas: string[];
  recoveryCopiesPreserved: boolean;
  onReset: () => void;
};

export function RecoveryScreen({
  affectedAreas,
  recoveryCopiesPreserved,
  onReset,
}: RecoveryScreenProps) {
  const styles = useStyles();
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  return (
    <ScreenContainer scroll testID="storage-recovery-screen">
      <View style={styles.content}>
        <View style={styles.heading}>
          <AppText variant="title" weight="bold">
            Local data needs recovery
          </AppText>
          <AppText color="secondary">
            CogVest could not read some saved data. It has not replaced it
            with an empty portfolio.
          </AppText>
        </View>

        <PremiumCard>
          <AppText weight="bold">
            {recoveryCopiesPreserved
              ? "Your original data was preserved"
              : "CogVest stopped before overwriting your data"}
          </AppText>
          <AppText color="secondary" variant="caption">
            {recoveryCopiesPreserved
              ? "A recovery copy remains on this device. Your portfolio and monthly snapshot updates are paused until you decide how to continue."
              : "CogVest could not create a recovery copy. Do not reset the affected data; restart the app or seek support before continuing."}
          </AppText>
          <View style={styles.affectedAreas}>
            {affectedAreas.map((area) => (
              <View key={area} style={styles.areaRow}>
                <View style={styles.areaDot} />
                <AppText color="secondary" style={styles.areaLabel} variant="caption">
                  {area}
                </AppText>
              </View>
            ))}
          </View>
        </PremiumCard>

        {!recoveryCopiesPreserved ? null : isConfirmingReset ? (
          <PremiumCard elevated>
            <AppText weight="bold">Reset affected local data?</AppText>
            <AppText color="secondary" variant="caption">
              CogVest will remove the unreadable data from your active portfolio.
              The recovery copy will remain on this device.
            </AppText>
            <View style={styles.actions}>
              <AppButton
                onPress={() => setIsConfirmingReset(false)}
                testID="cancel-storage-reset"
                title="Keep data"
              />
              <AppButton
                onPress={onReset}
                testID="confirm-storage-reset"
                title="Reset and continue"
                variant="destructive"
              />
            </View>
          </PremiumCard>
        ) : (
          <AppButton
            onPress={() => setIsConfirmingReset(true)}
            testID="start-storage-reset"
            title="Review reset"
            variant="secondary"
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  affectedAreas: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  areaDot: {
    backgroundColor: colors.warning,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  areaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  areaLabel: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  heading: {
    gap: spacing.sm,
  },
}));
