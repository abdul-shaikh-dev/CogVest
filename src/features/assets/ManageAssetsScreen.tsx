import { Pressable, StyleSheet, View } from "react-native";
import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  AppText,
  CategoryIcon,
  EmptyState,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  assetClassLabel,
  getPressedStateStyle,
} from "@/src/components/common";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, radii, spacing } from "@/src/theme";

type ManageAssetsScreenProps = {
  onBack: () => void;
  onReviewAsset: (assetId: string) => void;
  store?: StoreApi<PortfolioStoreState>;
};

function remainingUnits(state: PortfolioStoreState, assetId: string) {
  const openingUnits = state.openingPositions
    .filter((position) => position.assetId === assetId)
    .reduce((sum, position) => sum + position.quantity, 0);
  return state.trades
    .filter((trade) => trade.assetId === assetId)
    .reduce(
      (units, trade) =>
        units + (trade.type === "buy" ? trade.quantity : -trade.quantity),
      openingUnits,
    );
}

export function ManageAssetsScreen({
  onBack,
  onReviewAsset,
  store = getPortfolioStore(),
}: ManageAssetsScreenProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  return (
    <ScreenContainer scroll testID="manage-assets-screen">
      <View style={styles.content}>
        <ScreenHeader title="Manage Assets" subtitle="Identity and classification" />
        <AppText color="secondary" variant="caption">
          Correct asset details here. Positions and transactions keep their stable links.
        </AppText>

        {snapshot.assets.length === 0 ? (
          <EmptyState
            actionLabel="Back to Holdings"
            message="Add a holding before managing its asset details."
            onAction={onBack}
            title="No assets yet"
          />
        ) : (
          <PremiumCard style={styles.list}>
            {snapshot.assets.map((asset, index) => {
              const isActive = remainingUnits(snapshot, asset.id) > 0.00000001;
              return (
                <Pressable
                  accessibilityHint="Opens asset details and deletion impact"
                  accessibilityRole="button"
                  key={asset.id}
                  onPress={() => onReviewAsset(asset.id)}
                  style={({ pressed }) => [
                    styles.row,
                    index < snapshot.assets.length - 1 && styles.divider,
                    getPressedStateStyle({ pressed }),
                  ]}
                  testID={`manage-asset-${asset.id}`}
                >
                  <View style={styles.icon}>
                    <CategoryIcon assetClass={asset.assetClass} size={20} />
                  </View>
                  <View style={styles.copy}>
                    <AppText numberOfLines={1} weight="bold">{asset.name}</AppText>
                    <AppText color="secondary" numberOfLines={1} variant="caption">
                      {asset.symbol} · {assetClassLabel(asset.assetClass)}
                    </AppText>
                  </View>
                  <View style={[styles.status, isActive ? styles.active : styles.closed]}>
                    <AppText color={isActive ? "primary" : "secondary"} variant="caption" weight="bold">
                      {isActive ? "Active" : "Closed"}
                    </AppText>
                  </View>
                  <AppText color="secondary">›</AppText>
                </Pressable>
              );
            })}
          </PremiumCard>
        )}

        <View style={styles.backAction}>
          <Pressable accessibilityRole="button" onPress={onBack} testID="manage-assets-back">
            <AppText color="secondary" weight="bold">Back to Holdings</AppText>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  active: { backgroundColor: "rgba(52,199,89,0.12)" },
  backAction: { alignItems: "flex-start", paddingVertical: spacing.sm },
  closed: { backgroundColor: colors.surface.elevated },
  content: { gap: spacing.cardGap },
  copy: { flex: 1, gap: spacing.xs },
  divider: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { alignItems: "center", justifyContent: "center", width: 32 },
  list: { paddingHorizontal: spacing.md, paddingVertical: 0 },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 72, paddingVertical: spacing.sm },
  status: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
