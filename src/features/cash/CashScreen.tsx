import { useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { CashEntryRow } from "@/src/components/cards";
import {
  AppButton,
  AppText,
  EmptyState,
  HeroMetric,
  MASKED_INR_VALUE,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { formatLocalCalendarDate, formatMonthYear } from "@/src/domain/dates";
import { formatCompactINR, formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { createId } from "@/src/utils";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { CashEntryType } from "@/src/types";

import {
  type CashEntryFormErrors,
  isLinkedCashEntry,
  validateCashEntryForm,
} from "./cashEntryForm";
import { useCash } from "./useCash";

type CashScreenProps = {
  now?: Date;
  onCorrectEntry?: (entryId: string) => void;
  store?: StoreApi<PortfolioStoreState>;
};

type CashEntryMode = CashEntryType;
function getCashEntryModeLabel(mode: CashEntryMode) {
  return mode === "addition" ? "Deposit" : "Withdraw";
}

function getCashEntryPlaceholder(mode: CashEntryMode) {
  return mode === "addition" ? "Broker cash" : "Withdrawal";
}

function getCashEntryModeCopy(mode: CashEntryMode) {
  return mode === "addition"
    ? {
        balanceImpact: "Adds balance",
        description: "Add money that is available for future investment.",
        saveLabel: "Save deposit",
        title: "Deposit cash",
      }
    : {
        balanceImpact: "Reduces balance",
        description: "Record money leaving the portfolio cash pool.",
        saveLabel: "Save withdrawal",
        title: "Withdraw cash",
      };
}

export function CashScreen({
  now = new Date(),
  onCorrectEntry,
  store = getPortfolioStore(),
}: CashScreenProps) {
  const {
    addEntry,
    balance,
    displayMode,
    entries,
    manualEntryModes,
    maskWealthValues,
    monthlyMetrics,
    monthlyMovementSummary,
  } = useCash({ now, store });
  const [mode, setMode] = useState<CashEntryMode | null>(null);
  const [isEntryVisible, setIsEntryVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<CashEntryMode | null>(null);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(() => formatLocalCalendarDate(now));
  const [notes, setNotes] = useState("");
  const [areNotesExpanded, setAreNotesExpanded] = useState(false);
  const [errors, setErrors] = useState<CashEntryFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const entryIdRef = useRef(createId("cash"));
  const modeCopy = mode ? getCashEntryModeCopy(mode) : null;

  function closeEntry() {
    if (isSavingRef.current) return;
    Keyboard.dismiss();
    setIsEntryVisible(false);
  }

  function requestEntryClose() {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    closeEntry();
  }

  function openEntry(nextMode: CashEntryMode) {
    if (isSavingRef.current) return;
    const hasDraft = Boolean(amount || label || notes ||
      date !== formatLocalCalendarDate(now));
    if (
      mode &&
      hasDraft &&
      mode !== nextMode
    ) {
      setPendingMode(nextMode);
      return;
    }
    setMode(nextMode);
    setIsEntryVisible(true);
  }

  function discardAndSwitch() {
    if (!pendingMode || isSavingRef.current) return;
    resetForm();
    entryIdRef.current = createId("cash");
    setMode(pendingMode);
    setPendingMode(null);
    setIsEntryVisible(true);
  }

  function keepDraft() {
    setPendingMode(null);
  }

  function resetForm() {
    setAmount("");
    setLabel("");
    setDate(formatLocalCalendarDate(now));
    setNotes("");
    setAreNotesExpanded(false);
    setErrors({});
  }

  async function submit() {
    if (isSavingRef.current || !mode) {
      return;
    }

    const result = validateCashEntryForm({
      amount,
      date,
      label: label.trim() || (mode === "addition" ? "Cash added" : "Cash withdrawn"),
      now,
    });

    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      addEntry({
        amount: result.parsedAmount,
        date: date.trim(),
        id: entryIdRef.current,
        label: label.trim() || (mode === "addition" ? "Cash added" : "Cash withdrawn"),
        notes,
        purpose: mode === "addition" ? "capitalContribution" : "withdrawal",
        type: mode,
      });
      await Promise.resolve();
      entryIdRef.current = createId("cash");
      resetForm();
      Keyboard.dismiss();
      setIsEntryVisible(false);
      setMode(null);
    } catch {
      setErrors({
        save: "This cash entry could not be saved safely. Review it and try again.",
      });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <>
    <ScreenContainer scroll testID="cash-screen">
      <View style={styles.content}>
        <ScreenHeader title="Cash Ledger" />

        <HeroMetric
          label="Deployable cash"
          masked={maskWealthValues}
          value={formatINR(balance)}
          subValue="Included in portfolio"
          subValueTone="secondary"
        />

        <View style={styles.entryActions}>
          {manualEntryModes.map((entryMode) => (
            <AppButton
              accessibilityHint={`Opens the ${getCashEntryModeLabel(entryMode).toLowerCase()} form`}
              key={entryMode}
              onPress={() => openEntry(entryMode)}
              style={styles.entryAction}
              testID={`cash-entry-${entryMode === "addition" ? "deposit" : "withdraw"}`}
              title={getCashEntryModeLabel(entryMode)}
              variant="secondary"
            />
          ))}
        </View>

        <SectionHeader title={`${formatMonthYear(now)} activity`} />
        <MetricGroup
          metrics={[
            {
              label: "Cash added",
              masked: maskWealthValues,
              value: formatCompactINR(monthlyMetrics.added),
            },
            {
              label: "Invested",
              masked: maskWealthValues,
              value: formatCompactINR(monthlyMetrics.invested),
            },
          ]}
        />

        {displayMode === "standard" && monthlyMetrics.invested > 0 ? (
          <View style={styles.monthlyInsight}>
            <AppText weight="bold">This month</AppText>
            <AppText color="secondary" style={styles.monthlyInsightText}>
              {maskWealthValues
                ? `${MASKED_INR_VALUE} moved into investments this month`
                : monthlyMovementSummary ===
                  "No investment cash movement this month"
                ? "No movement yet"
                : monthlyMovementSummary}
            </AppText>
          </View>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState
            message="Add broker or bank cash only when it should count toward portfolio value."
            title="No cash movement yet"
          />
        ) : (
          <View style={styles.history}>
            <SectionHeader title="Recent cash ledger" />
            {entries.map((entry) => (
              <CashEntryRow
                accessibilityHint={isLinkedCashEntry(entry)
                  ? "Opens its linked movement for review"
                  : undefined}
                correctionHint={
                  isLinkedCashEntry(entry)
                    ? entry.linkedFutures ? "Correct in Futures" : "Review through its investment transaction"
                    : undefined
                }
                entry={entry}
                key={entry.id}
                masked={maskWealthValues}
                onPress={onCorrectEntry ? () => onCorrectEntry(entry.id) : undefined}
              />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>

    <Modal animationType="none" visible={isEntryVisible} onRequestClose={requestEntryClose} testID="cash-entry-modal">
      <KeyboardAvoidingView behavior="height" style={styles.modalRoot}>
        <ScreenContainer scroll testID="cash-entry-panel">
        {mode && modeCopy ? (
          <View style={styles.content} testID="cash-entry-form" accessibilityViewIsModal>
          <AppButton
            disabled={isSaving}
            onPress={closeEntry}
            testID="close-cash-entry-button"
            title="Cancel"
            variant="ghost"
          />
          <View style={styles.entryHeader}>
            <View style={styles.entryHeaderCopy}>
              <AppText variant="title" weight="bold">{modeCopy.title}</AppText>
              <AppText color="secondary" variant="caption">
                {modeCopy.description}
              </AppText>
            </View>
            <View style={styles.balancePill}>
              <AppText
                color="secondary"
                variant="caption"
                weight="bold"
              >
                {modeCopy.balanceImpact}
              </AppText>
            </View>
          </View>
          <View style={styles.formFields}>
            <View style={styles.formRowField}>
              <FormTextField
                error={errors.amount}
                keyboardType="decimal-pad"
                label="Amount"
                onChangeText={setAmount}
                placeholder="1000"
                testID="cash-amount-input"
                value={amount}
              />
            </View>
            <View style={styles.formRowField}>
              <DatePickerField
                error={errors.date}
                label="Date"
                maximumDate={now}
                onChange={setDate}
                testID="cash-date-input"
                value={date}
              />
            </View>
          </View>
          <FormTextField
            error={errors.label}
            label="Label (optional)"
            onChangeText={setLabel}
            placeholder={getCashEntryPlaceholder(mode)}
            testID="cash-label-input"
            value={label}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: areNotesExpanded }}
            onPress={() => setAreNotesExpanded((expanded) => !expanded)}
            style={({ pressed }) => [
              styles.optionalToggle,
              pressed && styles.pressed,
            ]}
            testID="cash-notes-toggle"
          >
            <AppText color="secondary" variant="caption" weight="bold">
              {areNotesExpanded ? "Hide note" : notes ? "Show note" : "Add note"}
            </AppText>
          </Pressable>
          {areNotesExpanded ? (
            <FormTextField
              label="Note (optional)"
              multiline
              onChangeText={setNotes}
              placeholder="Why this cash moved"
              testID="cash-notes-input"
              value={notes}
            />
          ) : null}
          <AppButton
            accessibilityState={{ busy: isSaving, disabled: isSaving }}
            disabled={isSaving}
            title={isSaving ? "Saving..." : modeCopy.saveLabel}
            testID="save-cash-entry-button"
            onPress={submit}
          />
          {errors.save ? (
            <AppText selectable style={styles.errorText} variant="caption">
              {errors.save}
            </AppText>
          ) : null}
          <AppText color="secondary" variant="caption">
            Draft stays here if you cancel. Nothing is recorded until you save.
          </AppText>
          </View>
        ) : null}
        </ScreenContainer>
      </KeyboardAvoidingView>
    </Modal>
    <Modal
      animationType="none"
      onRequestClose={keepDraft}
      transparent
      visible={pendingMode !== null}
    >
      <View style={styles.confirmBackdrop}>
        <PremiumCard>
          <AppText variant="title" weight="bold">Discard this draft?</AppText>
          <AppText color="secondary">Start a new {pendingMode === "addition" ? "deposit" : "withdrawal"} instead? Your unsaved {mode === "addition" ? "deposit" : "withdrawal"} will be removed.</AppText>
          <AppButton
            onPress={keepDraft}
            testID="cash-keep-draft-button"
            title="Keep draft"
            variant="secondary"
          />
          <AppButton onPress={discardAndSwitch} title="Discard and continue" testID="cash-discard-draft-button" variant="destructive" />
        </PremiumCard>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: colors.background },
  confirmBackdrop: { flex: 1, justifyContent: "center", padding: spacing.screenHorizontal, backgroundColor: "rgba(0,0,0,0.7)" },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  balancePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  entryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  entryHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  entryAction: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  entryActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  errorText: {
    color: colors.loss,
  },
  formFields: {
    gap: spacing.sm,
  },
  formRowField: {
    flex: 1,
  },
  history: {
    gap: spacing.cardGap,
  },
  monthlyInsight: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing.cardInner,
    paddingVertical: spacing.xs,
  },
  monthlyInsightText: {
    flex: 1,
    textAlign: "right",
  },
  optionalToggle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
});
