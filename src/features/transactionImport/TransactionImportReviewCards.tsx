import { Pressable, View } from "react-native";

import {
  AppButton,
  AppText,
  PremiumCard,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField } from "@/src/components/forms";
import { transactionImportSources } from "@/src/domain/transactionImportSources";

import { CasImportProblems } from "./CasImportProblems";
import {
  HoldingMatch,
  ModeButton,
  ReviewDisclosure,
  Summary,
} from "./TransactionImportParts";
import { useStyles } from "./transactionImportStyles";
import {
  casStatementSummaryText,
  getCasReadyTransactions,
  getCasSchemes,
  hasVerifiedImportInput,
  matchedDisclosureTitle,
  matchSummaryText,
  rowAccountingText,
  type ImportMatchGroups,
} from "./transactionImportViewModel";
import type { TransactionImportController } from "./useTransactionImport";

/** What was detected in the file, and how to apply it to saved history. */
export function ImportPreflightCard({ controller }: { controller: TransactionImportController }) {
  const styles = useStyles();

  if (!hasVerifiedImportInput(controller)) {
    return null;
  }

  return <PremiumCard style={styles.card} testID="transaction-import-preflight">
    <SectionHeader title="File check" />
    <View style={styles.summaryGrid}>
      <Summary
        label="Detected source"
        testID="transaction-import-detected-source"
        value={transactionImportSources.find((source) => source.id === controller.sourceId)?.label ?? "Unknown"}
      />
      <Summary
        label="Coverage"
        testID="transaction-import-detected-coverage"
        value={controller.importCoverage ? `${controller.importCoverage.from} to ${controller.importCoverage.to}` : "Unknown"}
      />
      <Summary
        label="Transactions"
        testID="transaction-import-detected-transactions"
        value={String(controller.plan.summary.parsedRows)}
      />
      <Summary
        label="Holdings"
        testID="transaction-import-detected-holdings"
        value={String(controller.groups.length || controller.casReview?.normalization.schemes.length || 0)}
      />
    </View>
    {!controller.hasSavedInvestmentHistory ? <>
      <AppText weight="bold">Rebuild from this history</AppText>
      <AppText color="secondary">
        No saved investment history was found. CogVest will build holdings from the inspected records; existing Cash entries stay unchanged.
      </AppText>
    </> : <>
      <SectionHeader title="How should this file be applied?" />
      <AppText color="secondary">
        Existing investment records were found. Keeping opening balances is the safer default unless this file contains complete history for the affected holdings.
      </AppText>
      <View style={styles.modeRow}>
        <ModeButton
          active={controller.mode === "supplemental"}
          description="Recommended: keep opening balances and add only later activity."
          onPress={() => controller.setMode("supplemental")}
          testID="transaction-import-mode-supplemental"
          title="Add later activity"
        />
        <ModeButton
          active={controller.mode === "fullHistory"}
          description="Replace opening balances only when the history matches them exactly and you confirm."
          onPress={() => controller.setMode("fullHistory")}
          testID="transaction-import-mode-full-history"
          title="Rebuild from history"
        />
      </View>
    </>}
  </PremiumCard>;
}

