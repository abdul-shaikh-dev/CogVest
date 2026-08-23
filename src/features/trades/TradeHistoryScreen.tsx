import { useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  GroupedListRow,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { formatCurrency, formatDate } from "@/src/domain/formatters";
import { isManualTrade } from "@/src/domain/transactionSemantics";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";

type TradeHistoryScreenProps = {
  assetId: string;
  onBack: () => void;
  onReviewTrade: (tradeId: string) => void;
  store?: StoreApi<PortfolioStoreState>;
};

export function TradeHistoryScreen({
  assetId,
  onBack,
  onReviewTrade,
  store = getPortfolioStore(),
}: TradeHistoryScreenProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const asset = snapshot.assets.find((item) => item.id === assetId);
  const trades = snapshot.trades
    .filter((trade) => !assetId || trade.assetId === assetId)
    .sort((left, right) => right.date.localeCompare(left.date));

  if (assetId && !asset) {
    return (
      <ScreenContainer testID="trade-history-screen">
        <EmptyState
          actionLabel="Back to Holdings"
          message="The holding may have been removed or changed."
          title="Holding unavailable"
          onAction={onBack}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll testID="trade-history-screen">
      <View style={styles.content}>
        <AppButton
          style={styles.backButton}
          title="Back to Holdings"
          variant="ghost"
          onPress={onBack}
        />
        <ScreenHeader
          title="Transactions"
          subtitle={asset
            ? `${asset.name} · local records`
            : `${trades.length} ${trades.length === 1 ? "record" : "records"} · local only`}
        />
        {trades.length === 0 ? (
          <EmptyState
            message="Opening positions are reviewed separately from later purchases and sales."
            title="No transactions yet"
          />
        ) : (
          <PremiumCard>
            <SectionHeader title="Transaction history" />
            {trades.map((trade) => (
              (() => {
                const isManual = isManualTrade(trade);
                const title = isManual
                  ? trade.type === "buy" ? "Purchase" : "Sale"
                  : trade.type === "transferIn" ? "Transfer in" : "Transfer out";
                const description = snapshot.preferences.maskWealthValues
                  ? `${formatDate(trade.date)} · values masked`
                  : isManual
                    ? `${formatDate(trade.date)} · ${trade.quantity} units at ${formatCurrency(trade.pricePerUnit, asset?.currency ?? "INR")}`
                    : `${formatDate(trade.date)} · ${trade.quantity} units · ${
                        trade.type === "transferIn" && trade.acquisitionCostPerUnit !== undefined
                          ? `acquisition basis ${trade.acquisitionCostPerUnit} per unit`
                          : "no execution price"
                      }`;

                return (
                  <GroupedListRow
                    icon={
                      isManual
                        ? trade.type === "buy"
                          ? "arrow-down-circle-outline"
                          : "arrow-up-circle-outline"
                          : "swap-horizontal-outline"
                    }
                    key={trade.id}
                    meta={description}
                    title={`${title}${asset ? "" : ` · ${snapshot.assets.find((item) => item.id === trade.assetId)?.name ?? "Unknown holding"}`}`}
                    value={
                      snapshot.preferences.maskWealthValues || !isManual
                        ? undefined
                        : formatCurrency(trade.totalValue, asset?.currency ?? "INR")
                    }
                    testID={`review-trade-${trade.id}`}
                    onPress={() => onReviewTrade(trade.id)}
                  />
                );
              })()
            ))}
          </PremiumCard>
        )}
        <AppText color="secondary" variant="caption">
          Purchases and sales keep cash records in sync. Imported transfers are read-only.
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
  },
  content: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
