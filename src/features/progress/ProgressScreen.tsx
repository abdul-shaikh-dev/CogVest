import { useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppText,
  CategoryIcon,
  EmptyState,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  assetClassLabel,
} from "@/src/components/common";
import {
  calculateAllocation,
  calculateCashBalance,
  calculateHoldings,
  calculatePortfolioTotal,
} from "@/src/domain/calculations";
import { formatINR, formatPercentage } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, spacing } from "@/src/theme";

type ProgressScreenProps = {
  store?: StoreApi<PortfolioStoreState>;
};

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function getMonthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function isCurrentMonth(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export function ProgressScreen({
  store = getPortfolioStore(),
}: ProgressScreenProps) {
  const snapshot = usePortfolioSnapshot(store);
  const holdings = calculateHoldings({
    assets: snapshot.assets,
    quoteCache: snapshot.quoteCache,
    trades: snapshot.trades,
  });
  const cashBalance = calculateCashBalance(snapshot.cashEntries);
  const portfolioValue = calculatePortfolioTotal(holdings, snapshot.cashEntries);
  const totalInvested = holdings.reduce(
    (total, holding) => total + holding.totalInvested,
    0,
  );
  const monthlyInvestment = snapshot.trades
    .filter((trade) => trade.type === "buy" && isCurrentMonth(trade.date))
    .reduce((total, trade) => total + trade.totalValue, 0);
  const monthlyCashAdded = snapshot.cashEntries
    .filter((entry) => entry.type === "addition" && isCurrentMonth(entry.date))
    .reduce((total, entry) => total + entry.amount, 0);
  const savingsRate =
    monthlyCashAdded === 0 ? 0 : (monthlyInvestment / monthlyCashAdded) * 100;
  const allocation = calculateAllocation({ cashBalance, holdings });
  const hasData = holdings.length > 0 || snapshot.cashEntries.length > 0;

  return (
    <ScreenContainer scroll testID="progress-screen">
      <View style={styles.content}>
        <ScreenHeader title="Monthly Progress" subtitle={getMonthLabel()} />

        {hasData ? (
          <>
            <MetricGroup
              metrics={[
                {
                  label: "Portfolio",
                  masked: snapshot.preferences.maskWealthValues,
                  value: formatINR(portfolioValue),
                },
                {
                  label: "Invested",
                  masked: snapshot.preferences.maskWealthValues,
                  value: formatINR(totalInvested),
                },
                {
                  label: "Cash",
                  masked: snapshot.preferences.maskWealthValues,
                  value: formatINR(cashBalance),
                },
                {
                  label: "Savings",
                  value: monthlyCashAdded === 0 ? "Not enough data" : formatPercentage(savingsRate),
                },
              ]}
            />

            <PremiumCard>
              <SectionHeader title="What changed this month?" />
              <AppText color="secondary">
                Monthly investment: {formatINR(monthlyInvestment)}
              </AppText>
              <AppText color="secondary">
                Cash added: {formatINR(monthlyCashAdded)}
              </AppText>
              <AppText color="secondary">
                Expense rate needs explicit expense tracking and is not shown in V1.
              </AppText>
            </PremiumCard>

            <PremiumCard>
              <SectionHeader title="Progression (last 6 months)" />
              <View style={styles.chartPlaceholder}>
                <AppText color="secondary" align="center">
                  Historical chart appears after monthly snapshots are recorded.
                </AppText>
              </View>
            </PremiumCard>

            <PremiumCard>
              <SectionHeader title="Asset class snapshot" />
              {allocation.map((item) => (
                <View key={item.assetClass} style={styles.assetRow}>
                  <View style={styles.assetIdentity}>
                    <CategoryIcon assetClass={item.assetClass} />
                    <AppText weight="bold">{assetClassLabel(item.assetClass)}</AppText>
                  </View>
                  <View style={styles.assetValue}>
                    <AppText>{formatINR(item.value)}</AppText>
                    <AppText color="secondary" variant="caption">
                      {formatPercentage(item.percentage).replace("+", "")}
                    </AppText>
                  </View>
                </View>
              ))}
            </PremiumCard>
          </>
        ) : (
          <EmptyState
            title="No monthly progress yet"
            message="Add holdings and cash entries to build a monthly snapshot without opening Excel."
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  assetIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  assetRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  assetValue: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  chartPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 120,
    padding: spacing.md,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
});
