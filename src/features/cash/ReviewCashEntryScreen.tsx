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
  SensitiveValueReveal,
  SectionHeader,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { getCalendarDatePart } from "@/src/domain/dates";
import { formatDate } from "@/src/domain/formatters";
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
  onReviewLinkedTrade?: (tradeId: string) => void;
  onReviewLinkedFutures?: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

const standardManualPurposes: { label: string; value: ManualCashPurpose }[] = [
  { label: "Contribution", value: "capitalContribution" },
];

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function getInitialPurpose(entry?: CashEntry): ManualCashPurpose {
  if (
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
  onReviewLinkedTrade,
  onReviewLinkedFutures,
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
  const [isNoteExpanded, setIsNoteExpanded] = useState(() => Boolean(initialEntry?.notes));
  const [purpose, setPurpose] = useState<ManualCashPurpose>(() =>
    getInitialPurpose(initialEntry),
  );
  const [type, setType] = useState<CashEntryType>(
    () => initialEntry?.type ?? "addition",
  );
  const [errors, setErrors] = useState<CashEntryFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { isRevealed, reveal } = useSensitiveValueReveal(
    snapshot.preferences.maskWealthValues,
  );
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
    if (entry.linkedFutures) {
      const account = snapshot.futuresAccounts.find((item) => item.id === entry.linkedFutures?.accountId);
      const transfer = account?.events.find((item) => item.id === entry.linkedFutures?.eventId);
      return <ScreenContainer testID="review-cash-entry-screen"><View style={styles.content}>
        <ScreenHeader title="Review Cash Entry" subtitle="Linked Futures movement" />
        <PremiumCard>
          <SectionHeader title={entry.label} />
          <AppText color="secondary">{transfer ? "This Cash movement is managed with its USDT Futures wallet transfer. Correct or remove it in Futures so both records stay in sync." : "The linked Futures transfer is unavailable. Restore a complete backup before changing this Cash movement."}</AppText>
          <AppText color="secondary" variant="caption">{formatDate(entry.date)}</AppText>
        </PremiumCard>
        {transfer && onReviewLinkedFutures ? <AppButton title="Review Futures wallet" onPress={onReviewLinkedFutures} testID="review-linked-cash-futures" /> : null}
        <AppButton title="Back to Cash Ledger" variant="secondary" onPress={onCancel} />
      </View></ScreenContainer>;
    }
    const linkedTradeCandidate = snapshot.trades.find((trade) => trade.id === entry.linkedTradeId);
    const linkedTrade = linkedTradeCandidate && (linkedTradeCandidate.type === "buy" || linkedTradeCandidate.type === "sell")
      ? linkedTradeCandidate
      : undefined;
    const linkedAsset = linkedTrade
      ? snapshot.assets.find((asset) => asset.id === linkedTrade.assetId)
      : undefined;

    return (
      <ScreenContainer testID="review-cash-entry-screen">
        <View style={styles.content}>
          <ScreenHeader
            title="Review Cash Entry"
            subtitle="Linked investment movement"
          />
          <PremiumCard>
            <SectionHeader title={linkedTrade ? entry.label : "Linked transaction unavailable"} />
            {linkedTrade ? <>
              <AppText color="secondary">
                Review the linked {linkedTrade.type === "buy" ? "purchase" : "sale"} to
                update the investment and Cash records together.
              </AppText>
              <AppText color="secondary" variant="caption" testID="linked-cash-owner-summary">
                {linkedAsset?.name ?? "Unknown holding"} · {linkedTrade.type === "buy" ? "Purchase" : "Sale"} · {formatDate(linkedTrade.date)}
              </AppText>
            </> : <>
              <AppText color="secondary" testID="linked-cash-owner-missing">
                The linked transaction is missing. You cannot edit this cash movement separately from its investment record.
              </AppText>
              <AppText color="secondary" variant="caption">
                Return to the Cash Ledger. Restore a backup or reimport the complete source history if this link should exist.
              </AppText>
            </>}
          </PremiumCard>
          {linkedTrade && onReviewLinkedTrade ? <AppButton
            onPress={() => onReviewLinkedTrade(linkedTrade.id)}
            testID="review-linked-cash-transaction"
            title="Review linked transaction"
          /> : null}
          <AppButton
            title="Back to Cash Ledger"
            variant="secondary"
            onPress={onCancel}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (!isRevealed) {
    return (
      <ScreenContainer testID="review-cash-entry-screen">
        <View style={styles.content}>
          <ScreenHeader
            title="Review Cash Entry"
            subtitle={`${entry.label} · values masked`}
          />
          <PremiumCard>
            <SensitiveValueReveal
              onReveal={reveal}
              testID="reveal-cash-entry"
            />
          </PremiumCard>
          <AppButton
            onPress={onCancel}
            title="Back to Cash Ledger"
            variant="secondary"
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
          subtitle={entry.label}
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

          {type === "addition" && initialEntry?.purpose === "legacyUncategorized" ? (
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
                  Confirm whether this was money added for investing. Uncategorized
                  deposits keep monthly performance unavailable.
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
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isNoteExpanded }}
            onPress={() => setIsNoteExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.noteToggle, pressed && styles.pressed]}
            testID="cash-correction-note-toggle"
          >
            <AppText color="secondary" weight="medium">
              {isNoteExpanded ? "Hide note" : notes ? "Show note" : "Add note"}
            </AppText>
          </Pressable>
          {isNoteExpanded ? (
            <FormTextField
              label="Notes"
              multiline
              onChangeText={setNotes}
              testID="cash-correction-notes-input"
              value={notes}
            />
          ) : null}
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
              accessibilityState={{ busy: isSaving, disabled: isSaving }}
              disabled={isSaving}
              title={isSaving ? "Saving..." : "Save changes"}
              testID="save-cash-correction-button"
              onPress={save}
            />
            <AppButton
              disabled={isSaving}
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
            />
          </View>
        </PremiumCard>

        <View style={styles.removalSection}>
          {isConfirmingDelete ? (
            <PremiumCard>
              <SectionHeader title="Delete this cash entry?" />
              <AppText color="secondary" variant="caption">
                Removing this record recalculates your cash balance and monthly
                metrics immediately.
              </AppText>
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
            </PremiumCard>
          ) : (
            <AppButton
              title="Delete cash entry"
              variant="ghost"
              testID="delete-cash-entry-button"
              onPress={() => setIsConfirmingDelete(true)}
            />
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  content: {
    gap: spacing.cardGap,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  removalSection: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  noteToggle: {
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
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
