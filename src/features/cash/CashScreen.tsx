import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { CashEntryRow } from "@/src/components/cards";
import {
  AppButton,
  AppText,
  EmptyState,
  HeroMetric,
  MetricGroup,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
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
    ? "Not enough data"
    : `${investmentRate.toFixed(2)}%`;
}

export function CashScreen({
  now = new Date(),
  onCorrectEntry,
  store = getPortfolioStore(),
}: CashScreenProps) {
  const {
    addEntry,
    balance,
    entries,
    manualEntryModes,
    maskWealthValues,
    monthlyMetrics,
    monthlyMovementSummary,
  } = useCash({ now, store });
  const [mode, setMode] = useState<CashEntryMode>("addition");
  const [additionPurpose, setAdditionPurpose] =
    useState<AdditionPurpose>("capitalContribution");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(() => formatLocalCalendarDate(now));
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<CashEntryFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const entryIdRef = useRef(createId("cash"));
  const modeCopy = getCashEntryModeCopy(mode);

  function resetForm() {
    setAmount("");
    setLabel("");
    setDate(formatLocalCalendarDate(now));
    setNotes("");
    setErrors({});
  }

  async function submit() {
    if (isSavingRef.current) {
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

        <MetricGroup
          metrics={[
            {
              label: "Added",
              masked: maskWealthValues,
              value: formatCompactINR(monthlyMetrics.added),
            },
            {
              label: "Invested",
              masked: maskWealthValues,
              value: formatCompactINR(monthlyMetrics.invested),
            },
            {
              label: "Income",
              masked: maskWealthValues,
              value:
                monthlyMetrics.incomeStatus === "available"
                  ? formatCompactINR(monthlyMetrics.income)
                  : "Not enough data",
            },
            {
              label: "Investment rate",
              value: formatInvestmentRate(monthlyMetrics.investmentRate),
            },
          ]}
        />

        {maskWealthValues ? (
          <PremiumCard>
            <SectionHeader title="Masked preview" />
            <MaskedValue masked value={formatINR(balance)} />
            <AppText color="secondary" variant="caption">
              Value masking hides cash values using the same preview pattern as
              portfolio totals.
            </AppText>
          </PremiumCard>
        ) : null}

        <View style={styles.monthlyInsight}>
          <AppText weight="bold">This month</AppText>
          <AppText color="secondary" style={styles.monthlyInsightText}>
            {monthlyMovementSummary === "No investment cash movement this month"
              ? "No movement yet"
              : monthlyMovementSummary}
          </AppText>
        </View>

        <View style={styles.segmentedControl}>
          {manualEntryModes.map((entryMode) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === entryMode }}
              key={entryMode}
              onPress={() => {
                setMode(entryMode);
                setErrors({});
              }}
              style={({ pressed }) => [
                styles.segment,
                mode === entryMode && styles.segmentActive,
                pressed && styles.pressed,
              ]}
            >
              <AppText
                color={mode === entryMode ? "primary" : "secondary"}
                style={mode === entryMode && styles.segmentActiveText}
                weight="bold"
              >
                {getCashEntryModeLabel(entryMode)}
              </AppText>
            </Pressable>
          ))}
        </View>

        <PremiumCard>
          <View style={styles.entryHeader}>
            <View style={styles.entryHeaderCopy}>
              <SectionHeader title={modeCopy.title} />
              <AppText color="secondary" variant="caption">
                {modeCopy.description}
              </AppText>
            </View>
            <View style={styles.balancePill}>
              <AppText
                style={styles.balancePillText}
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
          <View style={styles.formRow}>
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
          <FormTextField
            label="Notes"
            multiline
            onChangeText={setNotes}
            placeholder="Optional note"
            value={notes}
          />
        </PremiumCard>

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
                correctionHint={
                  isLinkedCashEntry(entry)
                    ? "Managed with its investment transaction"
                    : onCorrectEntry
                      ? "Tap to review or correct"
                      : undefined
                }
                entry={entry}
                key={entry.id}
                masked={maskWealthValues}
                onPress={
                  !isLinkedCashEntry(entry) && onCorrectEntry
                    ? () => onCorrectEntry(entry.id)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  balancePillText: {
    color: colors.profit,
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
  errorText: {
    color: colors.loss,
  },
  formRow: {
    flexDirection: "row",
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
    minHeight: 38,
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