/** Parser problems, opening-history gaps, notices and scheme balances. */
export function CasStatementReview({
  controller,
  onLayout,
  onToggleDetails,
  showDetails,
}: {
  controller: TransactionImportController;
  onLayout: (y: number) => void;
  onToggleDetails: () => void;
  showDetails: boolean;
}) {
  const styles = useStyles();
  const casReview = controller.casReview;

  if (!casReview) {
    return null;
  }

  const { normalization } = casReview;
  const casSchemes = getCasSchemes(controller);
  const openingHistoryError = controller.plan.errors.find((error) => error.code === "incompleteCasHistory");

  return <View onLayout={(event) => { onLayout(event.nativeEvent.layout.y); }} style={styles.card}>
    <CasImportProblems problems={[
      ...normalization.parserErrors,
      ...normalization.errors,
    ]} />
    <PremiumCard style={styles.card} testID="cas-statement-review">
      <SectionHeader title="Statement review" />
      {controller.plan.errors.some((error) => error.code === "incompleteCasHistory") ? (
        <View style={styles.card} testID="cas-opening-history-error">
          <AppText weight="bold">Earlier holdings need a starting balance</AppText>
          <AppText color="secondary">{openingHistoryError?.message}</AppText>
          <AppText color="secondary" variant="caption">
            Nothing has been imported. Do not remove statement rows to get past this check.
          </AppText>
        </View>
      ) : null}
      <AppText color="secondary" testID="cas-statement-summary">
        {casStatementSummaryText(casSchemes.length, getCasReadyTransactions(controller))}
      </AppText>
      {(normalization.administrativeNotices ?? 0) > 0 ? (
        <AppText color="secondary" variant="caption" testID="cas-administrative-notices">
          {normalization.administrativeNotices} administrative notices identified (address updates or nominee registration). These are not investment transactions and do not change balances.
        </AppText>
      ) : null}
      {normalization.coverage ? (
        <AppText color="secondary" testID="cas-statement-coverage" variant="caption">
          Statement coverage: {normalization.coverage.from} to {normalization.coverage.to}
        </AppText>
      ) : null}
      {(normalization.preservedNotices?.length ?? 0) > 0 ? (
        <View style={styles.card} testID="cas-preserved-notices">
          <AppText weight="bold">Cancellation notice retained in this review</AppText>
          <AppText color="secondary" variant="caption">
            The statement lists a cancellation without financial values. Only the recorded transactions will be imported; no purchase or reversal is created from this notice. All printed unit balances must still reconcile.
          </AppText>
          {normalization.preservedNotices?.map((notice) => (
            <AppText key={`${notice.folioLabel}-${notice.rowNumber}`} color="secondary" variant="caption">
              {notice.folioLabel} · {notice.date} · Cancelled
            </AppText>
          ))}
        </View>
      ) : null}
      {casSchemes.length > 0 ? (
        <ReviewDisclosure
          expanded={showDetails}
          onPress={onToggleDetails}
          testID="cas-toggle-scheme-details"
          title={`Review ${casSchemes.length} scheme ${casSchemes.length === 1 ? "balance" : "balances"}`}
        />
      ) : null}
      {showDetails ? <View style={styles.schemeList} testID="cas-scheme-details">
        {casSchemes.map((scheme) => (
          <View key={`${scheme.folioLabel}-${scheme.isin}`} style={styles.holdingPreview}>
            <View style={styles.reviewHeading}>
              <View style={styles.fileDetails}>
                <AppText weight="bold">{scheme.name}</AppText>
                <AppText color="secondary" variant="caption">
                  {scheme.folioLabel} • {scheme.registrar} • {scheme.isin}
                </AppText>
              </View>
              <AppText weight="bold">{scheme.importableTransactions} ready</AppText>
            </View>
            <View style={styles.summaryGrid}>
              <Summary
                label="Opening units"
                value={scheme.openingUnits}
                testID={`cas-opening-${scheme.folioLabel}-${scheme.isin}`}
              />
              <Summary
                label="Closing units"
                value={scheme.closingUnits}
                testID={`cas-closing-${scheme.folioLabel}-${scheme.isin}`}
              />
            </View>
          </View>
        ))}
      </View> : null}
      {normalization.preservedCharges.length > 0 ? (
        <AppText color="secondary" variant="caption" testID="cas-preserved-charges">
          {normalization.preservedCharges.length} stamp-duty {normalization.preservedCharges.length === 1 ? "entry is" : "entries are"} preserved as review evidence and not imported as a trade.
        </AppText>
      ) : null}
    </PremiumCard>
  </View>;
}

/** Holding or fund matches, with suggestions to accept together. */
export function HoldingMatchCard({
  controller,
  matchGroups,
  onToggleAllSuggestions,
  onToggleMatched,
  showAllSuggestions,
  showMatched,
}: {
  controller: TransactionImportController;
  matchGroups: ImportMatchGroups;
  onToggleAllSuggestions: () => void;
  onToggleMatched: () => void;
  showAllSuggestions: boolean;
  showMatched: boolean;
}) {
  const styles = useStyles();
  const { identityConflicts, matched, suggested, unresolved } = matchGroups;
  const isCas = controller.sourceId === "camsKfinCasPdfV1";

  if (controller.groups.length === 0) {
    return null;
  }

  return <PremiumCard style={styles.card}>
    <SectionHeader title={isCas ? "Review fund identities" : "Match your holdings"} />
    <AppText color="secondary" testID="transaction-import-match-summary">
      {matchSummaryText(controller.sourceId, matchGroups)}
    </AppText>
    {isCas && controller.casClassificationNotice && unresolved.length > 0 ? (
      <AppText color="secondary" testID="cas-classification-notice" variant="caption">
        {controller.casClassificationNotice}
      </AppText>
    ) : null}
    {identityConflicts.length > 0 ? <>
      <AppText testID="transaction-import-identity-conflicts" weight="bold">
        {identityConflicts.length} historical identities need corporate-action review
      </AppText>
      <AppText color="secondary">
        Different ISINs point to the same current listing. Their quantities cannot safely be combined yet. Keep the original rows; do not delete transactions to bypass this check. Corporate-action import support is needed before these histories can be combined.
      </AppText>
      {identityConflicts.map((group) => (
        <HoldingMatch key={group.key} group={group} onSelect={controller.selectCandidate} />
      ))}
    </> : null}
    <AppText color="secondary" testID="transaction-import-row-accounting">
      {rowAccountingText(controller.plan)}
    </AppText>
    {controller.sourceId === "zerodhaTradebookEqV1" ? (
      <AppText color="secondary" variant="caption">
        Add all your annual files before importing. Confirmed matches are kept as you add files.
      </AppText>
    ) : null}
    {unresolved.filter((group) => !group.suggestedAsset).map((group) => (
      <HoldingMatch key={group.key} group={group} onSelect={controller.selectCandidate} />
    ))}
    {(showAllSuggestions ? suggested : suggested.slice(0, 5)).map((group) => (
      <HoldingMatch key={group.key} group={group} onSelect={controller.selectCandidate} />
    ))}
    {suggested.length > 5 ? (
      <AppButton
        onPress={onToggleAllSuggestions}
        testID="transaction-import-show-suggestions"
        title={showAllSuggestions ? "Show fewer suggestions" : `View all ${suggested.length} suggested matches`}
        variant="secondary"
      />
    ) : null}
    {suggested.length > 0 ? <>
      <AppText color="secondary" variant="caption">
        All {suggested.length} suggestions match the file's symbol, exchange and currency. You can inspect each match before accepting them together; no transactions are saved yet.
      </AppText>
      <AppButton
        disabled={controller.isResolving}
        onPress={controller.acceptSuggestedMatches}
        testID="transaction-import-accept-matches"
        title={`Accept ${suggested.length} matching ${suggested.length === 1 ? "holding" : "holdings"}`}
      />
    </> : null}
    {matched.length > 0 ? (
      <ReviewDisclosure
        expanded={showMatched}
        onPress={onToggleMatched}
        testID="transaction-import-show-matched"
        title={matchedDisclosureTitle(controller.sourceId, matched.length)}
      />
    ) : null}
    {showMatched ? matched.map((group) => (
      <HoldingMatch key={group.key} group={group} onSelect={controller.selectCandidate} />
    )) : null}
  </PremiumCard>;
}

