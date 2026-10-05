import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  getAdaptiveLayoutMode,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import {
  instrumentTypeOptions,
  sectorTypeLabel,
  sectorTypeOptions,
} from "@/src/domain/assets";
import { getOpeningPositionHistoryDate } from "@/src/domain/openingPositions";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { interaction, radii, spacing, createThemedStyles } from "@/src/theme";
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
  if (reason === "linkedDemerger") {
    return "This holding is linked to a demerger. Its parent and successor history must be corrected together.";
  }
  return "Check the asset details before saving.";
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
  const styles = useStyles();
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel =
    label === "Asset class"
      ? assetClassLabel(value as AssetClass)
      : label === "Sector"
        ? sectorTypeLabel(value as SectorType)
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
                    : label === "Sector"
                      ? sectorTypeLabel(option as SectorType)
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
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { fontScale, width } = useWindowDimensions();
  const stackActions = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
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
  const deleteReviewButtonRef = useRef<View>(null);
  const keepAssetButtonRef = useRef<View>(null);
  const actionInFlightRef = useRef(false);

  useEffect(() => {
    if (!isConfirmingDelete) return;

    const frame = requestAnimationFrame(() => {
      const handle = findNodeHandle(keepAssetButtonRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    });

    return () => cancelAnimationFrame(frame);
  }, [isConfirmingDelete]);

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
      .map((position) =>
        getOpeningPositionHistoryDate(position)?.slice(0, 7),
      )
      .filter((month): month is string => month !== undefined),
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
  const deletionImpact = `Removes ${impact.openingPositions} opening position${impact.openingPositions === 1 ? "" : "s"}, ${impact.trades} transaction${impact.trades === 1 ? "" : "s"}, ${impact.linkedCashEntries} linked cash movement${impact.linkedCashEntries === 1 ? "" : "s"}, ${impact.quotes} current quote${impact.quotes === 1 ? "" : "s"}, and ${impact.historicalQuotes} historical quote${impact.historicalQuotes === 1 ? "" : "s"}. Manual cash entries and manual snapshots stay intact.`;
  const snapshotImpact = `${impact.automaticSnapshots} automatic monthly snapshot${impact.automaticSnapshots === 1 ? "" : "s"} may be recalculated from the remaining records.`;

  function dismissDeleteConfirmation() {
    setIsConfirmingDelete(false);
    requestAnimationFrame(() => {
      const handle = findNodeHandle(deleteReviewButtonRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    });
  }

  function correctedAsset(): Asset {
    return {
      ...stableAsset,
      assetClass,
      currency: stableAsset.currency,
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
        <ScreenHeader title="Review Asset" subtitle={stableAsset.name} />

        <PremiumCard section style={styles.section}>
          <SectionHeader title="Identity" />
          <FormTextField label="Name" onChangeText={setName} testID="asset-name-input" value={name} />
          <FormTextField label="Symbol" onChangeText={setSymbol} testID="asset-symbol-input" value={symbol} />
          <View style={[styles.fixedRow, stackActions && styles.stacked]}>
            <AppText color="secondary">Native currency</AppText>
            <AppText weight="bold" testID="asset-native-currency">{stableAsset.currency}</AppText>
          </View>
          {getV1AssetCurrencyIssue(stableAsset) ? <AppText color="secondary" variant="caption">{getV1AssetCurrencyIssue(stableAsset)}</AppText> : null}
          {stableAsset.isin ? <View style={[styles.fixedRow, stackActions && styles.stacked]}>
            <AppText color="secondary">ISIN</AppText>
            <AppText testID="asset-fixed-isin">{stableAsset.isin}</AppText>
          </View> : null}
        </PremiumCard>

        <PremiumCard section style={styles.section}>
          <SectionHeader title="Price matching" />
          <FormTextField label="Ticker" onChangeText={setTicker} testID="asset-ticker-input" value={ticker} />
          <ChoiceGroup label="Exchange" onChange={setExchange} options={exchanges} testIDPrefix="asset-exchange" value={exchange} />
          <FormTextField label="Price lookup symbol" onChangeText={setQuoteSourceId} testID="asset-provider-id-input" value={quoteSourceId} />
          <AppText color="secondary" variant="caption">Used to refresh this asset's market price. Change it only when the current quote belongs to the wrong instrument.</AppText>
        </PremiumCard>

        <PremiumCard section style={styles.section}>
          <SectionHeader title="Classification" />
          <ChoiceGroup label="Asset class" onChange={setAssetClass} options={assetClasses} testIDPrefix="asset-class" value={assetClass} />
          <ChoiceGroup label="Instrument" onChange={setInstrumentType} options={instrumentTypeOptions} testIDPrefix="asset-instrument" value={instrumentType} />
          <ChoiceGroup label="Sector" onChange={setSectorType} options={sectorTypeOptions} testIDPrefix="asset-sector" value={sectorType} />
          <ChoiceGroup label="Tax eligibility" onChange={(value) => setIsTaxEligible(value === "eligible")} options={["eligible", "notEligible"] as const} testIDPrefix="asset-tax" value={isTaxEligible ? "eligible" : "notEligible"} />
        </PremiumCard>

        {error && !isConfirmingDelete ? <AppText accessibilityLiveRegion="polite" style={styles.error} variant="caption">{error}</AppText> : null}

        <View style={[styles.actions, stackActions && styles.stacked]}>
          <AppButton disabled={isSaving} onPress={onCancel} testID="cancel-asset-correction-button" title="Cancel" variant="secondary" />
          <AppButton disabled={isSaving} onPress={save} testID="save-asset-correction-button" title={isSaving ? "Saving…" : "Save asset"} />
        </View>

        <PremiumCard style={styles.dangerCard}>
          <SectionHeader title="Delete asset and history" />
          <AppText color="secondary" variant="caption">
            {deletionImpact}
          </AppText>
          <AppText color="secondary" variant="caption">
            {snapshotImpact}
          </AppText>
          <AppButton
            buttonRef={deleteReviewButtonRef}
            disabled={isSaving}
            onPress={() => { setError(undefined); setIsConfirmingDelete(true); }}
            testID="delete-asset-button"
            title="Review deletion"
            variant="ghost"
            textColor="primary"
          />
        </PremiumCard>

        <Modal
          animationType="fade"
          onRequestClose={dismissDeleteConfirmation}
          statusBarTranslucent
          testID="asset-deletion-confirmation"
          transparent
          visible={isConfirmingDelete}
        >
          <SafeAreaView edges={["top", "right", "bottom", "left"]} style={styles.confirmationBackdrop}>
            <View
              accessibilityViewIsModal
              importantForAccessibility="yes"
              style={styles.confirmationSheet}
              testID="asset-deletion-sheet"
            >
              <ScrollView
                contentContainerStyle={styles.confirmationContent}
                showsVerticalScrollIndicator
                style={styles.confirmationScroll}
                testID="asset-deletion-content"
              >
                <SectionHeader title={`Delete ${stableAsset.name}?`} />
                <AppText color="secondary">
                  This permanently removes this asset and its linked portfolio history.
                </AppText>
                <AppText color="secondary">{deletionImpact}</AppText>
                <AppText color="secondary">{snapshotImpact}</AppText>
                {error ? <AppText accessibilityLiveRegion="polite" style={styles.error} testID="asset-deletion-error">{error}</AppText> : null}
              </ScrollView>
              <View style={styles.confirmationActions}>
                <AppButton
                  buttonRef={keepAssetButtonRef}
                  disabled={isSaving}
                  onPress={dismissDeleteConfirmation}
                  testID="keep-asset-button"
                  title="Keep asset"
                  variant="secondary"
                />
                <AppButton disabled={isSaving} onPress={deleteAsset} testID="confirm-delete-asset-button" title="Delete permanently" variant="destructive" />
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stacked: { flexDirection: "column" },
  confirmationActions: { gap: spacing.sm },
  confirmationBackdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: "center", padding: spacing.md },
  confirmationContent: { gap: spacing.md, paddingBottom: spacing.sm },
  confirmationScroll: { flexShrink: 1 },
  confirmationSheet: { backgroundColor: colors.surface.card, borderRadius: radii.sheet, gap: spacing.md, maxHeight: "100%", padding: spacing.lg },
  content: { gap: spacing.cardGap },
  dangerCard: { gap: spacing.md },
  error: { color: colors.loss },
  fixedRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between", paddingVertical: spacing.sm },
  modalBackdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: "flex-end", padding: spacing.md },
  optionDivider: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth },
  optionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 52, paddingVertical: spacing.sm },
  optionSheet: { backgroundColor: colors.surface.card, borderRadius: radii.sheet, maxHeight: "84%", padding: spacing.md },
  pickerCopy: { flex: 1, gap: spacing.xs },
  pickerField: { alignItems: "center", backgroundColor: colors.surface.elevated, borderRadius: radii.button, flexDirection: "row", minHeight: interaction.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pressed: { opacity: interaction.pressedOpacity },
  section: { gap: spacing.md },
}));
