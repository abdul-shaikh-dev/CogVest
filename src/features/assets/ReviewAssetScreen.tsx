import { useRef, useState, useSyncExternalStore } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  assetClassLabel,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { instrumentTypeOptions, sectorTypeOptions } from "@/src/domain/assets";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { Asset, AssetClass, AssetExchange, InstrumentType, SectorType } from "@/src/types";

type ReviewAssetScreenProps = {
  assetId: string;
  onCancel: () => void;
  onComplete: (message: string) => void;
  store?: StoreApi<PortfolioStoreState>;
};

const assetClasses: AssetClass[] = ["stock", "etf", "debt", "crypto", "cash"];
const exchanges: AssetExchange[] = ["NSE", "BSE", "CRYPTO"];

function humanize(value: string) {
  const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function failureMessage(reason?: string) {
  if (reason === "notFound") return "This asset is no longer available.";
  if (reason === "duplicateIdentity") {
    return "Another asset already uses this provider or exchange and ticker identity.";
  }
  if (reason === "insufficientCash") {
    return "This asset's sale proceeds fund later cash activity. Correct those records before deleting it.";
  }
  return "These asset details are not valid for CogVest V1.";
}

function ChoiceGroup<T extends string>({
  label,
  onChange,
  options,
  testIDPrefix,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly T[];
  testIDPrefix: string;
  value: T;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel =
    label === "Asset class"
      ? assetClassLabel(value as AssetClass)
      : humanize(value);

  return (
    <>
      <Pressable
        accessibilityHint={`Select ${label.toLowerCase()}`}
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}
        testID={`${testIDPrefix}-picker`}
      >
        <View style={styles.pickerCopy}>
          <AppText color="secondary" variant="caption">{label}</AppText>
          <AppText weight="bold">{selectedLabel}</AppText>
        </View>
        <AppText color="secondary">›</AppText>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.optionSheet}>
            <SectionHeader title={`Choose ${label.toLowerCase()}`} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option, index) => {
                const selected = option === value;
                const optionLabel =
                  label === "Asset class"
                    ? assetClassLabel(option as AssetClass)
                    : humanize(option);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option}
                    onPress={() => {
                      onChange(option);
                      setIsOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      index < options.length - 1 && styles.optionDivider,
                      pressed && styles.pressed,
                    ]}
                    testID={`${testIDPrefix}-${option}`}
                  >
                    <AppText color={selected ? "primary" : "secondary"} weight={selected ? "bold" : "medium"}>
                      {optionLabel}
                    </AppText>
                    {selected ? <AppText color="primary" weight="bold">Selected</AppText> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export function ReviewAssetScreen({
  assetId,
  onCancel,
  onComplete,
  store = getPortfolioStore(),
}: ReviewAssetScreenProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const currentAsset = snapshot.assets.find((asset) => asset.id === assetId);
  const initialAssetRef = useRef(currentAsset);
  const initialAsset = initialAssetRef.current;
  const [name, setName] = useState(() => initialAsset?.name ?? "");
  const [symbol, setSymbol] = useState(() => initialAsset?.symbol ?? "");
  const [ticker, setTicker] = useState(() => initialAsset?.ticker ?? "");
  const [quoteSourceId, setQuoteSourceId] = useState(() => initialAsset?.quoteSourceId ?? "");
  const [assetClass, setAssetClass] = useState<AssetClass>(() => initialAsset?.assetClass ?? "stock");
  const [exchange, setExchange] = useState<AssetExchange>(() => initialAsset?.exchange ?? "NSE");
  const [instrumentType, setInstrumentType] = useState<InstrumentType>(() => initialAsset?.instrumentType ?? "other");
  const [sectorType, setSectorType] = useState<SectorType>(() => initialAsset?.sectorType ?? "other");
  const [isTaxEligible, setIsTaxEligible] = useState(() => Boolean(initialAsset?.isTaxEligible));
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const actionInFlightRef = useRef(false);

  if (!currentAsset || !initialAsset) {
    return (
      <ScreenContainer testID="review-asset-screen">
        <EmptyState
          actionLabel="Back to assets"
          message="It may already have been deleted. No other records were changed."
          onAction={onCancel}
          title="Asset unavailable"
        />
      </ScreenContainer>
    );
  }

  const stableAsset = initialAsset;

  const tradeIds = new Set(
    snapshot.trades.filter((trade) => trade.assetId === assetId).map((trade) => trade.id),
  );
  const earliestAffectedMonth = [
    ...snapshot.openingPositions
      .filter((position) => position.assetId === assetId)
      .map((position) => position.date.slice(0, 7)),
    ...snapshot.trades
      .filter((trade) => trade.assetId === assetId)
      .map((trade) => trade.date.slice(0, 7)),
  ].sort()[0];
  const impact = {
    automaticSnapshots: snapshot.monthlySnapshots.filter(
      (monthlySnapshot) =>
        Boolean(earliestAffectedMonth) &&
        monthlySnapshot.month >= earliestAffectedMonth &&
        monthlySnapshot.generated?.source === "auto",
    ).length,
    historicalQuotes: Object.values(snapshot.historicalQuoteCache).filter((quote) => quote.assetId === assetId).length,
    linkedCashEntries: snapshot.cashEntries.filter((entry) => tradeIds.has(entry.linkedTradeId ?? "")).length,
    openingPositions: snapshot.openingPositions.filter((position) => position.assetId === assetId).length,
    quotes: snapshot.quoteCache[assetId] ? 1 : 0,
    trades: tradeIds.size,
  };

  function correctedAsset(): Asset {
    return {
      ...stableAsset,
      assetClass,
      currency: "INR",
      exchange,
      instrumentType,
      isTaxEligible,
      name: name.trim(),
      quoteSourceId: quoteSourceId.trim() || ticker.trim(),
      sectorType,
      symbol: symbol.trim().toUpperCase(),
      ticker: ticker.trim().toUpperCase(),
    };
  }

  async function save() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;
    try {
      const result = store.getState().correctAsset(correctedAsset());
      if (result.status === "rejected") {
        setError(failureMessage(result.reason));
        return;
      }
      await Promise.resolve();
      completed = true;
      onComplete(
        result.quoteCacheInvalidated
          ? "Asset details saved. Its prices will refresh automatically."
          : "Asset details saved.",
      );
    } catch {
      setError("Asset details could not be saved safely. Try again.");
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  async function deleteAsset() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;
    try {
      const result = store.getState().deleteAsset(assetId);
      if (result.status === "rejected") {
        setError(failureMessage(result.reason));
        return;
      }
      await Promise.resolve();
      completed = true;
      onComplete(
        result.pendingMonths.length > 0
          ? "Asset deleted. Portfolio history will refresh automatically."
          : "Asset and linked records deleted.",
      );
    } catch {
      setError("This asset could not be deleted safely. Nothing was changed.");
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  return (
    <ScreenContainer scroll testID="review-asset-screen">
      <View style={styles.content}>
        <ScreenHeader title="Review Asset" subtitle={`${stableAsset.name} · stable local identity`} />

        <PremiumCard style={styles.section}>
          <SectionHeader title="Identity" />
          <AppText color="secondary" variant="caption">Asset ID stays fixed so positions and transactions remain linked.</AppText>
          <FormTextField label="Name" onChangeText={setName} testID="asset-name-input" value={name} />
          <FormTextField label="Symbol" onChangeText={setSymbol} testID="asset-symbol-input" value={symbol} />
          <FormTextField label="Ticker" onChangeText={setTicker} testID="asset-ticker-input" value={ticker} />
          <ChoiceGroup label="Exchange" onChange={setExchange} options={exchanges} testIDPrefix="asset-exchange" value={exchange} />
          <FormTextField label="Price lookup symbol" onChangeText={setQuoteSourceId} testID="asset-provider-id-input" value={quoteSourceId} />
          <AppText color="secondary" variant="caption">Used to refresh this asset's market price. Change it only when the current quote belongs to the wrong instrument.</AppText>
          <View style={styles.fixedRow}>
            <AppText color="secondary">Reporting currency</AppText>
            <AppText weight="bold">INR</AppText>
          </View>
        </PremiumCard>

        <PremiumCard style={styles.section}>
          <SectionHeader title="Classification" />
          <ChoiceGroup label="Asset class" onChange={setAssetClass} options={assetClasses} testIDPrefix="asset-class" value={assetClass} />
          <ChoiceGroup label="Instrument" onChange={setInstrumentType} options={instrumentTypeOptions} testIDPrefix="asset-instrument" value={instrumentType} />
          <ChoiceGroup label="Sector" onChange={setSectorType} options={sectorTypeOptions} testIDPrefix="asset-sector" value={sectorType} />
          <ChoiceGroup label="Tax eligibility" onChange={(value) => setIsTaxEligible(value === "eligible")} options={["eligible", "notEligible"] as const} testIDPrefix="asset-tax" value={isTaxEligible ? "eligible" : "notEligible"} />
        </PremiumCard>

        {error ? <AppText accessibilityLiveRegion="polite" style={styles.error} variant="caption">{error}</AppText> : null}

        <View style={styles.actions}>
          <AppButton disabled={isSaving} onPress={onCancel} title="Cancel" variant="secondary" />
          <AppButton disabled={isSaving} onPress={save} testID="save-asset-correction-button" title={isSaving ? "Saving…" : "Save asset"} />
        </View>

        <PremiumCard style={styles.dangerCard}>
          <SectionHeader title="Delete asset and history" />
          <AppText color="secondary" variant="caption">
            Removes {impact.openingPositions} opening position{impact.openingPositions === 1 ? "" : "s"}, {impact.trades} transaction{impact.trades === 1 ? "" : "s"}, {impact.linkedCashEntries} linked cash movement{impact.linkedCashEntries === 1 ? "" : "s"}, {impact.quotes} current quote{impact.quotes === 1 ? "" : "s"}, and {impact.historicalQuotes} historical quote{impact.historicalQuotes === 1 ? "" : "s"}. Manual cash entries and manual snapshots stay intact.
          </AppText>
          <AppText color="secondary" variant="caption">
            {impact.automaticSnapshots} automatic monthly snapshot{impact.automaticSnapshots === 1 ? "" : "s"} may be recalculated from the remaining records.
          </AppText>
          <AppButton disabled={isSaving} onPress={() => setIsConfirmingDelete(true)} testID="delete-asset-button" title="Review deletion" variant="ghost" textColor="primary" />
        </PremiumCard>

        <Modal
          animationType="fade"
          onRequestClose={() => setIsConfirmingDelete(false)}
          transparent
          visible={isConfirmingDelete}
        >
          <View style={styles.confirmationBackdrop}>
            <View accessibilityViewIsModal style={styles.confirmationSheet}>
              <SectionHeader title={`Delete ${stableAsset.name}?`} />
              <AppText color="secondary">
                This permanently removes the asset and every linked record listed on the previous screen. Manual cash entries and manual snapshots remain.
              </AppText>
              <View style={styles.confirmationActions}>
                <AppButton disabled={isSaving} onPress={() => setIsConfirmingDelete(false)} title="Keep asset" variant="secondary" />
                <AppButton disabled={isSaving} onPress={deleteAsset} testID="confirm-delete-asset-button" title="Delete permanently" variant="destructive" />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.sm },
  confirmationActions: { gap: spacing.sm },
  confirmationBackdrop: { backgroundColor: "rgba(0,0,0,0.78)", flex: 1, justifyContent: "center", padding: spacing.lg },
  confirmationSheet: { backgroundColor: colors.surface.card, borderRadius: radii.sheet, gap: spacing.md, padding: spacing.lg },
  content: { gap: spacing.cardGap },
  dangerCard: { gap: spacing.md },
  error: { color: colors.loss },
  fixedRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.72)", flex: 1, justifyContent: "flex-end", padding: spacing.md },
  optionDivider: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
  optionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 52, paddingVertical: spacing.sm },
  optionSheet: { backgroundColor: colors.surface.card, borderRadius: radii.sheet, maxHeight: "84%", padding: spacing.md },
  pickerCopy: { flex: 1, gap: spacing.xs },
  pickerField: { alignItems: "center", backgroundColor: colors.surface.elevated, borderRadius: radii.button, flexDirection: "row", minHeight: interaction.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pressed: { opacity: interaction.pressedOpacity },
  section: { gap: spacing.md },
});
