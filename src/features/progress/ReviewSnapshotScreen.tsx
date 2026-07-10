import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, PremiumCard, ScreenContainer, ScreenHeader, SectionHeader } from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";
import type { MonthlySnapshot } from "@/src/types";

import { useProgress } from "./useProgress";

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
  progress.setField("portfolioValue", String(snapshot.portfolioValue));
  progress.setField("investedValue", String(snapshot.investedValue));
  progress.setField("equityValue", String(snapshot.equityValue));
  progress.setField("debtValue", String(snapshot.debtValue));
  progress.setField("cryptoValue", String(snapshot.cryptoValue));
  progress.setField("cashValue", String(snapshot.cashValue));
  progress.setField("monthlyInvestment", String(snapshot.monthlyInvestment));
  progress.setField("salary", String(snapshot.salary));
  progress.setField("monthlyExpense", String(snapshot.monthlyExpense ?? ""));
  progress.setField("notes", snapshot.notes ?? "");
}

export function ReviewSnapshotScreen({
  now,
  onCancel,
  onComplete,
  store = getPortfolioStore(),
}: ReviewSnapshotScreenProps) {
  const progress = useProgress({ now, store });
  const hasRunAutomationRef = useRef(false);
  const hasPrefilledFormRef = useRef(false);

  useEffect(() => {
    if (hasRunAutomationRef.current) {
      return;
    }

    hasRunAutomationRef.current = true;
    void progress.ensureMonthEndSnapshot();
  }, [progress]);

  useEffect(() => {
    if (hasPrefilledFormRef.current) {
      return;
    }

    const snapshot =
      progress.snapshotAutomationStatus.snapshot ?? progress.latestSummary?.snapshot;

    if (!snapshot) {
      return;
    }

    setSnapshotFormFields({ progress, snapshot });
    hasPrefilledFormRef.current = true;
  }, [progress]);

  function saveSnapshotChanges() {
    if (progress.saveSnapshot()) {
      onComplete();
    }
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
          <View style={styles.fieldGrid}>
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
              error={progress.errors.salary}
              keyboardType="decimal-pad"
              label="Salary"
              onChangeText={(value) => progress.setField("salary", value)}
              placeholder="160000"
              testID="snapshot-salary-input"
              value={progress.formValues.salary}
            />
          </View>
          <FormTextField
            error={progress.errors.monthlyExpense}
            keyboardType="decimal-pad"
            label="Monthly expense"
            onChangeText={(value) => progress.setField("monthlyExpense", value)}
            placeholder="Optional"
            testID="snapshot-expense-input"
            value={progress.formValues.monthlyExpense}
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
