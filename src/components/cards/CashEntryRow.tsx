import { StyleSheet, View } from "react-native";

import { AppText } from "@/src/components/common";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { colors, radii, shadows, spacing } from "@/src/theme";
import type { CashEntry } from "@/src/types";

type CashEntryRowProps = {
  entry: CashEntry;
};

function formatCashAmount(entry: CashEntry) {
  const amount = formatINR(entry.amount);

  return entry.type === "addition" ? `+${amount}` : `-${amount}`;
}

export function CashEntryRow({ entry }: CashEntryRowProps) {
  const isAddition = entry.type === "addition";

  return (
    <View style={styles.row}>
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
      <AppText
        style={isAddition ? styles.addition : styles.withdrawal}
        weight="bold"
      >
        {formatCashAmount(entry)}
      </AppText>
    </View>
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
    ...shadows.none,
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.cardInner,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  withdrawal: {
    color: colors.loss,
  },
});
