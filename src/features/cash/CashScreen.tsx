import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { CashEntryRow } from "@/src/components/cards";
import {
  AppButton,
  AppText,
  EmptyState,
  MaskedValue,
  ScreenContainer,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { CashEntryType } from "@/src/types";

import { useCash } from "./useCash";

type CashScreenProps = {
  store?: StoreApi<PortfolioStoreState>;
};

type FieldErrors = Partial<Record<"amount" | "date" | "label", string>>;

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

export function CashScreen({ store = getPortfolioStore() }: CashScreenProps) {
  const { addEntry, balance, entries, maskWealthValues } = useCash({ store });
  const [type, setType] = useState<CashEntryType>("addition");
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
      type,
    });
    resetForm();
  }

  return (
    <ScreenContainer scroll testID="cash-screen">
      <View style={styles.content}>
        <View style={styles.heroCard}>
          <AppText color="secondary">Cash balance</AppText>
          <MaskedValue
            masked={maskWealthValues}
            selectable
            value={formatINR(balance)}
            variant="hero"
            weight="bold"
          />
        </View>

        <View style={styles.segmentedControl}>
          {(["addition", "withdrawal"] as const).map((entryType) => (
            <Pressable
              accessibilityRole="button"
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
            >
              <AppText
                color={type === entryType ? "inverse" : "secondary"}
                weight="bold"
              >
                {entryType === "addition" ? "Add Cash" : "Withdraw"}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <AppText variant="body" weight="bold">
            Cash entry
          </AppText>
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
            placeholder={type === "addition" ? "Broker cash" : "Withdrawal"}
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
        </View>

        {entries.length === 0 ? (
          <EmptyState
            message="Add available broker or bank cash to include it in portfolio value."
            title="No cash entries yet"
          />
        ) : (
          <View style={styles.history}>
            <AppText variant="title" weight="bold">
              Cash history
            </AppText>
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
  card: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.cardInner,
    padding: spacing.md,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.surface.elevated,
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.cardInner,
    padding: spacing.md,
  },
  history: {
    gap: spacing.cardGap,
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
    borderColor: colors.border.subtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    padding: spacing.xs,
  },
});
