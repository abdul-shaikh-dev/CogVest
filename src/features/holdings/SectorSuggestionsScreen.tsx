import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import { EpfCheckRow } from "@/src/features/epf/EpfCheckRow";
import { usePortfolioFields } from "@/src/hooks";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";

import { describeSuggestion, reviewableSuggestions } from "./holdingsSectors";

/**
 * Review of sector and ETF suggestions from fund names (#823). Nothing changes
 * until the user applies the ones left ticked; they are saved together.
 */
export function SectorSuggestionsScreen({
  onClose,
  store = getPortfolioStore(),
}: {
  onClose: () => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const { applyAssetClassifications, assets, ppfAccounts } = usePortfolioFields(store, [
    "applyAssetClassifications", "assets", "ppfAccounts",
  ]);
  // The list is fixed when the screen opens, so applying doesn't reshuffle it.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot on open.
  const suggestions = useMemo(() => reviewableSuggestions(assets, ppfAccounts), []);
  const names = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<{ applied: number } | { error: string }>();
  const chosen = suggestions.filter((suggestion) => !skipped.has(suggestion.assetId));

  function toggle(assetId: string) {
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function apply() {
    const outcome = applyAssetClassifications(chosen.map((suggestion) => ({
      assetClass: suggestion.next.assetClass,
      assetId: suggestion.assetId,
      instrumentType: suggestion.next.instrumentType,
      sectorType: suggestion.next.sectorType,
    })));
    setResult(outcome.status === "applied"
      ? { applied: outcome.applied }
      : { error: `${names.get(outcome.assetId) ?? "A holding"} couldn't be changed, so nothing was saved.` });
  }

  return (
    <ScreenContainer scroll testID="sector-suggestions-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Sector suggestions"
          leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onClose} testID="sector-suggestions-back" />}
        />
        {result && "applied" in result ? (
          <PremiumCard style={styles.card} testID="sector-suggestions-done">
            <AppText weight="bold">
              {result.applied === 1 ? "1 holding updated" : `${result.applied} holdings updated`}
            </AppText>
            <AppText color="secondary">Values and history are unchanged; only the sector and type labels moved.</AppText>
            <AppButton onPress={onClose} testID="sector-suggestions-close" title="Done" />
          </PremiumCard>
        ) : suggestions.length === 0 ? (
          <EmptyState
            title="Nothing to suggest"
            message="Every fund and ETF either has a sector or a name that doesn't state one."
          />
        ) : (
          <>
            <AppText color="secondary">
              These come from fund and ETF names, such as &quot;Nifty IT&quot; or &quot;Gold BeES&quot;. Only sectors
              still set to Unknown, or Diversified on an ETF, are suggested. Company shares are never changed.
            </AppText>
            {result && "error" in result ? (
              <AppText testID="sector-suggestions-error">{result.error}</AppText>
            ) : null}
            <PremiumCard style={styles.card}>
              {suggestions.map((suggestion) => (
                <EpfCheckRow
                  checked={!skipped.has(suggestion.assetId)}
                  helper={describeSuggestion(suggestion).join(" · ")}
                  key={suggestion.assetId}
                  label={names.get(suggestion.assetId) ?? suggestion.assetId}
                  onToggle={() => toggle(suggestion.assetId)}
                  testID={`sector-suggestion-${suggestion.assetId}`}
                />
              ))}
            </PremiumCard>
            <AppButton
              disabled={chosen.length === 0}
              onPress={apply}
              testID="sector-suggestions-apply"
              title={chosen.length === 1 ? "Apply 1 change" : `Apply ${chosen.length} changes`}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  content: { gap: spacing.cardGap, paddingTop: spacing.md },
});
