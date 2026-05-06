import { StyleSheet, View } from "react-native";

import { AppText, MaskedValue, PremiumCard } from "@/src/components/common";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { colors, spacing } from "@/src/theme";
import type { CashEntry } from "@/src/types";

type CashEntryRowProps = {
  entry: CashEntry;
  masked?: boolean;
};

function formatCashAmount(entry: CashEntry) {
  const amount = formatINR(entry.amount);

  return entry.type === "addition" ? `+${amount}` : `-${amount}`;
}

export function CashEntryRow({ entry, masked = false }: CashEntryRowProps) {
  const isAddition = entry.type === "addition";

  return (
    <PremiumCard style={styles.row}>
      <View style={styles.details}>
        <AppText weight="bold">{entry.label}</AppText>
        <AppText color="secondary" variant="caption">
          {formatDate(entry.date)}
        </AppText>
        {entry.notes ? (
          <AppText color="secondary" variant="caption">
            {entry.notes}
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
