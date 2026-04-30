import { RefreshControl, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { HoldingCard } from "@/src/components/cards";
import { AppButton, AppText, EmptyState, ScreenContainer } from "@/src/components/common";
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
  const { failures, holdings, isRefreshing, refresh } = useHoldings({
    refreshQuotes,
    store,
  });

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
        <View style={styles.header}>
          <View>
            <AppText color="secondary">Portfolio</AppText>
            <AppText variant="hero" weight="bold">
              Holdings
            </AppText>
          </View>
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

        {holdings.length === 0 ? (
          <EmptyState
            actionLabel={onAddTrade ? "Add Trade" : undefined}
            message="Holdings are created automatically from your trades."
            title="No holdings yet"
            onAction={onAddTrade}
          />
        ) : (
          <View
            style={styles.list}
            testID="holdings-list"
          >
            {holdings.map((holding) => (
              <HoldingCard key={holding.asset.id} holding={holding} />
            ))}
          </View>
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
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.cardInner,
    justifyContent: "space-between",
  },
  list: {
    gap: spacing.cardGap,
  },
});
