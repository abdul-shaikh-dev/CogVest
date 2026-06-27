import { useState } from "react";
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
import { FormTextField } from "@/src/components/forms";
import { formatCompactINR, formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { CashEntryType } from "@/src/types";

import { useCash } from "./useCash";

type CashScreenProps = {
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
};

type FieldErrors = Partial<Record<"amount" | "date" | "label", string>>;
type CashEntryMode = CashEntryType;

function validateCashEntry({
  amount,
  date,
  label,
}: {
  amount: string;
  date: string;
  label: string;
}) {
  const errors: FieldErrors = {};
  const trimmedAmount = amount.trim();
  const parsedAmount = trimmedAmount.length > 0 ? Number(trimmedAmount) : Number.NaN;

  if (!Number.isFinite(parsedAmount)) {
    errors.amount = "Amount must be a valid number.";
  } else if (parsedAmount <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  if (label.trim().length === 0) {
    errors.label = "Label is required.";
  }

  if (date.trim().length === 0) {
    errors.date = "Date is required.";
  } else if (Number.isNaN(new Date(date).getTime())) {
    errors.date = "Date must be valid.";
  }

  return {
    errors,
    parsedAmount,
  };
}

function getCashEntryModeLabel(mode: CashEntryMode) {
  return mode === "addition" ? "Deposit" : "Withdraw";
}

function getCashEntryPlaceholder(mode: CashEntryMode) {
  return mode === "addition" ? "Broker cash" : "Withdrawal";
}

function formatSavingsRate(savingsRate: number | null) {
  return savingsRate === null ? "Not enough data" : `${savingsRate.toFixed(2)}%`;
}

export function CashScreen({
  now,
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
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function resetForm() {
    setAmount("");
    setLabel("");
    setDate("");
    setNotes("");
    setErrors({});
  }

  function submit() {
    const result = validateCashEntry({
      amount,
      date,
      label,
    });

    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }

    addEntry({
      amount: result.parsedAmount,
      date: date.trim(),
      label: label.trim(),
      notes,
      type: mode,
    });
    resetForm();
  }

  return (
    <ScreenContainer scroll testID="cash-screen">
      <View style={styles.content}>
        <ScreenHeader title="Cash Ledger" subtitle="Deployable capital • local only" />

        <HeroMetric
          label="Deployable cash"
          masked={maskWealthValues}
          value={formatINR(balance)}
          subValue={`Balance ${formatCompactINR(balance)}`}
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
              label: "Kept",
              masked: maskWealthValues,
              value: formatCompactINR(
                Math.max(0, monthlyMetrics.added - monthlyMetrics.invested),
              ),
            },
            {
              label: "Savings",
              value: formatSavingsRate(monthlyMetrics.savingsRate),
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

        <PremiumCard style={styles.movementCard}>
          <SectionHeader title="This month" />
          <AppText color="secondary">{monthlyMovementSummary}</AppText>
        </PremiumCard>

        <View style={styles.segmentedControl}>
          {manualEntryModes.map((entryMode) => (
            <Pressable
              accessibilityRole="button"
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
                color={mode === entryMode ? "inverse" : "secondary"}
                weight="bold"
              >
                {getCashEntryModeLabel(entryMode)}
              </AppText>
            </Pressable>
          ))}
        </View>

        <PremiumCard>
          <SectionHeader title="Add cash entry" />
          <FormTextField
            error={errors.amount}
            keyboardType="decimal-pad"
            label="Amount"
            onChangeText={setAmount}
            placeholder="1000"
            testID="cash-amount-input"
            value={amount}
          />
          <FormTextField
            error={errors.label}
            label="Label"
            onChangeText={setLabel}
            placeholder={getCashEntryPlaceholder(mode)}
            testID="cash-label-input"
            value={label}
          />
          <FormTextField
            error={errors.date}
            label="Date"
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            testID="cash-date-input"
            value={date}
          />
          <FormTextField
            label="Notes"
            multiline
            onChangeText={setNotes}
            placeholder="Optional note"
            value={notes}
          />
          <AppButton
            title="Save Cash Entry"
            testID="save-cash-entry-button"
            onPress={submit}
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
                entry={entry}
                key={entry.id}
                masked={maskWealthValues}
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
  history: {
    gap: spacing.cardGap,
  },
  movementCard: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  segment: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    paddingVertical: spacing.cardInner,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentedControl: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.pill,
    flexDirection: "row",
    padding: spacing.xs,
  },
});
