import { RefreshControl, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { HoldingCard } from "@/src/components/cards";
import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import { formatINR } from "@/src/domain/formatters";
import type { RefreshQuotesInput, QuoteRefreshResult } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, spacing } from "@/src/theme";

import { useHoldings } from "./useHoldings";

type RefreshQuotes = (
  input: RefreshQuotesInput,
) => Promise<QuoteRefreshResult>;

type HoldingsScreenProps = {
  onAddTrade?: () => void;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};

export function HoldingsScreen({
  onAddTrade,
  refreshQuotes,
  store = getPortfolioStore(),
}: HoldingsScreenProps) {
  const { failures, holdings, isRefreshing, maskWealthValues, refresh } = useHoldings({
    refreshQuotes,
    store,
  });
  const totalCurrentValue = holdings.reduce(
    (total, holding) => total + holding.currentValue,
    0,
  );
  const totalInvested = holdings.reduce(
    (total, holding) => total + holding.totalInvested,
    0,
  );

  return (
    <ScreenContainer
      refreshControl={
        holdings.length > 0 ? (
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              void refresh();
            }}
          />
        ) : undefined
      }
      scroll
      testID="holdings-screen"
    >
      <View style={styles.content}>
        <ScreenHeader
          title="Holdings"
          subtitle={`${holdings.length} positions • local data`}
          action={
            <>
              <IconButton accessibilityLabel="Search holdings" icon="search-outline" />
              <IconButton accessibilityLabel="Toggle value visibility" icon="eye-outline" />
            </>
          }
        />

        {holdings.length > 0 ? (
          <MetricGroup
            metrics={[
              {
                label: "Current",
                masked: maskWealthValues,
                value: formatINR(totalCurrentValue),
              },
              {
                label: "Invested",
                masked: maskWealthValues,
                value: formatINR(totalInvested),
              },
              {
                label: "P&L",
                masked: maskWealthValues,
                value: formatINR(totalCurrentValue - totalInvested),
              },
            ]}
          />
        ) : null}

        <View style={styles.actionRow}>
          {holdings.length > 0 ? (
            <AppButton
              title="Refresh Quotes"
              variant="secondary"
              onPress={() => {
                void refresh();
              }}
            />
          ) : null}
        </View>

        <View style={styles.filters}>
          {["All", "Equity", "Debt", "Crypto", "Cash"].map((label, index) => (
            <View key={label} style={[styles.filterChip, index === 0 && styles.filterChipActive]}>
              <AppText
                color={index === 0 ? "inverse" : "secondary"}
                variant="caption"
                weight="bold"
              >
                {label}
              </AppText>
            </View>
          ))}
        </View>

        {holdings.length === 0 ? (
          <EmptyState
            actionLabel={onAddTrade ? "Add Holding" : undefined}
            actionTestID="add-trade-button"
            message="Holdings are created automatically from your portfolio entries."
            title="No holdings yet"
            onAction={onAddTrade}
          />
        ) : (
          <PremiumCard style={styles.list} testID="holdings-list">
            {holdings.map((holding) => (
              <HoldingCard
                key={holding.asset.id}
                allocationPct={
                  totalCurrentValue === 0
                    ? 0
                    : (holding.currentValue / totalCurrentValue) * 100
                }
                holding={holding}
                masked={maskWealthValues}
              />
            ))}
          </PremiumCard>
        )}

        {failures.length > 0 ? (
          <AppText color="secondary">
            Some quotes could not refresh. Manual prices remain in use.
          </AppText>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surface.elevated,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  list: {
    gap: spacing.sm,
    padding: spacing.sm,
  },
});
