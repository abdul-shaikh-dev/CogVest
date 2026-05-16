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
import type { RefreshQuotesInput, QuoteRefreshResult } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";

import { useDashboard } from "./useDashboard";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type DashboardScreenProps = {
  onAddTrade?: () => void;
  refreshQuotes?: RefreshQuotes;
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
  refreshQuotes,
  store = getPortfolioStore(),
}: DashboardScreenProps) {
  const dashboard = useDashboard({ refreshQuotes, store });
  const hasAllocation = dashboard.allocation.length > 0;
  const dayChangeAmount = formatSignedINR(dashboard.dayChange.absolute);
  const totalInvested = dashboard.rollupTotals.totalInvested;
  const totalPnL = dashboard.rollupTotals.pnl;
  const totalPnLPct = dashboard.rollupTotals.pnlPct;
  const sectorSnapshot = dashboard.sectorAllocation.slice(0, 3);
  const instrumentSnapshot = dashboard.instrumentAllocation.slice(0, 3);
  const quoteStatus = getQuoteStatus({
    isRefreshing: dashboard.isRefreshing,
    latestQuoteAsOf: dashboard.latestQuoteAsOf,
    latestQuoteSource: dashboard.latestQuoteSource,
    quoteFailures: dashboard.quoteFailures.length,
  });

  return (
    <ScreenContainer scroll testID="dashboard-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Dashboard"
          subtitle="Local portfolio • latest snapshot"
          action={
            <>
              <IconButton
                accessibilityLabel={
                  dashboard.maskWealthValues ? "Show values" : "Mask values"
                }
                icon={dashboard.maskWealthValues ? "eye-off-outline" : "eye-outline"}
                onPress={dashboard.toggleMaskWealthValues}
                testID="dashboard-mask-toggle"
              />
              <IconButton
                accessibilityLabel="Refresh quotes"
                icon="refresh-outline"
                onPress={() => {
                  void dashboard.refresh();
                }}
                testID="dashboard-refresh-quotes"
              />
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

        {sectorSnapshot.length > 0 || instrumentSnapshot.length > 0 ? (
          <PremiumCard>
            <SectionHeader title="Portfolio Rollups" />
            {sectorSnapshot.length > 0 ? (
              <View style={styles.rollupGroup}>
                <AppText color="secondary" variant="caption" weight="medium">
                  Top sectors
                </AppText>
                {sectorSnapshot.map((item) => (
                  <View key={item.label} style={styles.rollupRow}>
                    <AppText weight="bold">{item.label}</AppText>
                    <MaskedValue
                      align="right"
                      color="secondary"
                      masked={dashboard.maskWealthValues}
                      value={`${formatINR(item.value)} · ${formatUnsignedPercentage(
                        item.percentage,
                      )}`}
                      variant="caption"
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {instrumentSnapshot.length > 0 ? (
              <View style={styles.rollupGroup}>
                <AppText color="secondary" variant="caption" weight="medium">
                  Top instruments
                </AppText>
                {instrumentSnapshot.map((item) => (
                  <View key={item.label} style={styles.rollupRow}>
                    <AppText weight="bold">{item.label}</AppText>
                    <MaskedValue
                      align="right"
                      color="secondary"
                      masked={dashboard.maskWealthValues}
                      value={`${formatINR(item.value)} · ${formatUnsignedPercentage(
                        item.percentage,
                      )}`}
                      variant="caption"
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </PremiumCard>
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
                value: formatINR(dashboard.monthlyMetrics.investment),
              },
              {
                label: "Savings",
                value:
                  dashboard.monthlyMetrics.savingsRate === null
                    ? "Not enough data"
                    : formatPercentage(dashboard.monthlyMetrics.savingsRate),
              },
              {
                label: "Cash change",
                masked: dashboard.maskWealthValues,
                value: formatSignedINR(dashboard.monthlyMetrics.cashChange),
              },
            ]}
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Quote Status" />
          <AppText color="secondary">{quoteStatus}</AppText>
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

function getQuoteStatus({
  isRefreshing,
  latestQuoteAsOf,
  latestQuoteSource,
  quoteFailures,
}: {
  isRefreshing: boolean;
  latestQuoteAsOf?: string;
  latestQuoteSource?: string;
  quoteFailures: number;
}) {
  if (isRefreshing) {
    return "Refreshing quotes...";
  }

  if (quoteFailures > 0) {
    return "Some quotes could not refresh. Manual fallback ready.";
  }

  if (!latestQuoteAsOf) {
    return "Quotes will appear after your first priced holding.";
  }

  const mode =
    latestQuoteSource === "manual" ? "Manual fallback ready" : "Live refresh available";

  return `Quotes updated ${formatDate(latestQuoteAsOf)} • ${mode}`;
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
  rollupGroup: {
    gap: spacing.sm,
  },
  rollupRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
});
