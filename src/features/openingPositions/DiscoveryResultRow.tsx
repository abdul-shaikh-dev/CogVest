import { memo } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { AppText, CategoryIcon, assetClassLabel } from "@/src/components/common";
import type { Asset } from "@/src/types";
import { colors, radii, spacing } from "@/src/theme";
import type { AssetLookupResult } from "@/src/services/assetLookup";

// Keep already-visible rows stable while another page is appended.
export const DiscoveryResultRow = memo(function DiscoveryResultRow({ result, onSelect }: {
  result: AssetLookupResult;
  onSelect: (result: AssetLookupResult) => void;
}) {
  return <TouchableOpacity accessibilityLabel={`Select ${result.name}`} accessibilityRole="button"
    activeOpacity={0.74} onPress={() => onSelect(result)} style={styles.row}
    testID={`asset-lookup-result-${result.id}`}>
    <CategoryIcon assetClass={result.assetClass} size={18} />
    <View style={styles.copy}>
      <AppText weight="bold">{result.name}</AppText>
      <AppText color="secondary" variant="caption">{result.symbol} • {result.exchange ?? result.sourceLabel} • {result.currency}</AppText>
      <AppText color="secondary" variant="caption">{result.sourceLabel}</AppText>
    </View>
    <AppText color="secondary" variant="caption" weight="bold">Select</AppText>
  </TouchableOpacity>;
});

export const SavedAssetRow = memo(function SavedAssetRow({ asset, onSelect }: {
  asset: Asset;
  onSelect: (asset: Asset) => void;
}) {
  return <TouchableOpacity accessibilityLabel={`Use ${asset.name}`} accessibilityRole="button"
    activeOpacity={0.74} onPress={() => onSelect(asset)} style={styles.savedRow}
    testID={`existing-asset-${asset.id}`}>
    <CategoryIcon assetClass={asset.assetClass} size={18} />
    <View style={styles.savedCopy}>
      <AppText weight="bold">{asset.name}</AppText>
      <AppText color="secondary" variant="caption">{asset.symbol} • {asset.exchange ?? assetClassLabel(asset.assetClass)} • {asset.currency}</AppText>
    </View>
    <AppText color="secondary" variant="caption" weight="bold">Use</AppText>
  </TouchableOpacity>;
});

const styles = StyleSheet.create({
  savedRow: { alignItems: "center", backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle, borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  savedCopy: { flex: 1, gap: spacing.xs },
  row: { alignItems: "center", borderColor: colors.border.subtle, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.button, flexDirection: "row", gap: spacing.sm, padding: spacing.sm, minHeight: 56 },
  copy: { flex: 1, minWidth: 0 },
});
