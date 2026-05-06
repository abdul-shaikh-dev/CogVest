import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  HeroMetric,
  IconButton,
  MetricGroup,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  assetClassLabel,
  CategoryIcon,
} from "@/src/components/common";
import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";

import { useDashboard } from "./useDashboard";

type DashboardScreenProps = {
  onAddTrade?: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

function formatUnsignedPercentage(value: number) {
  return formatPercentage(value).replace("+", "");
}

export function DashboardScreen({
  onAddTrade,
  store = getPortfolioStore(),
}: DashboardScreenProps) {
  const dashboard = useDashboard({ store });
  const hasAllocation = dashboard.allocation.length > 0;
  const dayChangeAmount = formatSignedINR(dashboard.dayChange.absolute);
  const totalInvested = dashboard.holdings.reduce(
    (total, holding) => total + holding.totalInvested,
    0,
  );
  const totalPnL = dashboard.holdings.reduce(
    (total, holding) => total + holding.unrealisedPnL,
    0,
  );
  const totalPnLPct = totalInvested === 0 ? 0 : (totalPnL / totalInvested) * 100;

  return (
    <ScreenContainer scroll testID="dashboard-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Dashboard"
          subtitle="Local portfolio • latest snapshot"
          action={
            <>
              <IconButton accessibilityLabel="Toggle value visibility" icon="eye-outline" />
              <IconButton accessibilityLabel="Refresh quotes" icon="refresh-outline" />
            </>
          }
        />

        <HeroMetric
          label="Portfolio Value"
          masked={dashboard.maskWealthValues}
          value={formatINR(dashboard.totalValue)}
          subValue={`${dayChangeAmount} (${formatPercentage(
            dashboard.dayChange.percentage,
          )}) today`}
          subValueTone={dashboard.dayChange.absolute >= 0 ? "positive" : "negative"}
        />

        <MetricGroup
          metrics={[
            {
              label: "Invested",
              masked: dashboard.maskWealthValues,
              value: formatINR(totalInvested),
            },
            {
              color: totalPnL >= 0 ? "primary" : "primary",
              label: "P&L",
              masked: dashboard.maskWealthValues,
              value: formatSignedINR(totalPnL),
            },
            {
              label: "P&L %",
              value: formatPercentage(totalPnLPct),
            },
          ]}
        />

        {onAddTrade && hasAllocation ? (
          <AppButton
            title="Add Holding"
            testID="add-trade-button"
            onPress={onAddTrade}
          />
        ) : null}

        {hasAllocation ? (
          <PremiumCard>
            <SectionHeader title="Allocation" actionLabel="View details" />
            {dashboard.allocation.map((item) => (
              <View key={item.assetClass} style={styles.allocationRow}>
                <View style={styles.allocationIdentity}>
                  <CategoryIcon assetClass={item.assetClass} />
                  <View style={styles.allocationCopy}>
                    <AppText weight="bold">
                      {assetClassLabel(item.assetClass)}
                    </AppText>
                    <MaskedValue
                      color="secondary"
                      masked={dashboard.maskWealthValues}
                      value={formatINR(item.value)}
                      variant="caption"
                    />
                  </View>
                </View>
                <AppText weight="bold">
                  {formatUnsignedPercentage(item.percentage)}
                </AppText>
              </View>
            ))}
          </PremiumCard>
        ) : (
          <EmptyState
            actionLabel={onAddTrade ? "Add Holding" : undefined}
            actionTestID="add-trade-button"
            message="Add your first portfolio entry to build holdings automatically."
            title="No allocation yet"
            onAction={onAddTrade}
          />
        )}

        <PremiumCard>
          <SectionHeader title="This Month" />
          <MetricGroup
            metrics={[
              {
                label: "Invested",
                masked: dashboard.maskWealthValues,
                value: formatINR(totalInvested),
              },
              {
                label: "Cash balance",
                masked: dashboard.maskWealthValues,
                value: formatINR(dashboard.cashBalance),
              },
              {
                label: "Holdings",
                value: dashboard.holdings.length.toString(),
              },
            ]}
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Quote Status" />
          <AppText color="secondary">
            {dashboard.latestQuoteAsOf
              ? `Quotes updated ${formatDate(dashboard.latestQuoteAsOf)}`
              : "Quotes will appear after your first priced holding."}
          </AppText>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader
            title={
              dashboard.convictionReadiness.isReady
                ? "Conviction data ready"
                : "Conviction data needs more trades"
            }
          />
          <AppText color="secondary">
            {dashboard.convictionReadiness.ratedTradeCount} of{" "}
            {dashboard.convictionReadiness.requiredTradeCount} trades rated. Keep
            conviction optional, but useful.
          </AppText>
        </PremiumCard>

      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  allocationCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  allocationIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.cardInner,
  },
  allocationRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
});
