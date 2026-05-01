import { StyleSheet, View } from "react-native";

import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import { colors, radii, shadows, spacing } from "@/src/theme";
import type { Holding } from "@/src/types";

import { AppText, MaskedValue } from "../common";

type HoldingCardProps = {
  holding: Holding;
  masked?: boolean;
};

function formatQuantity(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(4);
}

function formatPnLAmount(holding: Holding) {
  const amount = formatINR(holding.unrealisedPnL);

  return `${holding.unrealisedPnL > 0 ? "+" : ""}${amount}`;
}

export function HoldingCard({ holding, masked = false }: HoldingCardProps) {
  const isProfit = holding.unrealisedPnL >= 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <AppText variant="title" weight="bold">
            {holding.asset.name}
          </AppText>
          <AppText color="secondary">{holding.asset.symbol}</AppText>
        </View>
        <View style={styles.valueBlock}>
          <MaskedValue
            align="right"
            masked={masked}
            value={formatINR(holding.currentValue)}
            weight="bold"
          />
          <View style={styles.pnlLine}>
            <MaskedValue
              align="right"
              masked={masked}
              style={isProfit ? styles.profit : styles.loss}
              value={formatPnLAmount(holding)}
            />
            <AppText
              align="right"
              color={isProfit ? "primary" : "primary"}
              style={isProfit ? styles.profit : styles.loss}
            >
              {formatPercentage(holding.unrealisedPnLPct)}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.metrics}>
        <AppText color="secondary">Qty {formatQuantity(holding.totalUnits)}</AppText>
        <AppText color="secondary">
          Avg {formatINR(holding.averageCostPrice)}
        </AppText>
        <AppText color="secondary">
          Current {formatINR(holding.currentPrice)}
        </AppText>
      </View>

      <AppText color="muted" variant="caption">
        {holding.lastUpdated
          ? `Updated ${formatDate(holding.lastUpdated)}`
          : "Quote not refreshed yet"}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.none,
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.cardInner,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    gap: spacing.cardInner,
    justifyContent: "space-between",
  },
  identity: {
    flex: 1,
    gap: spacing.xs,
  },
  loss: {
    color: colors.loss,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pnlLine: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  profit: {
    color: colors.profit,
  },
  valueBlock: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
});
