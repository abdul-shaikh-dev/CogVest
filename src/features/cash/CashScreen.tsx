import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { CashEntryRow } from "@/src/components/cards";
import {
  AppButton,
  AppText,
  EmptyState,
  HeroMetric,
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
import type { CashEntryPurpose, CashEntryType } from "@/src/types";

import {
  type CashEntryFormErrors,
  isLinkedCashEntry,
  validateCashEntryForm,
} from "./cashEntryForm";
import { useCash } from "./useCash";

type CashScreenProps = {
  now?: Date;
  onCorrectEntry?: (entryId: string) => void;
  onIncomeEntryClosed?: () => void;
  onIncomeEntryOpened?: () => void;
  onIncomeRecorded?: () => void;
  openIncomeEntry?: boolean;
  store?: StoreApi<PortfolioStoreState>;
};

type CashEntryMode = CashEntryType;
type AdditionPurpose = Extract<
  CashEntryPurpose,
  "capitalContribution" | "income"
>;

const additionPurposes: { label: string; value: AdditionPurpose }[] = [
  { label: "Contribution", value: "capitalContribution" },
  { label: "Income", value: "income" },
];

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

function formatInvestmentRate(investmentRate: number | null) {
  return investmentRate === null
    ? "Unavailable"
    : `${investmentRate.toFixed(2)}%`;
}

export function CashScreen({
  now = new Date(),
  onCorrectEntry,
  onIncomeEntryClosed,
  onIncomeEntryOpened,
  onIncomeRecorded,
  openIncomeEntry = false,
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
  const [pendingPurpose, setPendingPurpose] = useState<AdditionPurpose>();
  const [additionPurpose, setAdditionPurpose] =
    useState<AdditionPurpose>("capitalContribution");
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

  useEffect(() => {
    if (!openIncomeEntry) return;
    openEntry("addition", "income");
    onIncomeEntryOpened?.();
  }, [openIncomeEntry]);

  function closeEntry() {
    if (isSavingRef.current) return;
    Keyboard.dismiss();
    setIsEntryVisible(false);
    if (mode === "addition" && additionPurpose === "income") {
      onIncomeEntryClosed?.();
    }
  }

  function requestEntryClose() {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    closeEntry();
  }

  function openEntry(
    nextMode: CashEntryMode,
    nextPurpose?: AdditionPurpose,
  ) {
    if (isSavingRef.current) return;
    const hasDraft = Boolean(amount || label || notes ||
      date !== formatLocalCalendarDate(now) || additionPurpose !== "capitalContribution");
    if (
      mode &&
      hasDraft &&
      (mode !== nextMode ||
        (nextMode === "addition" &&
          nextPurpose !== undefined &&
          additionPurpose !== nextPurpose))
    ) {
      setPendingMode(nextMode);
      setPendingPurpose(nextPurpose);
      return;
    }
    if (nextMode === "addition" && nextPurpose !== undefined) {
      setAdditionPurpose(nextPurpose);
    }
    setMode(nextMode);
    setIsEntryVisible(true);
  }

  function discardAndSwitch() {
    if (!pendingMode || isSavingRef.current) return;
    resetForm();
    setAdditionPurpose(pendingPurpose ?? "capitalContribution");
    entryIdRef.current = createId("cash");
    setMode(pendingMode);
    setPendingMode(null);
    setPendingPurpose(undefined);
    setIsEntryVisible(true);
  }

  function keepDraft() {
    if (pendingMode === "addition" && pendingPurpose === "income") {
      onIncomeEntryClosed?.();
    }
    setPendingMode(null);
    setPendingPurpose(undefined);
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
      label,
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
        label: label.trim(),
        notes,
        purpose: mode === "addition" ? additionPurpose : "withdrawal",
        type: mode,
      });
      await Promise.resolve();
      entryIdRef.current = createId("cash");
      resetForm();
      setAdditionPurpose("capitalContribution");
      Keyboard.dismiss();
      setIsEntryVisible(false);
      setMode(null);
      if (mode === "addition" && additionPurpose === "income") {
        onIncomeRecorded?.();
      }
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
        <ScreenHeader title="Cash Ledger" subtitle="Deployable capital • local only" />

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
              label: "Contributions",
              masked: maskWealthValues,
              value: formatCompactINR(monthlyMetrics.contributions),
            },
            {
              label: "Invested",
              masked: maskWealthValues,
              value: formatCompactINR(monthlyMetrics.invested),
            },
            {
              label: "Income",
              masked: maskWealthValues && monthlyMetrics.incomeStatus === "available",
              value:
                monthlyMetrics.incomeStatus === "available"
                  ? formatCompactINR(monthlyMetrics.income)
                  : "Unavailable",
            },
            {
              label: "Investment rate",
              value: formatInvestmentRate(monthlyMetrics.investmentRate),
            },
          ]}
        />
        {monthlyMetrics.incomeStatus !== "available" ? (
          <View style={styles.incomeRecovery} testID="cash-income-explanation">
            <AppText color="secondary" style={styles.incomeRecoveryCopy} variant="caption">
              {monthlyMetrics.income > 0
                ? "Review unclassified deposits to calculate the investment rate."
                : "Income is separate from contributions."}
            </AppText>
            {monthlyMetrics.income === 0 ? (
              <AppButton
                onPress={() => openEntry("addition", "income")}
                testID="cash-record-income"
                title="Record income"
                variant="ghost"
              />
            ) : null}
          </View>
        ) : null}

        {displayMode === "standard" && monthlyMetrics.invested > 0 ? (
          <View style={styles.monthlyInsight}>
            <AppText weight="bold">This month</AppText>
            <AppText color="secondary" style={styles.monthlyInsightText}>
              {monthlyMovementSummary ===
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
                  ? "Opens the route to its owning investment transaction"
                  : undefined}
                correctionHint={
                  isLinkedCashEntry(entry)
                    ? "Review through its investment transaction"
                    : onCorrectEntry ? "Tap to review or correct" : undefined
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
          {mode === "addition" ? (
            <View style={styles.purposeGroup}>
              <AppText color="secondary" variant="caption" weight="bold">
                Deposit purpose
              </AppText>
              <View style={styles.segmentedControl}>
                {additionPurposes.map((purpose) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: additionPurpose === purpose.value,
                    }}
                    key={purpose.value}
                    onPress={() => setAdditionPurpose(purpose.value)}
                    style={({ pressed }) => [
                      styles.segment,
                      additionPurpose === purpose.value && styles.segmentActive,
                      pressed && styles.pressed,
                    ]}
                    testID={`cash-purpose-${purpose.value}`}
                  >
                    <AppText
                      color={
                        additionPurpose === purpose.value
                          ? "primary"
                          : "secondary"
                      }
                      style={
                        additionPurpose === purpose.value
                          ? styles.segmentActiveText
                          : undefined
                      }
                      weight="bold"
                    >
                      {purpose.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
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
            label="Label"
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
  incomeRecovery: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    justifyContent: "space-between",
  },
  incomeRecoveryCopy: {
    flex: 1,
    minWidth: 180,
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
  purposeGroup: {
    gap: spacing.xs,
  },
  segment: {
    alignItems: "center",
    borderRadius: radii.button,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
    paddingVertical: spacing.xs,
  },
  segmentActive: {
    backgroundColor: colors.surface.elevated,
  },
  segmentActiveText: {
    color: colors.primary,
  },
  segmentedControl: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.button,
    flexDirection: "row",
    padding: spacing.xs,
  },
});
