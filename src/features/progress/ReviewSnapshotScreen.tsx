import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, PremiumCard, ScreenContainer, ScreenHeader, SectionHeader, SensitiveValueReveal, useSensitiveValueReveal } from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { isVisualQaSessionActive } from "@/src/testing/visualQaSeed";
import { spacing } from "@/src/theme";
import type { MonthlySnapshot } from "@/src/types";

import { useProgress } from "./useProgress";
import { suggestGeneratedSnapshotTotal, validateMonthlySnapshot } from "@/src/domain/monthlySnapshotValidation";

type ReviewSnapshotScreenProps = {
  now?: Date;
  onCancel: () => void;
  onComplete: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

function setSnapshotFormFields({
  progress,
  snapshot,
}: {
  progress: ReturnType<typeof useProgress>;
  snapshot: MonthlySnapshot;
}) {
  progress.setField("month", snapshot.month);
  progress.setField("portfolioValue", String(suggestGeneratedSnapshotTotal(snapshot) ?? snapshot.portfolioValue));
  progress.setField("investedValue", String(snapshot.investedValue));
  progress.setField("equityValue", String(snapshot.equityValue));
  progress.setField("debtValue", String(snapshot.debtValue));
  progress.setField("cryptoValue", String(snapshot.cryptoValue));
  progress.setField("cashValue", String(snapshot.cashValue));
  progress.setField("monthlyInvestment", String(snapshot.monthlyInvestment));
  progress.setField("notes", snapshot.notes ?? "");
}

export function ReviewSnapshotScreen({
  now,
  onCancel,
  onComplete,
  store = getPortfolioStore(),
}: ReviewSnapshotScreenProps) {
  const progress = useProgress({ now, store });
  const { isRevealed, reveal } = useSensitiveValueReveal(progress.preferences.maskWealthValues);
  const hasRunAutomationRef = useRef(false);
  const hasPrefilledFormRef = useRef(false);
  const reviewedSnapshotId = useRef<string | undefined>(undefined);
  const invalidSnapshot = store.getState().monthlySnapshots.find((snapshot) => Object.keys(validateMonthlySnapshot(snapshot)).length > 0);
  const hasSuggestedTotal = invalidSnapshot !== undefined && suggestGeneratedSnapshotTotal(invalidSnapshot) !== null;

  useEffect(() => {
    if (hasRunAutomationRef.current || isVisualQaSessionActive() || invalidSnapshot) {
      return;
    }

    hasRunAutomationRef.current = true;
    void progress.ensureMonthEndSnapshot({ retryProvisional: false });
  }, [progress]);

  useEffect(() => {
    if (hasPrefilledFormRef.current) {
      return;
    }

    const snapshot =
      invalidSnapshot ?? progress.snapshotAutomationStatus.snapshot ?? progress.latestSummary?.snapshot;

    if (!snapshot) {
      return;
    }

    setSnapshotFormFields({ progress, snapshot });
    reviewedSnapshotId.current = snapshot.id;
    hasPrefilledFormRef.current = true;
  }, [progress]);

  function saveSnapshotChanges() {
    if (progress.saveSnapshot(reviewedSnapshotId.current)) {
      onComplete();
    }
  }

  if (!isRevealed) {
    return (
      <ScreenContainer scroll testID="review-snapshot-screen">
        <View style={styles.content}>
          <ScreenHeader title="Review Snapshot" subtitle="Values masked" />
          <PremiumCard>
            <SensitiveValueReveal onReveal={reveal} testID="reveal-snapshot" />
          </PremiumCard>
          <AppButton title="Back to Progress" variant="secondary" onPress={onCancel} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll testID="review-snapshot-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Review Snapshot"
          subtitle="Generated automatically - edit only if something needs correction"
        />

        <PremiumCard>
          <SectionHeader title="Snapshot details" />
          {invalidSnapshot ? <AppText testID="snapshot-repair-guidance">A stored snapshot needs correction before backup. Review its month, total and asset-class balances. Values remain unchanged until you save.</AppText> : null}
          {hasSuggestedTotal ? <AppText testID="snapshot-rounding-guidance">The saved total differs from its balances by at most two paise. The total below now adds up to those balances. Review and save to confirm; your saved record has not changed.</AppText> : null}
          <AppText color="secondary" variant="caption">
            These values are prefilled from your local portfolio records. Saving changes updates this month only.
          </AppText>
        </PremiumCard>

        <PremiumCard>
          <FormTextField
            error={progress.errors.month}
            label="Month"
            onChangeText={(value) => progress.setField("month", value)}
            placeholder="YYYY-MM"
            testID="snapshot-month-input"
            value={progress.formValues.month}
          />
          <FormTextField
            error={progress.errors.portfolioValue}
            keyboardType="decimal-pad"
            label="Portfolio value"
            onChangeText={(value) => progress.setField("portfolioValue", value)}
            placeholder="1385000"
            testID="snapshot-portfolio-input"
            value={progress.formValues.portfolioValue}
          />
          <FormTextField
            error={progress.errors.investedValue}
            keyboardType="decimal-pad"
            label="Invested value"
            onChangeText={(value) => progress.setField("investedValue", value)}
            placeholder="1060000"
            testID="snapshot-invested-input"
            value={progress.formValues.investedValue}
          />
          <View style={styles.fieldGrid}>
            <FormTextField
              error={progress.errors.equityValue}
              keyboardType="decimal-pad"
              label="Equity"
              onChangeText={(value) => progress.setField("equityValue", value)}
              placeholder="880000"
              testID="snapshot-equity-input"
              value={progress.formValues.equityValue}
            />
            <FormTextField
              error={progress.errors.debtValue}
              keyboardType="decimal-pad"
              label="Debt"
              onChangeText={(value) => progress.setField("debtValue", value)}
              placeholder="320000"
              testID="snapshot-debt-input"
              value={progress.formValues.debtValue}
            />
          </View>
          <View style={styles.fieldGrid}>
            <FormTextField
              error={progress.errors.cryptoValue}
              keyboardType="decimal-pad"
              label="Crypto"
              onChangeText={(value) => progress.setField("cryptoValue", value)}
              placeholder="45000"
              testID="snapshot-crypto-input"
              value={progress.formValues.cryptoValue}
            />
            <FormTextField
              error={progress.errors.cashValue}
              keyboardType="decimal-pad"
              label="Cash"
              onChangeText={(value) => progress.setField("cashValue", value)}
              placeholder="140000"
              testID="snapshot-cash-input"
              value={progress.formValues.cashValue}
            />
          </View>
          <FormTextField
            error={progress.errors.monthlyInvestment}
            keyboardType="decimal-pad"
            label="Monthly investment"
            onChangeText={(value) => progress.setField("monthlyInvestment", value)}
            placeholder="60000"
            testID="snapshot-investment-input"
            value={progress.formValues.monthlyInvestment}
          />
          <FormTextField
            label="Notes"
            multiline
            onChangeText={(value) => progress.setField("notes", value)}
            placeholder="Optional month-end note"
            testID="snapshot-notes-input"
            value={progress.formValues.notes}
          />
          <View style={styles.actions}>
            <AppButton
              onPress={onCancel}
              testID="cancel-snapshot-review-button"
              title="Cancel"
              variant="secondary"
            />
            <AppButton
              onPress={saveSnapshotChanges}
              testID="save-monthly-snapshot-button"
              title="Save snapshot changes"
            />
          </View>
        </PremiumCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  content: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  fieldGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