/** When existing opening balances were measured, so history isn't counted twice. */
export function CutoverCard({ controller }: { controller: TransactionImportController }) {
  const styles = useStyles();

  if (controller.cutoverHoldings.length === 0) {
    return null;
  }

  return <PremiumCard style={styles.card} testID="transaction-import-cutover">
    <SectionHeader title="Holdings measured as of" />
    <AppText color="secondary">
      Tell CogVest when your existing opening balances were measured. This prevents history from being counted twice.
    </AppText>
    {controller.needsSharedCutover ? (
      <DatePickerField
        label="Use this date for holdings without one"
        maximumDate={controller.today}
        onChange={controller.setSharedCutover}
        testID="transaction-import-shared-cutover"
        value={controller.sharedCutover}
      />
    ) : null}
    {controller.sharedCutover ? (
      <AppText color="secondary" variant="caption">
        Adjust an individual holding only when its balance was measured on a different date.
      </AppText>
    ) : null}
    {controller.cutoverHoldings
      .filter(({ position }) => position.measuredAsOf || controller.sharedCutover)
      .map(({ asset, position }) => (
        <DatePickerField
          key={position.id}
          label={`${asset.name} measured as of`}
          maximumDate={controller.today}
          onChange={(value) => controller.setCutover(position.id, value)}
          testID={`transaction-import-cutover-${position.id}`}
          value={controller.cutoverByOpeningPositionId[position.id] ?? position.measuredAsOf ?? controller.sharedCutover}
        />
      ))}
  </PremiumCard>;
}

/** Full-history Tradebook imports must confirm nothing happened outside the Tradebook. */
export function SourceCoverageCard({ controller }: { controller: TransactionImportController }) {
  const styles = useStyles();

  if (
    !(controller.sourceId === "zerodhaTradebookEqV1" &&
      controller.mode === "fullHistory" &&
      controller.files.length > 0)
  ) {
    return null;
  }

  return <PremiumCard style={styles.card} testID="transaction-import-source-coverage">
    <SectionHeader title="Confirm history coverage" />
    <AppText color="secondary">
      Zerodha stores IPO/OFS allotments, buybacks, transfers, and corporate actions outside the normal Tradebook.
    </AppText>
    <Pressable
      accessibilityLabel="Confirm no Zerodha external activity"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: controller.externalActivityConfirmed }}
      onPress={() => controller.setExternalActivityConfirmed(!controller.externalActivityConfirmed)}
      style={({ pressed }) => [
        styles.coverageControl,
        controller.externalActivityConfirmed && styles.coverageControlSelected,
        pressed && styles.pressed,
      ]}
      testID="transaction-import-no-external-activity"
    >
      <AppText color={controller.externalActivityConfirmed ? "primary" : "secondary"} weight="bold">
        I confirm these date ranges had no external trades or corporate actions.
      </AppText>
    </Pressable>
    <AppText color="secondary" variant="caption">
      If unsure, keep existing opening balances and add only later activity instead. Do not confirm incomplete history.
    </AppText>
  </PremiumCard>;
}
