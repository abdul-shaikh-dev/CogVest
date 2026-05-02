import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  MaskedValue,
  ScreenContainer,
} from "@/src/components/common";
import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, radii, shadows, spacing } from "@/src/theme";
import type { AssetClass } from "@/src/types";

import { useDashboard } from "./useDashboard";

type DashboardScreenProps = {
  onAddTrade?: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

const assetClassLabels: Record<AssetClass, string> = {
  cash: "Cash",
  crypto: "Crypto",
  etf: "ETF",
  stock: "Stock",
};

function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

export function DashboardScreen({
  onAddTrade,
  store = getPortfolioStore(),
}: DashboardScreenProps) {
  const dashboard = useDashboard({ store });
  const hasAllocation = dashboard.allocation.length > 0;
  const dayChangeAmount = formatSignedINR(dashboard.dayChange.absolute);

  return (
    <ScreenContainer scroll testID="dashboard-screen">
      <View style={styles.content}>
        <View style={styles.heroCard}>
          <AppText color="secondary">Portfolio value</AppText>
          <MaskedValue
            masked={dashboard.maskWealthValues}
            value={formatINR(dashboard.totalValue)}
            variant="hero"
            weight="bold"
          />
          <View style={styles.dayChangeLine}>
            <MaskedValue
              masked={dashboard.maskWealthValues}
              style={dashboard.dayChange.absolute >= 0 ? styles.profit : styles.loss}
              value={dayChangeAmount}
            />
            <AppText
              color="primary"
              style={dashboard.dayChange.absolute >= 0 ? styles.profit : styles.loss}
            >
              ({formatPercentage(dashboard.dayChange.percentage)}) today
            </AppText>
          </View>
          {onAddTrade && hasAllocation ? (
            <AppButton
              title="Add Trade"
              testID="add-trade-button"
              onPress={onAddTrade}
            />
          ) : null}
        </View>

        {hasAllocation ? (
          <View style={styles.card}>
            <AppText variant="title" weight="bold">
              Allocation
            </AppText>
            {dashboard.allocation.map((item) => (
              <View key={item.assetClass} style={styles.allocationRow}>
                <View style={styles.allocationLabel}>
                  <AppText>{assetClassLabels[item.assetClass]}</AppText>
                  <MaskedValue
                    color="secondary"
                    masked={dashboard.maskWealthValues}
                    value={formatINR(item.value)}
                  />
                </View>
                <AppText weight="bold">{formatPercentage(item.percentage).replace("+", "")}</AppText>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            actionLabel={onAddTrade ? "Add Trade" : undefined}
            actionTestID="add-trade-button"
            message="Add your first trade to build holdings automatically."
            title="No allocation yet"
            onAction={onAddTrade}
          />
        )}

        <View style={styles.card}>
          <AppText variant="title" weight="bold">
            Quote freshness
          </AppText>
          <AppText color="secondary">
            {dashboard.latestQuoteAsOf
              ? `Quotes updated ${formatDate(dashboard.latestQuoteAsOf)}`
              : "Quotes will appear after your first priced holding."}
          </AppText>
        </View>

        <View style={styles.card}>
          <AppText variant="title" weight="bold">
            {dashboard.convictionReadiness.isReady
              ? "Conviction data ready"
              : "Conviction data needs more trades"}
          </AppText>
          <AppText color="secondary">
            {dashboard.convictionReadiness.ratedTradeCount} of{" "}
            {dashboard.convictionReadiness.requiredTradeCount} trades rated. Keep
            conviction optional, but useful.
          </AppText>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  allocationLabel: {
    flex: 1,
    gap: spacing.xs,
  },
  allocationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.cardInner,
    justifyContent: "space-between",
  },
  card: {
    ...shadows.none,
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
  dayChangeLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  heroCard: {
    ...shadows.none,
    backgroundColor: colors.surface.elevated,
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.cardInner,
    padding: spacing.md,
  },
  loss: {
    color: colors.loss,
  },
  profit: {
    color: colors.profit,
  },
});
