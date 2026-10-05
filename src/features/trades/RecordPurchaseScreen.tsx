import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard, KeyboardAvoidingView, Modal, StyleSheet, View, useWindowDimensions } from "react-native";
import { useFocusEffect, usePreventRemove } from "@react-navigation/native";
import type { StoreApi } from "zustand/vanilla";
import { AppButton, AppText, IconButton, MaskedValue, PremiumCard, ScreenContainer, ScreenHeader, SectionHeader, getAdaptiveLayoutMode } from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { calculateCashBalance } from "@/src/domain/calculations";
import { formatINR } from "@/src/domain/formatters";
import { searchSavedAssets } from "@/src/features/openingPositions/assetDiscovery";
import { DiscoveryResults } from "@/src/features/openingPositions/DiscoveryResults";
import { AssetSearchField } from "@/src/features/openingPositions/AssetSearchField";
import { EntryProgress } from "@/src/components/common/EntryProgress";
import { searchAssetLookupResults, type AssetLookupSearchResult } from "@/src/services/assetLookup";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";
import { createId } from "@/src/utils";
import { useRecordPurchase } from "./useRecordPurchase";

type Props = {
  initialAssetId?: string; now?: Date; onCancel: () => void; onSaved: () => void;
  store?: StoreApi<PortfolioStoreState>;
  searchAssets?: typeof searchAssetLookupResults;
};

