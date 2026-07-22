import { useRef, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { getCalendarDatePart } from "@/src/domain/dates";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { CashEntry, CashEntryType } from "@/src/types";

import {
  type CashEntryFormErrors,
  type ManualCashPurpose,
  isLinkedCashEntry,
  validateCashEntryForm,
} from "./cashEntryForm";

type ReviewCashEntryScreenProps = {
  entryId: string;
  now?: Date;
  onCancel: () => void;
  onComplete: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

const standardManualPurposes: { label: string; value: ManualCashPurpose }[] = [
  { label: "Contribution", value: "capitalContribution" },
  { label: "Income", value: "income" },
];

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function getInitialPurpose(entry?: CashEntry): ManualCashPurpose {
  if (
    entry?.purpose === "income" ||
    entry?.purpose === "legacyUncategorized"
  ) {
    return entry.purpose;
  }

  return "capitalContribution";
}

function getSaveFailureMessage(reason?: string) {
  if (reason === "linkedEntry") {
    return "This movement is managed with its investment transaction and cannot be changed here.";
  }

  if (reason === "notFound") {
    return "This cash entry is no longer available.";
  }

  return "This cash entry could not be saved safely. Review it and try again.";
}

export function ReviewCashEntryScreen({
  entryId,
  now = new Date(),
  onCancel,
  onComplete,
  store = getPortfolioStore(),
}: ReviewCashEntryScreenProps) {
  const snapshot = usePortfolioSnapshot(store);
  const entry = snapshot.cashEntries.find((item) => item.id === entryId);
  const initialEntryRef = useRef(entry);
  const initialEntry = initialEntryRef.current;
  const [amount, setAmount] = useState(() =>
    initialEntry ? String(initialEntry.amount) : "",
  );
  const [date, setDate] = useState(
    () => getCalendarDatePart(initialEntry?.date ?? "") ?? "",
  );
  const [label, setLabel] = useState(() => initialEntry?.label ?? "");
  const [notes, setNotes] = useState(() => initialEntry?.notes ?? "");
  const [purpose, setPurpose] = useState<ManualCashPurpose>(() =>
    getInitialPurpose(initialEntry),
  );
  const [type, setType] = useState<CashEntryType>(
    () => initialEntry?.type ?? "addition",
  );
  const [errors, setErrors] = useState<CashEntryFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const actionInFlightRef = useRef(false);

  if (!entry) {
    return (
      <ScreenContainer testID="review-cash-entry-screen">
        <EmptyState
          actionLabel="Back to Cash Ledger"
          message="It may have already been removed or corrected on another screen."
          title="Cash entry unavailable"
          onAction={onCancel}
        />
      </ScreenContainer>
    );
  }

  if (isLinkedCashEntry(entry)) {
    return (
      <ScreenContainer testID="review-cash-entry-screen">
        <View style={styles.content}>
          <ScreenHeader
            title="Review Cash Entry"
            subtitle="Linked investment movement"
          />
          <PremiumCard>
            <SectionHeader title={entry.label} />
            <AppText color="secondary">
              This movement is managed with its investment transaction. Correct
              the owning purchase or sale so the asset and cash records stay in
              sync.
            </AppText>
          </PremiumCard>
          <AppButton
            title="Back to Cash Ledger"
            variant="secondary"
            onPress={onCancel}
          />
        </View>
      </ScreenContainer>
    );
  }

  const manualEntry = entry;
  const manualPurposes =
    initialEntry?.purpose === "legacyUncategorized"
      ? [
          ...standardManualPurposes,
          { label: "Uncategorized", value: "legacyUncategorized" as const },
        ]
      : standardManualPurposes;

  async function save() {
    if (actionInFlightRef.current) {
      return;
    }

    const validation = validateCashEntryForm({ amount, date, label, now });

    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors);
      return;
    }

    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;

    try {
      const result = store.getState().correctManualCashEntry({
        ...manualEntry,
        amount: validation.parsedAmount,
        date,
        label: label.trim(),
        linkedTradeId: undefined,
        notes: notes.trim() || undefined,
        purpose: type === "withdrawal" ? "withdrawal" : purpose,
        type,
      });

      if (result.status === "rejected") {
        setErrors({ save: getSaveFailureMessage(result.reason) });
        return;
      }

      await Promise.resolve();
      completed = true;
      onComplete();
    } catch {
      setErrors({ save: getSaveFailureMessage() });
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  async function deleteEntry() {
    if (actionInFlightRef.current) {
      return;
    }

    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;

    try {
      const result = store.getState().deleteManualCashEntry(manualEntry.id);

      if (result.status === "rejected") {
        setErrors({ save: getSaveFailureMessage(result.reason) });
        return;
      }

      await Promise.resolve();
      completed = true;
      onComplete();
    } catch {
      setErrors({
        save: "This cash entry could not be deleted safely. Try again.",
      });
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  return (
    <ScreenContainer scroll testID="review-cash-entry-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Review Cash Entry"
          subtitle="Correct a manual ledger record"
        />

        <PremiumCard>
          <SectionHeader title="Entry details" />
          <View style={styles.segmentedControl}>
            {(["addition", "withdrawal"] as CashEntryType[]).map((entryType) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: type === entryType }}
                key={entryType}
                onPress={() => {
                  setType(entryType);
                  setErrors({});
                }}
                style={({ pressed }) => [
                  styles.segment,
                  type === entryType && styles.segmentActive,
                  pressed && styles.pressed,
                ]}
                testID={`cash-correction-type-${entryType}`}
              >
                <AppText
                  color={type === entryType ? "primary" : "secondary"}
                  style={
                    type === entryType ? styles.segmentActiveText : undefined
                  }
                  weight="bold"
                >
                  {entryType === "addition" ? "Deposit" : "Withdraw"}
                </AppText>
              </Pressable>
            ))}
          </View>

          {type === "addition" ? (
            <View style={styles.purposeGroup}>
              <AppText color="secondary" variant="caption" weight="bold">
                Deposit purpose
              </AppText>
              <View style={styles.purposeOptions}>
                {manualPurposes.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: purpose === item.value }}
                    key={item.value}
                    onPress={() => setPurpose(item.value)}
                    style={({ pressed }) => [
                      styles.purposeOption,
                      purpose === item.value && styles.segmentActive,
                      pressed && styles.pressed,
                    ]}
                    testID={`cash-correction-purpose-${item.value}`}
                  >
                    <AppText
                      color={purpose === item.value ? "primary" : "secondary"}
                      style={
                        purpose === item.value
                          ? styles.segmentActiveText
                          : undefined
                      }
                      variant="caption"
                      weight="bold"
                    >
                      {item.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              {purpose === "legacyUncategorized" ? (
                <AppText color="secondary" variant="caption">
                  Choose a specific purpose when possible. Uncategorized
                  deposits keep investment-rate insights unavailable.
                </AppText>
              ) : null}
            </View>
          ) : null}

          <FormTextField
            error={errors.amount}
            keyboardType="decimal-pad"
            label="Amount"
            onChangeText={setAmount}
            testID="cash-correction-amount-input"
            value={amount}
          />
          <DatePickerField
            error={errors.date}
            label="Date"
            maximumDate={now}
            onChange={setDate}
            testID="cash-correction-date-input"
            value={date}
          />
          <FormTextField
            error={errors.label}
            label="Label"
            onChangeText={setLabel}
            testID="cash-correction-label-input"
            value={label}
          />
          <FormTextField
            label="Notes"
            multiline
            onChangeText={setNotes}
            testID="cash-correction-notes-input"
            value={notes}
          />
          {errors.save ? (
            <AppText
              accessibilityLiveRegion="polite"
              selectable
              style={styles.errorText}
              variant="caption"
            >
              {errors.save}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <AppButton
              disabled={isSaving}
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
            />
            <AppButton
              accessibilityState={{ busy: isSaving, disabled: isSaving }}
              disabled={isSaving}
              title={isSaving ? "Saving..." : "Save changes"}
              testID="save-cash-correction-button"
              onPress={save}
            />
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Remove entry" />
          <AppText color="secondary" variant="caption">
            Removing this record recalculates your cash balance and monthly
            metrics immediately.
          </AppText>
          {isConfirmingDelete ? (
            <View style={styles.deleteConfirmation}>
              <AppText weight="bold">Delete this cash entry?</AppText>
              <AppText color="secondary" variant="caption">
                This cannot be undone.
              </AppText>
              <View style={styles.actions}>
                <AppButton
                  disabled={isSaving}
                  title="Keep entry"
                  variant="secondary"
                  onPress={() => setIsConfirmingDelete(false)}
                />
                <AppButton
                  accessibilityState={{ busy: isSaving, disabled: isSaving }}
                  disabled={isSaving}
                  title={isSaving ? "Deleting..." : "Delete entry"}
                  variant="destructive"
                  testID="confirm-delete-cash-entry-button"
                  onPress={deleteEntry}
                />
              </View>
            </View>
          ) : (
            <AppButton
              title="Delete cash entry"
              variant="ghost"
              testID="delete-cash-entry-button"
              onPress={() => setIsConfirmingDelete(true)}
            />
          )}
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
  deleteConfirmation: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.loss,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  purposeGroup: {
    gap: spacing.xs,
  },
  purposeOption: {
    alignItems: "center",
    borderRadius: radii.button,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  purposeOptions: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    flexDirection: "row",
    padding: spacing.xs,
  },
  segment: {
    alignItems: "center",
    borderRadius: radii.button,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
  },
  segmentActive: {
    backgroundColor: colors.surface.card,
  },
  segmentActiveText: {
    color: colors.primary,
  },
  segmentedControl: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    flexDirection: "row",
    padding: spacing.xs,
  },
});
