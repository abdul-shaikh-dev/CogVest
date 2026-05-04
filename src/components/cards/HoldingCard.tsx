import { StyleSheet, View } from "react-native";

import { CategoryIcon, PremiumCard, assetClassLabel } from "@/src/components/common";
import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import { colors, spacing } from "@/src/theme";
import type { Holding } from "@/src/types";

import { AppText, MaskedValue } from "../common";

type HoldingCardProps = {
  allocationPct?: number;
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

export function HoldingCard({
  allocationPct,
  holding,
  masked = false,
}: HoldingCardProps) {
  const isProfit = holding.unrealisedPnL >= 0;

  return (
    <PremiumCard style={styles.card}>
      <View style={styles.header}>
        <CategoryIcon assetClass={holding.asset.assetClass} />
        <View style={styles.identity}>
          <AppText weight="bold">
            {holding.asset.name}
          </AppText>
          <AppText color="secondary" variant="caption">
            {holding.asset.symbol}
          </AppText>
          <AppText color="secondary" variant="caption">
            {assetClassLabel(holding.asset.assetClass)}
          </AppText>
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
        {allocationPct !== undefined ? (
          <AppText color="secondary">
            Allocation {formatPercentage(allocationPct).replace("+", "")}
          </AppText>
        ) : null}
      </View>

      <AppText color="muted" variant="caption">
        {holding.lastUpdated
          ? `Updated ${formatDate(holding.lastUpdated)}`
          : "Quote not refreshed yet"}
      </AppText>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.cardInner,
  },
  header: {
    alignItems: "flex-start",
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