export function RecordPurchaseScreen({ initialAssetId, now = new Date(), onCancel, onSaved,
  store = getPortfolioStore(), searchAssets = searchAssetLookupResults }: Props) {
  const styles = useStyles();
  const flow = useRecordPurchase({ initialAssetId, now, store });
  const { fontScale } = useWindowDimensions();
  const stackCash = getAdaptiveLayoutMode(fontScale) !== "standard";
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<AssetLookupSearchResult>();
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [exitPrompt, setExitPrompt] = useState(false);
  const [exitAllowed, setExitAllowed] = useState(false);
  const operation = useRef<AbortController | undefined>(undefined);
  const masked = flow.snapshot.preferences.maskWealthValues;
  const savedAssets = searchSavedAssets(flow.snapshot.assets, query).filter((asset) => asset.instrumentType !== "ppf");
  const dirty = flow.hasDraft || Boolean(query.trim());

  function requestExit() {
    Keyboard.dismiss();
    if (dirty) setExitPrompt(true);
    else setExitAllowed(true);
  }
  function back() {
    Keyboard.dismiss();
    if (flow.phase === "review") flow.setPhase("details");
    else if (flow.phase === "details") flow.setPhase("asset");
    else requestExit();
  }
  usePreventRemove(!exitAllowed && !flow.saved && dirty, back);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => listener.remove();
  }, [flow.phase, dirty]));
  useEffect(() => { if (exitAllowed) onCancel(); }, [exitAllowed, onCancel]);
  useEffect(() => { if (flow.saved) onSaved(); }, [flow.saved, onSaved]);
  useEffect(() => () => operation.current?.abort(), []);

  async function search() {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setSearching(true);
    setLookup(undefined);
    Keyboard.dismiss();
    try {
      const result = await searchAssets({ query: query.trim(), signal: controller.signal });
      if (!controller.signal.aborted) { setLookup(result); setPage(1); }
    } catch {
      if (!controller.signal.aborted) setLookup({ failures: ["unavailable"], results: [] });
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }
  const pricePending = flow.asset && !flow.snapshot.quoteCache[flow.asset.id];

  return <KeyboardAvoidingView style={styles.flex} behavior="height">
    <ScreenContainer scroll testID="record-purchase-screen">
      <View style={styles.content}>
        <ScreenHeader title={flow.phase === "review" ? "Review purchase" : "Record purchase"} subtitle={flow.phase === "review" ? undefined : "From Cash to investment"}
          leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={back} testID="purchase-back" />} />
        <EntryProgress label="Record purchase progress" step={flow.phase === "asset" ? 1 : flow.phase === "details" ? 2 : 3} total={3} />
        {flow.phase === "asset" ? <PremiumCard testID="purchase-phase-asset">
          <AssetSearchField value={query} testID="purchase-search" onChangeText={(value) => {
            operation.current?.abort(); setSearching(false); setQuery(value); setLookup(undefined);
          }} onSubmitEditing={search} returnKeyType="search" />
          <AppButton title={searching ? "Searching…" : "Search listings"} disabled={searching || !query.trim()} onPress={search} testID="purchase-search-button" variant="secondary" />
          {flow.errors.asset ? <AppText style={styles.error}>{flow.errors.asset}</AppText> : null}
          {savedAssets.length ? <AppText color="secondary" variant="caption" weight="medium">Saved assets</AppText> : null}
          <DiscoveryResults kind="saved" items={savedAssets.slice(0, page * 20)} onSelect={(asset) => { Keyboard.dismiss(); flow.selectAsset(asset); }} />
          {savedAssets.length > page * 20 ? <AppButton title="More saved investments" variant="ghost" onPress={() => setPage(page + 1)} /> : null}
          {lookup ? <>
            {lookup.results.length ? <AppText color="secondary" variant="caption" weight="medium">Listings</AppText> : null}
            <DiscoveryResults kind="provider" items={lookup.results.slice(0, page * 20)} onSelect={(result) => {
              flow.selectAsset({
                id: createId("asset"), assetClass: result.assetClass, currency: result.currency,
                exchange: result.exchange, instrumentType: result.instrumentType,
                name: result.name, quoteSourceId: result.quoteSourceId, sectorType: result.sectorType,
                symbol: result.symbol, ticker: result.ticker,
              });
              Keyboard.dismiss();
            }} />
            {lookup.results.length > page * 20 ? <AppButton title="More listings" variant="ghost" onPress={() => setPage(page + 1)} /> : null}
            {lookup.failures.length ? <AppText color="secondary">Some listings are unavailable. Retry search or use a saved investment.</AppText> : null}
            {!lookup.failures.length && !lookup.results.length ? <AppText color="secondary">No matching listings. Try the name or symbol.</AppText> : null}
          </> : null}
        </PremiumCard> : <>
          <View style={styles.asset}>
            <AppText weight="bold">{flow.asset?.name}</AppText>
            <AppText color="secondary">{flow.asset?.symbol} · {flow.asset?.exchange ?? "Saved investment"} · {flow.asset?.currency}</AppText>
            {pricePending ? <AppText color="secondary" variant="caption">Current price unavailable. Purchase price only records your cost.</AppText> : null}
          </View>
          {flow.phase === "details" ? <PremiumCard section>
            <SectionHeader title="Purchase details" />
            <FormTextField label="Quantity" keyboardType="decimal-pad" value={flow.values.quantity} error={flow.errors.quantity} onChangeText={(value) => flow.update("quantity", value)} testID="purchase-quantity" />
            <FormTextField label="Price per unit (INR)" keyboardType="decimal-pad" value={flow.values.pricePerUnit} error={flow.errors.pricePerUnit} onChangeText={(value) => flow.update("pricePerUnit", value)} testID="purchase-price" />
            <FormTextField label="Fees (INR)" keyboardType="decimal-pad" value={flow.values.fees} error={flow.errors.fees} onChangeText={(value) => flow.update("fees", value)} placeholder="0" testID="purchase-fees" />
            <DatePickerField label="Purchase date" maximumDate={now} value={flow.values.date} error={flow.errors.date} onChange={(value) => flow.update("date", value)} testID="purchase-date" />
            <FormTextField label="Note (optional)" value={flow.values.notes} onChangeText={(value) => flow.update("notes", value)} multiline testID="purchase-note" />
          </PremiumCard> : <PremiumCard testID="purchase-review">
            <SectionHeader title="Purchase details" />
            <View style={styles.reviewGrid}>
              <ReviewValue label="Quantity" value={`${flow.review?.quantity ?? 0}`} testID="purchase-review-quantity" />
              <ReviewValue label="Price per unit" value={formatINR(flow.review?.pricePerUnit ?? 0)} testID="purchase-review-price" />
              <ReviewValue label="Fees" value={formatINR(flow.review?.fees ?? 0)} testID="purchase-review-fees" />
              <ReviewValue label="Purchase date" value={flow.review?.date ?? ""} testID="purchase-review-date" />
            </View>
            <View style={[styles.cashImpact, stackCash && styles.cashImpactStacked]}>
              <View style={styles.cashValue}>
                <AppText color="secondary" variant="caption">Cash debit</AppText>
                <MaskedValue value={formatINR(flow.review?.totalValue ?? 0)} masked={masked} variant="title" weight="bold" testID="purchase-cash-debit" />
              </View>
              <View style={styles.cashValue}>
                <AppText color="secondary" variant="caption">Available Cash</AppText>
                <MaskedValue value={formatINR(calculateCashBalance(flow.snapshot.cashEntries, now))} masked={masked} weight="bold" testID="purchase-available-cash" />
              </View>
            </View>
            <AppText color="secondary" variant="caption">Saves the purchase and linked Cash withdrawal together.</AppText>
            {flow.errors.save ? <AppText style={styles.error} accessibilityRole="alert" testID="purchase-save-error">{flow.errors.save}</AppText> : null}
          </PremiumCard>}
          <AppButton title={flow.phase === "review" ? "Confirm purchase" : "Review purchase"}
            onPress={() => { Keyboard.dismiss(); if (flow.phase === "review") flow.save(); else flow.prepareReview(); }}
            disabled={flow.saved} testID={flow.phase === "review" ? "purchase-confirm" : "purchase-review-button"} />
        </>}
        <AppButton title="Cancel" variant="ghost" onPress={requestExit} testID="purchase-cancel" />
      </View>
    </ScreenContainer>
    <Modal visible={exitPrompt} transparent onRequestClose={() => setExitPrompt(false)}>
      <View style={styles.modal}><PremiumCard>
        <SectionHeader title="Discard purchase?" />
        <AppText color="secondary">This purchase has not been saved.</AppText>
        <AppButton title="Keep editing" onPress={() => setExitPrompt(false)} testID="purchase-keep-editing" />
        <AppButton title="Discard" variant="secondary" onPress={() => { setExitPrompt(false); setExitAllowed(true); }} testID="purchase-discard" />
      </PremiumCard></View>
    </Modal>
  </KeyboardAvoidingView>;
}

function ReviewValue({ label, value, testID }: { label: string; value: string; testID: string }) {
  const styles = useStyles();
  return <View style={styles.reviewValue}>
    <AppText color="secondary" variant="caption">{label}</AppText>
    <AppText style={styles.number} weight="bold" testID={testID}>{value}</AppText>
  </View>;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 }, content: { gap: spacing.lg }, asset: { gap: spacing.xs },
  error: { color: colors.loss },
  reviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  reviewValue: { flexBasis: "42%", flexGrow: 1, gap: spacing.xs },
  number: { fontVariant: ["tabular-nums"] },
  cashImpact: { flexDirection: "row", gap: spacing.md, borderTopColor: colors.border.subtle, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  cashImpactStacked: { flexDirection: "column" },
  cashValue: { flex: 1, gap: spacing.xs },
  modal: { flex: 1, justifyContent: "center", padding: spacing.screenHorizontal, backgroundColor: colors.background },
}));
