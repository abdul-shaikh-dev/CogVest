import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { formatCurrency } from "@/src/domain/formatters";
import { transactionImportSources } from "@/src/domain/transactionImportSources";
import { demergerCatalog } from "@/src/domain/demergers";
import { decimal } from "@/src/domain/precision";
import type { AssetLookupSearchResult } from "@/src/services/assetLookup";
import { casPdfMaxBytes, casPdfMaxPages } from "@/src/services/import-export";
import type { PortfolioStoreState, TransactionImportCommandResult } from "@/src/store";
import { colors, radii, spacing } from "@/src/theme";

import type {
  PickedCasStatement,
  PickedTransactionCsv,
  UseTransactionImportOptions,
} from "./useTransactionImport";
import { useTransactionImport } from "./useTransactionImport";
import { CasImportProblems } from "./CasImportProblems";
import type { Asset } from "@/src/types";

type TransactionImportScreenProps = {
  now?: () => Date;
  onCancel: () => void;
  onImported: (result: TransactionImportCommandResult) => void;
  pickCasStatement?: () => Promise<PickedCasStatement | undefined>;
  pickCsvFile: () => Promise<PickedTransactionCsv | undefined>;
  readCasStatement?: UseTransactionImportOptions["readCasStatement"];
  saveCsvTemplate?: () => Promise<string | undefined>;
  searchAssetLookupResults?: (input: { query: string }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

export function TransactionImportScreen(props: TransactionImportScreenProps) {
  const controller = useTransactionImport(props);
  const importDemergers = controller.plan.demergers?.filter((event) =>
    event.kind === "entitlement" && controller.plan.holdings.some((holding) =>
      holding.asset.id === event.sourceAssetId || holding.asset.id === event.assetId,
    ),
  ) ?? [];
  const scrollRef = useRef<ScrollView>(null);
  const sourceCardYRef = useRef<number | undefined>(undefined);
  const passwordFieldYRef = useRef<number | undefined>(undefined);
  const [statementReviewY, setStatementReviewY] = useState<number>();
  const [templateStatus, setTemplateStatus] = useState<string>();
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showMatched, setShowMatched] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [showHoldings, setShowHoldings] = useState(false);

  useEffect(() => {
    if (!controller.casReview || controller.isResolving || !statementReviewY) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, statementReviewY - spacing.md),
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [controller.casReview, controller.isResolving, statementReviewY]);

  function scrollPasswordIntoView() {
    if (!Keyboard.metrics() || sourceCardYRef.current === undefined || passwordFieldYRef.current === undefined) return;
    scrollRef.current?.scrollTo({ animated: false, y: Math.max(0, sourceCardYRef.current + passwordFieldYRef.current - spacing.md) });
  }

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      scrollPasswordIntoView();
    });
    return () => subscription.remove();
  }, []);

  function selectSource(sourceId: Parameters<typeof controller.setSourceId>[0]) {
    if (sourceId === controller.sourceId) return;
    passwordFieldYRef.current = undefined;
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
    controller.setSourceId(sourceId);
  }

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
  const identityConflicts = controller.groups.filter((group) => group.identityConflict);
  const unresolved = controller.groups.filter((group) => !group.selectedAsset && !group.identityConflict);
  const suggested = unresolved.filter((group) => group.suggestedAsset);
  const matched = controller.groups.filter((group) => group.selectedAsset && !group.identityConflict);
  const groupedErrors = [...controller.plan.errors.reduce((groups, error) => {
    if (error.code === "unresolvedAsset" || error.code === "ambiguousAsset") return groups;
    const key = `${error.code}:${error.assetId ?? ""}:${error.message}`;
    const prior = groups.get(key);
    groups.set(key, { error, count: (prior?.count ?? 0) + 1 });
    return groups;
  }, new Map<string, { error: (typeof controller.plan.errors)[number]; count: number }>()).values()];

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex} onLayout={() => {
      requestAnimationFrame(scrollPasswordIntoView);
    }}>
    <ScreenContainer scroll scrollRef={scrollRef} testID="transaction-import-screen">
      <ScreenHeader
        leading={<IconButton accessibilityLabel="Go back" icon="chevron-back" onPress={props.onCancel} testID="transaction-import-back" />}
        subtitle="Import your files • local only"
        title="Import transaction history"
      />

      <View onLayout={(event) => { sourceCardYRef.current = event.nativeEvent.layout.y; }} testID="transaction-import-source-card">
      <PremiumCard style={styles.card}>
        <SectionHeader title="Choose a source" />
        <AppText color="secondary">Files stay on this device. Select the export format before adding history.</AppText>
        <View style={styles.modeRow}>
          {transactionImportSources.map((source) => (
            <ModeButton
              active={controller.sourceId === source.id}
              description={source.description}
              key={source.id}
              onPress={() => selectSource(source.id)}
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
            title="Add later activity"
          />
          <ModeButton
            active={controller.mode === "fullHistory"}
            description="Replace an opening balance only after exact reconciliation."
            onPress={() => controller.setMode("fullHistory")}
            testID="transaction-import-mode-full-history"
            title="Rebuild from history"
          />
        </View>
        <AppText color="secondary" variant="caption">{controller.sourceId === "camsKfinCasPdfV1" ? `PDFs can contain up to ${casPdfMaxPages} pages and ${casPdfMaxBytes / (1024 * 1024)} MB.` : `Each file can contain up to ${controller.maxRows} rows and 1 MB.`} Unsupported events stay visible and are never guessed.</AppText>
        {controller.sourceId === "cogvestCsvV1" ? <>
          <AppButton disabled={!props.saveCsvTemplate || isSavingTemplate || controller.isResolving || controller.isSaving} onPress={saveTemplate} testID="save-transaction-csv-template" title={isSavingTemplate ? "Saving template..." : "Save CSV template"} variant="secondary" />
          {templateStatus ? <AppText color="secondary" testID="transaction-csv-template-status" variant="caption">{templateStatus}</AppText> : null}
        </> : controller.sourceId === "zerodhaTradebookEqV1" ? <AppText color="secondary" variant="caption">Console exports at most 365 days per Tradebook. Add up to {controller.maxFiles} annual files; overlapping trades are detected before import.</AppText> : <>
          <AppText color="secondary" variant="caption">Choose a detailed CAS PDF with transaction history. The statement is read on this device, and its password is never saved.</AppText>
          <View
            collapsable={false}
            onLayout={(event) => { passwordFieldYRef.current = event.nativeEvent.layout.y; }}
            testID="cas-statement-password-field"
          >
            <FormTextField
              label="PDF password (if required)"
              onChangeText={controller.setCasPassword}
              onFocus={() => {
                scrollPasswordIntoView();
              }}
              returnKeyType="done"
              secureTextEntry
              testID="cas-statement-password"
              value={controller.casPassword}
            />
          </View>
        </>}
        {controller.files.length > 0 ? <View style={styles.fileList}>
          {controller.files.map((file, index) => <View key={file.id} style={styles.fileRow} testID={`transaction-import-file-${index}`}>
            <View style={styles.fileDetails}>
              <AppText numberOfLines={1} weight="bold">{index + 1}. {/\.csv$/iu.test(file.name) ? file.name : "Tradebook CSV"}</AppText>
              <AppText color="secondary" variant="caption">{controller.fileSummaries[file.id] ?? `${Math.max(1, Math.ceil(file.size / 1024))} KB`}</AppText>
            </View>
            {index > 0 ? <IconButton accessibilityLabel={`Move ${file.name} earlier`} icon="chevron-up" onPress={() => controller.moveFile(file.id, -1)} testID={`transaction-import-file-${index}-up`} /> : null}
            {index < controller.files.length - 1 ? <IconButton accessibilityLabel={`Move ${file.name} later`} icon="chevron-down" onPress={() => controller.moveFile(file.id, 1)} testID={`transaction-import-file-${index}-down`} /> : null}
            <IconButton accessibilityLabel={`Remove ${file.name}`} icon="trash-outline" onPress={() => controller.removeFile(file.id)} testID={`transaction-import-file-${index}-remove`} />
          </View>)}
        </View> : null}
        {controller.sourceId === "camsKfinCasPdfV1" && controller.casSource ? <View style={styles.statementSelection} testID="cas-statement-selected">
          <View style={styles.fileDetails}>
            <AppText weight="bold">Statement selected</AppText>
            <AppText color="secondary" variant="caption">{Math.max(1, Math.ceil(controller.casSource.size / 1024))} KB{controller.casReview ? ` • ${controller.casReview.pageCount} pages` : ""}</AppText>
          </View>
          <AppButton disabled={controller.isResolving || controller.isSaving} onPress={controller.retryCasStatement} testID="read-cas-statement" title="Read statement" variant="secondary" />
        </View> : null}
        <AppButton disabled={controller.isResolving || controller.isSaving || (controller.sourceId === "zerodhaTradebookEqV1" && controller.files.length >= controller.maxFiles)} onPress={controller.selectFile} testID={controller.sourceId === "camsKfinCasPdfV1" ? "select-cas-statement" : "select-transaction-csv"} title={controller.sourceId === "camsKfinCasPdfV1" ? (controller.casSource ? "Choose another statement" : "Choose CAS PDF") : controller.sourceId === "zerodhaTradebookEqV1" ? (controller.files.length > 0 ? "Add another Tradebook" : "Add Tradebook CSV") : (controller.files.length > 0 ? "Choose another CSV" : "Choose CSV")} />
      </PremiumCard>

      </View>
      {controller.isResolving ? <PremiumCard testID="transaction-import-resolving"><AppText weight="bold">Checking transaction rows and matching holdings...</AppText><AppText color="secondary" variant="caption">Nothing changes until you confirm the dry run.</AppText></PremiumCard> : null}
      {controller.screenError ? <ErrorCard message={controller.screenError} testID="transaction-import-screen-error" /> : null}
      {controller.parseErrors.map((error, index) => <ErrorCard key={`${error.code}-${error.rowNumber ?? index}`} message={`${error.rowNumber ? `Row ${error.rowNumber}: ` : ""}${error.message}`} />)}
      {controller.casReview ? <View onLayout={(event) => {
        setStatementReviewY(event.nativeEvent.layout.y);
      }} style={styles.card}>
        <CasImportProblems problems={[
          ...controller.casReview.normalization.parserErrors,
          ...controller.casReview.normalization.errors,
        ]} />
        <PremiumCard style={styles.card} testID="cas-statement-review">
        <SectionHeader title="Statement review" />
        {controller.plan.errors.some((error) => error.code === "incompleteCasHistory") ? <View style={styles.card} testID="cas-opening-history-error">
          <AppText weight="bold">Earlier holdings need a starting balance</AppText>
          <AppText color="secondary">{controller.plan.errors.find((error) => error.code === "incompleteCasHistory")?.message}</AppText>
          <AppText color="secondary" variant="caption">Nothing has been imported. Do not remove statement rows to get past this check.</AppText>
        </View> : null}
        <AppText color="secondary">Review the schemes and printed balances before importing. Folio numbers stay private and appear only as statement-local labels.</AppText>
        {(controller.casReview.normalization.administrativeNotices ?? 0) > 0 ? <AppText color="secondary" variant="caption" testID="cas-administrative-notices">{controller.casReview.normalization.administrativeNotices} administrative notices identified (address updates or nominee registration). These are not investment transactions and do not change balances.</AppText> : null}
        {controller.casReview.normalization.coverage ? <AppText color="secondary" testID="cas-statement-coverage" variant="caption">Statement coverage: {controller.casReview.normalization.coverage.from} to {controller.casReview.normalization.coverage.to}</AppText> : null}
        {(controller.casReview.normalization.preservedNotices?.length ?? 0) > 0 ? <View style={styles.card} testID="cas-preserved-notices">
          <AppText weight="bold">Cancellation notice retained in this review</AppText>
          <AppText color="secondary" variant="caption">The statement lists a cancellation without financial values. Only the recorded transactions will be imported; no purchase or reversal is created from this notice. All printed unit balances must still reconcile.</AppText>
          {controller.casReview.normalization.preservedNotices?.map((notice) => <AppText key={`${notice.folioLabel}-${notice.rowNumber}`} color="secondary" variant="caption">{notice.folioLabel} · {notice.date} · Cancelled</AppText>)}
        </View> : null}
        {controller.casReview.normalization.schemes.map((scheme) => <View key={`${scheme.folioLabel}-${scheme.isin}`} style={styles.holdingPreview}>
          <View style={styles.reviewHeading}>
            <View style={styles.fileDetails}>
              <AppText weight="bold">{scheme.name}</AppText>
              <AppText color="secondary" variant="caption">{scheme.folioLabel} • {scheme.registrar} • {scheme.isin}</AppText>
            </View>
            <AppText weight="bold">{scheme.importableTransactions} ready</AppText>
          </View>
          <AppText color="secondary" variant="caption">Opening {scheme.openingUnits} units • Closing {scheme.closingUnits} units</AppText>
        </View>)}
        {controller.casReview.normalization.preservedCharges.length > 0 ? <AppText color="secondary" variant="caption" testID="cas-preserved-charges">{controller.casReview.normalization.preservedCharges.length} stamp-duty {controller.casReview.normalization.preservedCharges.length === 1 ? "entry is" : "entries are"} preserved as review evidence and not imported as a trade.</AppText> : null}
        </PremiumCard>
      </View> : null}

      {controller.groups.length > 0 ? <PremiumCard style={styles.card}>
        <SectionHeader title="Match your holdings" />
        <AppText color="secondary" testID="transaction-import-match-summary">{matched.length} matched • {unresolved.length} to confirm. Each choice applies to every transaction for that holding.</AppText>
        {identityConflicts.length > 0 ? <>
          <AppText testID="transaction-import-identity-conflicts" weight="bold">{identityConflicts.length} historical identities need corporate-action review</AppText>
          <AppText color="secondary">Different ISINs point to the same current listing. Their quantities cannot safely be combined yet. Keep the original rows; do not delete transactions to bypass this check. Corporate-action import support is needed before these histories can be combined.</AppText>
          {identityConflicts.map((group) => <HoldingMatch key={group.key} group={group} onSelect={controller.selectCandidate} />)}
        </> : null}
        <AppText color="secondary" testID="transaction-import-row-accounting">{controller.plan.summary.parsedRows} parsed rows • {controller.plan.summary.additions} proposed additions • {controller.plan.duplicates} duplicates • {controller.plan.conflicts} conflicting transactions • {controller.plan.summary.unplannedRows} need resolution. Nothing is saved until the whole batch is valid.</AppText>
        {controller.sourceId === "zerodhaTradebookEqV1" ? <AppText color="secondary" variant="caption">Add all your annual files before importing. Confirmed matches are kept as you add files.</AppText> : null}
        {unresolved.filter((group) => !group.suggestedAsset).map((group) => <HoldingMatch key={group.key} group={group} onSelect={controller.selectCandidate} />)}
        {(showAllSuggestions ? suggested : suggested.slice(0, 5)).map((group) => <HoldingMatch key={group.key} group={group} onSelect={controller.selectCandidate} />)}
        {suggested.length > 5 ? <AppButton onPress={() => setShowAllSuggestions(!showAllSuggestions)} testID="transaction-import-show-suggestions" title={showAllSuggestions ? "Show fewer suggestions" : `View all ${suggested.length} suggested matches`} variant="secondary" /> : null}
        {suggested.length > 0 ? <>
          <AppText color="secondary" variant="caption">All {suggested.length} suggestions match the file's symbol, exchange and currency. You can inspect each match before accepting them together; no transactions are saved yet.</AppText>
          <AppButton disabled={controller.isResolving} onPress={controller.acceptSuggestedMatches} testID="transaction-import-accept-matches" title={`Accept ${suggested.length} matching ${suggested.length === 1 ? "holding" : "holdings"}`} />
        </> : null}
        {matched.length > 0 ? <AppButton onPress={() => setShowMatched(!showMatched)} testID="transaction-import-show-matched" title={showMatched ? "Hide matched holdings" : `View ${matched.length} matched holdings`} variant="secondary" /> : null}
        {showMatched ? matched.map((group) => <HoldingMatch key={group.key} group={group} onSelect={controller.selectCandidate} />) : null}
      </PremiumCard> : null}

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
        <AppText color="secondary" variant="caption">If unsure, keep existing opening balances and add only later activity instead. Do not confirm incomplete history.</AppText>
      </PremiumCard> : null}

      {identityConflicts.length === 0 && unresolved.length === 0 && !controller.isResolving && (controller.groups.length > 0 || controller.unsupportedEvents.length > 0 || controller.casReview) ? <PremiumCard elevated style={styles.card} testID="transaction-import-dry-run">
        <SectionHeader title="Review before importing" />
        <View style={styles.summaryGrid}>
          <Summary label="New transactions" testID="transaction-import-summary-additions" value={`${controller.plan.summary.additions}`} />
          <Summary label="Duplicate rows" testID="transaction-import-summary-duplicates" value={`${controller.plan.duplicates}`} />
          <Summary label="Conflicts" testID="transaction-import-summary-conflicts" value={`${controller.plan.conflicts}`} />
          <Summary label="Unsupported" testID="transaction-import-summary-unsupported" value={`${controller.unsupportedCount}`} />
        </View>
        {controller.unsupportedEvents.length > 0 ? <View style={styles.unsupported}>
          <AppText color="secondary" variant="caption" weight="bold">{controller.sourceId === "camsKfinCasPdfV1" ? "Unsupported events need attention" : "Skipped unsupported events"}</AppText>
          {controller.sourceId === "camsKfinCasPdfV1" && controller.unsupportedEvents.some((event) => event.transactionType === "cancelled") ? <AppText color="secondary" variant="caption">This cancellation includes financial values or cannot be read as a standalone notice. Its effect cannot be inferred safely, so this import remains blocked.</AppText> : null}
          {controller.unsupportedEvents.map((event) => <AppText key={`${event.rowNumber}-${event.transactionType}`} color="secondary" variant="caption">Row {event.rowNumber}: {event.transactionType}{event.reason ? ` • ${event.reason}` : ""}</AppText>)}
        </View> : null}
        {controller.groups.length === 0 && controller.unsupportedEvents.length > 0 ? <AppText color="secondary" variant="caption">This file has no supported transaction rows to import.</AppText> : null}
        <AppText color="secondary" variant="caption">Cash Ledger is unchanged. Fees and taxes stay with imported transaction metadata; V1 does not calculate tax lots.</AppText>
        {controller.plan.holdings.length > 0 ? <AppButton onPress={() => setShowHoldings(!showHoldings)} testID="transaction-import-show-balances" title={showHoldings ? "Hide resulting balances" : `Review ${controller.plan.holdings.length} resulting balances`} variant="secondary" /> : null}
        {controller.plan.holdings.some((holding) => holding.asset.stockSplits?.length) ? <View testID="transaction-import-split-summary" style={styles.holdingPreview}>
          <AppText weight="bold">{controller.plan.holdings.some((holding) => holding.asset.stockSplits?.some((event) => event.kind === "bonus")) ? "Share adjustments included" : "Stock splits included"}</AppText>
          {controller.plan.holdings.flatMap((holding) => (holding.asset.stockSplits ?? []).map((event) =>
            <AppText key={`${holding.asset.id}-${event.id}`} color="secondary" variant="caption">{holding.asset.name}: {event.newShares} {event.kind === "bonus" ? "bonus share(s)" : "shares"} for {event.oldShares} held on {event.effectiveDate}. Earlier eligible units are adjusted; invested cost is unchanged.</AppText>))}
          <AppText color="secondary" variant="caption">These verified events are saved with the import, not as new purchases.</AppText>
          {controller.plan.command?.transactions.length === 0 ? <AppText color="secondary" variant="caption">Your transactions are already saved. Apply the verified share adjustments without importing them again.</AppText> : null}
        </View> : null}
        {importDemergers.length > 0 ? <View style={styles.holdingPreview} testID="transaction-import-demerger-summary">
          <AppText weight="bold">Demergers included</AppText>
          {importDemergers.map((event) => {
            if (event.kind !== "entitlement") return null;
            const terms = demergerCatalog.find((item) => item.id === event.eventId)!;
              const parent = controller.plan.holdings.find((holding) => holding.asset.id === event.sourceAssetId)?.asset;
              const parentFraction = decimal(1).minus(terms.childFraction);
              const parentCost = decimal(event.cost).dividedBy(terms.childFraction).times(parentFraction);
              return <View key={event.eventId}>
                <AppText color="secondary" variant="caption">{parent?.name ?? "Retained holding"}: {event.quantity} shares retained at the event, {parentFraction.times(100).toString()}% of cost ({formatCurrency(parentCost.toNumber(), "INR")}).</AppText>
                <AppText color="secondary" variant="caption">{terms.childName}: {event.quantity} new shares, {decimal(terms.childFraction).times(100).toString()}% of cost ({formatCurrency(Number(event.cost), "INR")}).</AppText>
                <AppText color="secondary" variant="caption">Ex-date {event.date}; new holding listed {terms.availableFrom}. Values above are at the event, before later activity.</AppText>
              </View>;
          })}
          <AppText color="secondary" variant="caption">Verified issuer allocation. No new investment or cash entry is created. Both holdings are saved together.</AppText>
        </View> : null}
        {showHoldings ? controller.plan.holdings.map((holding) => <View key={holding.asset.id} style={styles.holdingPreview}>
          <AppText weight="bold">{holding.asset.name}</AppText>
          <AppText color="secondary" testID={`transaction-import-holding-summary-${holding.asset.id}`} variant="caption">{holding.importedTransactions} transactions • {holding.reconciliation.quantity} units • average cost {formatCurrency(holding.reconciliation.averageCostPrice, holding.asset.currency)}</AppText>
          {holding.cutover ? <AppText color="secondary" variant="caption">Holdings measured as of {holding.cutover}</AppText> : null}
          {controller.mode === "fullHistory" && holding.baseline ? <AppText color={holding.replacementExact ? "primary" : "secondary"} testID={`transaction-import-replacement-${holding.asset.id}`} variant="caption">{holding.replacementExact ? "Opening balance will be replaced after confirmation." : "Opening balance is kept until history reconciles exactly."}</AppText> : null}
        </View>) : null}
        {groupedErrors.map(({ error, count }, index) => {
          const asset = controller.plan.holdings.find((holding) => holding.asset.id === error.assetId)?.asset ?? controller.snapshot.assets.find((item) => item.id === error.assetId);
          return <ErrorCard key={`${error.code}-${index}`} message={`${asset ? `${asset.name}: ` : ""}${error.message}${count > 1 ? ` (${count} transactions)` : ""}`} />;
        })}
        {unresolved.length > 0 ? <AppText color="secondary">Confirm the {unresolved.length} remaining holding matches above before importing.</AppText> : null}
        <AppButton disabled={!controller.plan.command || controller.isSaving || controller.isResolving || controller.parseErrors.length > 0 || controller.casReviewErrors.length > 0} onPress={controller.confirmImport} testID="confirm-transaction-import" title={controller.isSaving ? "Importing..." : controller.plan.command?.transactions.length === 0 ? "Apply share adjustments" : "Confirm transaction import"} />
      </PremiumCard> : null}
    </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function HoldingMatch({ group, onSelect }: {
  group: ReturnType<typeof useTransactionImport>["groups"][number];
  onSelect: (key: string, asset: Asset) => void;
}) {
  const [changing, setChanging] = useState(false);
  const chosen = group.selectedAsset ?? group.suggestedAsset;
  return <View style={styles.holdingPreview} testID={`transaction-import-asset-${group.key}`}>
    <AppText weight="bold">{chosen?.name ?? group.title}</AppText>
    {chosen ? <AppText color="secondary" variant="caption">{chosen.ticker} • {chosen.exchange} • {group.identityConflict ? "Historical identity unresolved" : group.selectedAsset ? "Matched" : "Suggested match"}</AppText> : null}
    <AppText color="secondary" variant="caption">{group.rowNumbers.length} {group.rowNumbers.length === 1 ? "transaction" : "transactions"}{chosen ? ` • ${group.title}` : ""}</AppText>
    {chosen && group.candidates.length > 0 ? <AppButton onPress={() => setChanging(!changing)} testID={`transaction-import-change-${group.key}`} title={changing ? "Keep this match" : "Change match"} variant="secondary" /> : null}
    {!chosen && group.candidates.length === 0 ? <AppText color="secondary">No matching listing was found. This holding needs a verified asset match before its history can be imported.</AppText> : null}
    {!chosen || changing ? <View style={styles.actions}>
      {group.candidates.map((candidate) => <AppButton key={candidate.id} onPress={() => { onSelect(group.key, candidate); setChanging(false); }} testID={`transaction-import-asset-${group.key}-candidate-${candidate.id}`} title={`${candidate.name} • ${candidate.ticker}`} variant="secondary" />)}
    </View> : null}
  </View>;
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
  flex: { flex: 1 },
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
  modeButton: { backgroundColor: colors.surface.elevated, borderRadius: radii.card, flexBasis: "100%", flexGrow: 1, gap: spacing.xs, minHeight: 64, padding: spacing.md },
  modeButtonActive: { borderColor: colors.primary, borderWidth: 1 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pressed: { opacity: 0.78 },
  section: { gap: spacing.cardGap },
  summary: { flexBasis: "42%", flexGrow: 1, gap: spacing.xs },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  reviewHeading: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  statementSelection: { alignItems: "center", backgroundColor: colors.surface.elevated, borderRadius: radii.button, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  unsupported: { gap: spacing.xs },
});
