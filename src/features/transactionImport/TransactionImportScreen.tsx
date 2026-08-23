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
import { transactionImportSources } from "@/src/domain/transactionImportSources";
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
        <SectionHeader title="Choose a source" />
        <AppText color="secondary">Files stay on this device. Select the export format before adding history.</AppText>
        <View style={styles.modeRow}>
          {transactionImportSources.map((source) => (
            <ModeButton
              active={controller.sourceId === source.id}
              description={source.description}
              key={source.id}
              onPress={() => controller.setSourceId(source.id)}
              testID={`transaction-import-source-${source.id}`}
              title={source.label}
            />
          ))}
        </View>
        <View style={styles.divider} />
        <SectionHeader title="How should history be applied?" />
        <View style={styles.modeRow}>
          <ModeButton
            active={controller.mode === "supplemental"}
            description="Keep your opening balances; add only later activity."
            onPress={() => controller.setMode("supplemental")}
            testID="transaction-import-mode-supplemental"
            title="Supplemental"
          />
          <ModeButton
            active={controller.mode === "fullHistory"}
            description="Replace an opening balance only after exact reconciliation."
            onPress={() => controller.setMode("fullHistory")}
            testID="transaction-import-mode-full-history"
            title="Full history"
          />
        </View>
        <AppText color="secondary" variant="caption">Each file can contain up to {controller.maxRows} rows and 1 MB. Unsupported events stay visible and are never guessed.</AppText>
        {controller.sourceId === "cogvestCsvV1" ? <>
          <AppButton disabled={!props.saveCsvTemplate || isSavingTemplate || controller.isResolving || controller.isSaving} onPress={saveTemplate} testID="save-transaction-csv-template" title={isSavingTemplate ? "Saving template..." : "Save CSV template"} variant="secondary" />
          {templateStatus ? <AppText color="secondary" testID="transaction-csv-template-status" variant="caption">{templateStatus}</AppText> : null}
        </> : <AppText color="secondary" variant="caption">Console exports at most 365 days per Tradebook. Add up to {controller.maxFiles} annual files; overlapping trades are detected before import.</AppText>}
        {controller.files.length > 0 ? <View style={styles.fileList}>
          {controller.files.map((file, index) => <View key={file.id} style={styles.fileRow} testID={`transaction-import-file-${index}`}>
            <View style={styles.fileDetails}>
              <AppText numberOfLines={1} weight="bold">{index + 1}. {file.name}</AppText>
              <AppText color="secondary" variant="caption">{Math.max(1, Math.ceil(file.size / 1024))} KB</AppText>
            </View>
            {index > 0 ? <IconButton accessibilityLabel={`Move ${file.name} earlier`} icon="chevron-up" onPress={() => controller.moveFile(file.id, -1)} testID={`transaction-import-file-${index}-up`} /> : null}
            {index < controller.files.length - 1 ? <IconButton accessibilityLabel={`Move ${file.name} later`} icon="chevron-down" onPress={() => controller.moveFile(file.id, 1)} testID={`transaction-import-file-${index}-down`} /> : null}
            <IconButton accessibilityLabel={`Remove ${file.name}`} icon="trash-outline" onPress={() => controller.removeFile(file.id)} testID={`transaction-import-file-${index}-remove`} />
          </View>)}
        </View> : null}
        <AppButton disabled={controller.isResolving || controller.isSaving || (controller.sourceId === "zerodhaTradebookEqV1" && controller.files.length >= controller.maxFiles)} onPress={controller.selectFile} testID="select-transaction-csv" title={controller.sourceId === "zerodhaTradebookEqV1" ? (controller.files.length > 0 ? "Add another Tradebook" : "Add Tradebook CSV") : (controller.files.length > 0 ? "Choose another CSV" : "Choose CSV")} />
      </PremiumCard>

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

      {controller.sourceId === "zerodhaTradebookEqV1" && controller.mode === "fullHistory" && controller.files.length > 0 ? <PremiumCard style={styles.card} testID="transaction-import-source-coverage">
        <SectionHeader title="Confirm history coverage" />
        <AppText color="secondary">Zerodha stores IPO/OFS allotments, buybacks, transfers, and corporate actions outside the normal Tradebook.</AppText>
        <Pressable
          accessibilityLabel="Confirm no Zerodha external activity"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: controller.externalActivityConfirmed }}
          onPress={() => controller.setExternalActivityConfirmed(!controller.externalActivityConfirmed)}
          style={({ pressed }) => [styles.coverageControl, controller.externalActivityConfirmed && styles.coverageControlSelected, pressed && styles.pressed]}
          testID="transaction-import-no-external-activity"
        >
          <AppText color={controller.externalActivityConfirmed ? "primary" : "secondary"} weight="bold">I confirm these date ranges had no external trades or corporate actions.</AppText>
        </Pressable>
        <AppText color="secondary" variant="caption">If that is uncertain, use Supplemental so existing opening balances stay intact.</AppText>
      </PremiumCard> : null}

      {controller.groups.length > 0 || controller.unsupportedEvents.length > 0 ? <PremiumCard elevated style={styles.card} testID="transaction-import-dry-run">
        <SectionHeader title="Review before importing" />
        <View style={styles.summaryGrid}>
          <Summary label="New transactions" testID="transaction-import-summary-additions" value={`${controller.plan.summary.additions}`} />
          <Summary label="Duplicate rows" testID="transaction-import-summary-duplicates" value={`${controller.plan.duplicates}`} />
          <Summary label="Conflicts" testID="transaction-import-summary-conflicts" value={`${controller.plan.conflicts}`} />
          <Summary label="Unsupported" testID="transaction-import-summary-unsupported" value={`${controller.unsupportedCount}`} />
        </View>
        {controller.unsupportedEvents.length > 0 ? <View style={styles.unsupported}>
          <AppText color="secondary" variant="caption" weight="bold">Skipped unsupported events</AppText>
          {controller.unsupportedEvents.map((event) => <AppText key={`${event.rowNumber}-${event.transactionType}`} color="secondary" variant="caption">Row {event.rowNumber}: {event.transactionType}{event.reason ? ` • ${event.reason}` : ""}</AppText>)}
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

function Summary({
  label,
  testID,
  value,
}: {
  label: string;
  testID: string;
  value: string;
}) {
  return (
    <View style={styles.summary}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <AppText testID={testID} weight="bold">
        {value}
      </AppText>
    </View>
  );
}

function ErrorCard({ message, testID }: { message: string; testID?: string }) {
  return <PremiumCard testID={testID}><AppText style={styles.error} weight="bold">{message}</AppText></PremiumCard>;
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  card: { gap: spacing.md },
  coverageControl: { backgroundColor: colors.surface.elevated, borderRadius: radii.button, minHeight: 56, padding: spacing.md },
  coverageControlSelected: { borderColor: colors.primary, borderWidth: 1 },
  divider: { backgroundColor: colors.border.subtle, height: StyleSheet.hairlineWidth },
  error: { color: colors.loss },
  fileDetails: { flex: 1, gap: spacing.xs },
  fileList: { gap: spacing.sm },
  fileRow: { alignItems: "center", backgroundColor: colors.surface.elevated, borderRadius: radii.button, flexDirection: "row", gap: spacing.xs, minHeight: 64, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  holdingPreview: { borderTopColor: colors.border.subtle, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingTop: spacing.sm },
  modeButton: { backgroundColor: colors.surface.elevated, borderRadius: radii.card, flex: 1, gap: spacing.xs, minHeight: 96, padding: spacing.md },
  modeButtonActive: { borderColor: colors.primary, borderWidth: 1 },
  modeRow: { flexDirection: "row", gap: spacing.sm },
  pressed: { opacity: 0.78 },
  section: { gap: spacing.cardGap },
  summary: { flexBasis: "42%", flexGrow: 1, gap: spacing.xs },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  unsupported: { gap: spacing.xs },
});
