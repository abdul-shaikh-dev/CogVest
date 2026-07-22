import { Pressable, StyleSheet, View } from "react-native";

import {
  AppText,
  MaskedValue,
  PremiumCard,
  androidRipple,
  getPressedStateStyle,
} from "@/src/components/common";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { colors, spacing } from "@/src/theme";
import type { CashEntry } from "@/src/types";

type CashEntryRowProps = {
  correctionHint?: string;
  entry: CashEntry;
  masked?: boolean;
  onPress?: () => void;
};

function formatCashAmount(entry: CashEntry) {
  const amount = formatINR(entry.amount);

  return entry.type === "addition" ? `+${amount}` : `-${amount}`;
}

function getCashEntryMovement(entry: CashEntry) {
  switch (entry.purpose) {
    case "capitalContribution":
      return "Capital added to deployable cash";
    case "income":
      return "Income added to deployable cash";
    case "purchaseFunding":
      return "Funded an investment purchase";
    case "saleProceeds":
      return "Added from asset exit";
    case "withdrawal":
      return "Withdrawn from deployable cash";
    case "legacyUncategorized":
      return entry.type === "addition"
        ? "Legacy cash addition"
        : "Legacy cash withdrawal";
  }
}

export function CashEntryRow({
  correctionHint,
  entry,
  masked = false,
  onPress,
}: CashEntryRowProps) {
  const isAddition = entry.type === "addition";
  const content = (
    <PremiumCard style={styles.row} testID={`cash-entry-row-${entry.id}`}>
      <View style={styles.details}>
        <AppText weight="bold">{entry.label}</AppText>
        <AppText color="secondary" variant="caption">
          {getCashEntryMovement(entry)}
        </AppText>
        <AppText color="secondary" variant="caption">
          {formatDate(entry.date)}
        </AppText>
        {entry.notes ? (
          <AppText color="secondary" variant="caption">
            {entry.notes}
          </AppText>
        ) : null}
        {correctionHint ? (
          <AppText color="secondary" variant="caption" weight="medium">
            {correctionHint}
          </AppText>
        ) : null}
      </View>
      <MaskedValue
        masked={masked}
        style={isAddition ? styles.addition : styles.withdrawal}
        value={formatCashAmount(entry)}
        weight="bold"
      />
    </PremiumCard>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityHint="Opens this manual cash entry for review and correction"
      accessibilityLabel={`Review ${entry.label}`}
      accessibilityRole="button"
      android_ripple={androidRipple()}
      onPress={onPress}
      style={({ pressed }) => getPressedStateStyle({ pressed })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addition: {
    color: colors.profit,
  },
  details: {
    flex: 1,
    gap: spacing.xs,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.cardInner,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  withdrawal: {
    color: colors.loss,
  },
});
