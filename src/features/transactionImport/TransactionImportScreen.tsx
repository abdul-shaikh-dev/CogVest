import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField } from "@/src/components/forms";
import { formatCurrency } from "@/src/domain/formatters";
import type { AssetLookupSearchResult } from "@/src/services/assetLookup";
import type { PortfolioStoreState, TransactionImportCommandResult } from "@/src/store";
import { colors, radii, spacing } from "@/src/theme";

import type { PickedTransactionCsv } from "./useTransactionImport";
import { useTransactionImport } from "./useTransactionImport";

type TransactionImportScreenProps = {
  now?: () => Date;
  onCancel: () => void;
  onImported: (result: TransactionImportCommandResult) => void;
  pickCsvFile: () => Promise<PickedTransactionCsv | undefined>;
  saveCsvTemplate?: () => Promise<string | undefined>;
  searchAssetLookupResults?: (input: { query: string }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

export function TransactionImportScreen(props: TransactionImportScreenProps) {
  const controller = useTransactionImport(props);
  const [templateStatus, setTemplateStatus] = useState<string>();
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  async function saveTemplate() {
    if (!props.saveCsvTemplate || isSavingTemplate) return;
    setIsSavingTemplate(true);
    try {
      const name = await props.saveCsvTemplate();
      if (name) setTemplateStatus(`${name} saved. Replace the example rows, then choose the completed CSV.`);
    } catch {
      setTemplateStatus("The template could not be saved. Choose another folder and try again.");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  const affectedWithoutCutover = controller.cutoverHoldings;

  return (
    <ScreenContainer scroll testID="transaction-import-screen">
      <ScreenHeader
        leading={<IconButton accessibilityLabel="Go back" icon="chevron-back" onPress={props.onCancel} testID="transaction-import-back" />}
        subtitle="Versioned history • local only"
        title="Import transaction history"
      />

      <PremiumCard style={styles.card}>
        <SectionHeader title="Choose the import" />
        <AppText color="secondary">Import historical buys, sells, and costed transfers. CogVest will never recreate historical Cash Ledger entries.</AppText>
        <View style={styles.modeRow}>
          <ModeButton active={controller.mode === "supplemental"} description="Keep your opening balances; add only later activity." onPress={() => controller.setMode("supplemental")} testID="transaction-import-mode-supplemental" title="Supplemental" />
          <ModeButton active={controller.mode === "fullHistory"} description="Replace an opening balance only after exact reconciliation." onPress={() => controller.setMode("fullHistory")} testID="transaction-import-mode-full-history" title="Full history" />
        </View>
        <AppText color="secondary" variant="caption">Up to {controller.maxRows} rows and 1 MB. Unsupported events are listed for review and never guessed.</AppText>
        <AppButton disabled={!props.saveCsvTemplate || isSavingTemplate || controller.isResolving || controller.isSaving} onPress={saveTemplate} testID="save-transaction-csv-template" title={isSavingTemplate ? "Saving template..." : "Save CSV template"} variant="secondary" />
        {templateStatus ? <AppText color="secondary" testID="transaction-csv-template-status" variant="caption">{templateStatus}</AppText> : null}
        <AppButton disabled={controller.isResolving || controller.isSaving} onPress={controller.selectFile} testID="select-transaction-csv" title={controller.fileName ? "Choose another CSV" : "Choose CSV"} />
      </PremiumCard>

      {controller.fileName ? <AppText color="secondary" variant="caption">Selected: {controller.fileName}</AppText> : null}
      {controller.isResolving ? <PremiumCard testID="transaction-import-resolving"><AppText weight="bold">Checking transaction rows and matching holdings...</AppText><AppText color="secondary" variant="caption">Nothing changes until you confirm the dry run.</AppText></PremiumCard> : null}
      {controller.screenError ? <ErrorCard message={controller.screenError} testID="transaction-import-screen-error" /> : null}
      {controller.parseErrors.map((error, index) => <ErrorCard key={`${error.code}-${error.rowNumber ?? index}`} message={`${error.rowNumber ? `Row ${error.rowNumber}: ` : ""}${error.message}`} />)}

      {controller.groups.length > 0 ? <View style={styles.section}>
        <SectionHeader title="Resolve holdings" />
        {controller.groups.map((group) => <PremiumCard key={group.key} testID={`transaction-import-asset-${group.key}`}>
          <AppText weight="bold">{group.title}</AppText>
          <AppText color="secondary" variant="caption">{group.rowNumbers.length} transaction {group.rowNumbers.length === 1 ? "row" : "rows"}</AppText>
          {group.selectedAsset ? <AppText color="secondary" variant="caption">Matched: {group.selectedAsset.name} • {group.selectedAsset.ticker}</AppText> : null}
          {!group.selectedAsset && group.candidates.length === 0 ? <AppText color="secondary" variant="caption">No matching asset was found. Add this holding first, then return to import its history.</AppText> : null}
          {group.candidates.length > 0 ? <View style={styles.actions}>
            <AppText color="secondary" variant="caption">Select the matching asset. CogVest will not choose a provider result for you.</AppText>
            {group.candidates.slice(0, 6).map((candidate) => <AppButton key={candidate.id} onPress={() => controller.selectCandidate(group.key, candidate)} testID={`transaction-import-asset-${group.key}-candidate-${candidate.id}`} title={`${candidate.name} • ${candidate.ticker}`} variant="secondary" />)}
          </View> : null}
        </PremiumCard>)}
      </View> : null}

      {affectedWithoutCutover.length > 0 ? <PremiumCard style={styles.card} testID="transaction-import-cutover">
        <SectionHeader title="Holdings measured as of" />
        <AppText color="secondary">Tell CogVest when your existing opening balances were measured. This prevents history from being counted twice.</AppText>
        {controller.needsSharedCutover ? <DatePickerField label="Use this date for holdings without one" maximumDate={controller.today} onChange={controller.setSharedCutover} testID="transaction-import-shared-cutover" value={controller.sharedCutover} /> : null}
        {controller.sharedCutover ? <AppText color="secondary" variant="caption">Adjust an individual holding only when its balance was measured on a different date.</AppText> : null}
        {affectedWithoutCutover.filter(({ position }) => position.measuredAsOf || controller.sharedCutover).map(({ asset, position }) => <DatePickerField key={position.id} label={`${asset.name} measured as of`} maximumDate={controller.today} onChange={(value) => controller.setCutover(position.id, value)} testID={`transaction-import-cutover-${position.id}`} value={controller.cutoverByOpeningPositionId[position.id] ?? position.measuredAsOf ?? controller.sharedCutover} />)}
      </PremiumCard> : null}

      {controller.groups.length > 0 || controller.unsupportedEvents.length > 0 ? <PremiumCard elevated style={styles.card} testID="transaction-import-dry-run">
        <SectionHeader title="Review before importing" />
        <View style={styles.summaryGrid}>
          <Summary label="New transactions" value={`${controller.plan.summary.additions}`} />
          <Summary label="Duplicate rows" value={`${controller.plan.duplicates}`} />
          <Summary label="Conflicts" value={`${controller.plan.conflicts}`} />
          <Summary label="Unsupported" value={`${controller.unsupportedCount}`} />
        </View>
        {controller.unsupportedEvents.length > 0 ? <View style={styles.unsupported}>
          <AppText color="secondary" variant="caption" weight="bold">Skipped unsupported events</AppText>
          {controller.unsupportedEvents.map((event) => <AppText key={`${event.rowNumber}-${event.transactionType}`} color="secondary" variant="caption">Row {event.rowNumber}: {event.transactionType}</AppText>)}
        </View> : null}
        {controller.groups.length === 0 && controller.unsupportedEvents.length > 0 ? <AppText color="secondary" variant="caption">This file has no supported transaction rows to import.</AppText> : null}
        <AppText color="secondary" variant="caption">Cash Ledger is unchanged. Fees and taxes stay with imported transaction metadata; V1 does not calculate tax lots.</AppText>
        {controller.plan.holdings.map((holding) => <View key={holding.asset.id} style={styles.holdingPreview}>
          <AppText weight="bold">{holding.asset.name}</AppText>
          <AppText color="secondary" testID={`transaction-import-holding-summary-${holding.asset.id}`} variant="caption">{holding.importedTransactions} transactions • {holding.reconciliation.quantity} units • average cost {formatCurrency(holding.reconciliation.averageCostPrice, holding.asset.currency)}</AppText>
          {holding.cutover ? <AppText color="secondary" variant="caption">Holdings measured as of {holding.cutover}</AppText> : null}
          {controller.mode === "fullHistory" && holding.baseline ? <AppText color={holding.replacementExact ? "primary" : "secondary"} testID={`transaction-import-replacement-${holding.asset.id}`} variant="caption">{holding.replacementExact ? "Opening balance will be replaced after confirmation." : "Opening balance is kept until history reconciles exactly."}</AppText> : null}
        </View>)}
        {controller.plan.errors.map((error, index) => <ErrorCard key={`${error.code}-${error.rowNumber ?? index}`} message={`${error.rowNumber ? `Row ${error.rowNumber}: ` : ""}${error.message}`} />)}
        <AppButton disabled={!controller.plan.command || controller.isSaving} onPress={controller.confirmImport} testID="confirm-transaction-import" title={controller.isSaving ? "Importing..." : "Confirm transaction import"} />
      </PremiumCard> : null}
    </ScreenContainer>
  );
}

function ModeButton({ active, description, onPress, testID, title }: { active: boolean; description: string; onPress: () => void; testID: string; title: string }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]} testID={testID}><AppText weight="bold">{title}</AppText><AppText color="secondary" variant="caption">{description}</AppText></Pressable>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <View style={styles.summary}><AppText color="secondary" variant="caption">{label}</AppText><AppText weight="bold">{value}</AppText></View>;
}

function ErrorCard({ message, testID }: { message: string; testID?: string }) {
  return <PremiumCard testID={testID}><AppText style={styles.error} weight="bold">{message}</AppText></PremiumCard>;
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  card: { gap: spacing.md },
  error: { color: colors.loss },
  holdingPreview: { borderTopColor: colors.border.subtle, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingTop: spacing.sm },
  modeButton: { backgroundColor: colors.surface.elevated, borderRadius: radii.card, flex: 1, gap: spacing.xs, minHeight: 96, padding: spacing.md },
  modeButtonActive: { borderColor: colors.primary, borderWidth: 1 },
  modeRow: { flexDirection: "row", gap: spacing.sm },
  section: { gap: spacing.cardGap },
  summary: { flexBasis: "42%", flexGrow: 1, gap: spacing.xs },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  unsupported: { gap: spacing.xs },
});
