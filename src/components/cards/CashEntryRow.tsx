import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  AppText,
  MaskedValue,
  PremiumCard,
  androidRipple,
  getPressedStateStyle,
  getAdaptiveLayoutMode,
} from "@/src/components/common";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { spacing, useTheme, createThemedStyles } from "@/src/theme";
import type { CashEntry } from "@/src/types";

type CashEntryRowProps = {
  accessibilityHint?: string;
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
      return "Cash deposit";
    case "purchaseFunding":
      return "Investment purchase";
    case "saleProceeds":
      return "Sale proceeds";
    case "futuresTransfer":
      return entry.type === "withdrawal" ? "To USDT Futures" : "From USDT Futures";
    case "withdrawal":
      return "Cash withdrawal";
    case "legacyUncategorized":
      return entry.type === "addition"
        ? "Legacy cash addition"
        : "Legacy cash withdrawal";
  }
}

export function CashEntryRow({
  accessibilityHint = "Opens this cash entry for review and correction",
  correctionHint,
  entry,
  masked = false,
  onPress,
}: CashEntryRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const stacked = getAdaptiveLayoutMode(fontScale) !== "standard";
  const isAddition = entry.type === "addition";
  const content = (
    <PremiumCard section style={styles.row} testID={`cash-entry-row-${entry.id}`}>
      <View style={styles.dateRail}>
        <AppText accessibilityLabel={formatDate(entry.date)} color="secondary" variant="caption" weight="bold">
          {entry.date.slice(8, 10)}
        </AppText>
        <Ionicons name={isAddition ? "arrow-down-outline" : "arrow-up-outline"} size={18} color={colors.text.secondary} accessible={false} />
      </View>
      <View style={[styles.entryBody, stacked && styles.stackedRow]}>
        <View style={[styles.details, stacked && styles.stackedDetails]}>
          <AppText weight="bold">{entry.label}</AppText>
          <AppText color="secondary" variant="caption">
            {getCashEntryMovement(entry)}
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
        <View style={[styles.trailing, stacked && styles.stackedTrailing]}><MaskedValue
          masked={masked}
          style={isAddition ? styles.addition : styles.withdrawal}
          value={formatCashAmount(entry)}
          weight="bold"
        />
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} accessible={false} /> : null}</View>
      </View>
    </PremiumCard>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={`Review ${entry.label}. ${formatDate(entry.date)}. ${getCashEntryMovement(entry)}.`}
      accessibilityRole="button"
      android_ripple={androidRipple()}
      onPress={onPress}
      style={({ pressed }) => getPressedStateStyle({ pressed })}
    >
      {content}
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  dateRail: { alignItems: "center", width: 28, gap: spacing.xs },
  entryBody: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trailing: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stackedTrailing: { alignSelf: "flex-end" },
  stackedRow: { flexDirection: "column", alignItems: "stretch" },
  stackedDetails: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
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
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  withdrawal: {
    color: colors.loss,
  },
}));
