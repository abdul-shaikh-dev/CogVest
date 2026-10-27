import { View } from "react-native";

import {
  AppButton,
  AppText,
  PremiumCard,
  SectionHeader,
} from "@/src/components/common";
import { formatCurrency } from "@/src/domain/formatters";

import { ErrorCard, ReviewDisclosure, Summary } from "./TransactionImportParts";
import { useStyles } from "./transactionImportStyles";
import {
  canConfirmImport,
  confirmImportTitle,
  demergerPreviewLines,
  getImportDemergers,
  getReplacementHoldings,
  groupPlanErrors,
  planErrorText,
  replacementConsequenceText,
  shouldShowDryRun,
  stockSplitText,
  type ImportMatchGroups,
} from "./transactionImportViewModel";
import type { TransactionImportController } from "./useTransactionImport";

/** The full outcome of the import, reviewed before anything is saved. */
export function TransactionImportDryRun({
  controller,
  matchGroups,
  onToggleHoldings,
  showHoldings,
}: {
  controller: TransactionImportController;
  matchGroups: ImportMatchGroups;
  onToggleHoldings: () => void;
  showHoldings: boolean;
}) {
  const styles = useStyles();

  if (!shouldShowDryRun(controller, matchGroups)) {
    return null;
  }

  const { plan } = controller;
  const isCas = controller.sourceId === "camsKfinCasPdfV1";
  const importDemergers = getImportDemergers(plan);
  const replacementHoldings = getReplacementHoldings(controller.mode, plan.holdings);
  const exactReplacements = replacementHoldings.filter((holding) => holding.replacementExact).length;

  return <PremiumCard elevated style={styles.card} testID="transaction-import-dry-run">
    <SectionHeader title="Review before importing" />
    <View style={styles.summaryGrid}>
      <Summary
        prominent
        label="New transactions"
        testID="transaction-import-summary-additions"
        value={`${plan.summary.additions}`}
      />
      <Summary
        prominent
        label="Duplicate rows"
        testID="transaction-import-summary-duplicates"
        value={`${plan.duplicates}`}
      />
      <Summary
        prominent
        attention={plan.conflicts > 0}
        label="Conflicts"
        testID="transaction-import-summary-conflicts"
        value={`${plan.conflicts}`}
      />
      <Summary
        prominent
        attention={controller.unsupportedCount > 0}
        label="Unsupported"
        testID="transaction-import-summary-unsupported"
        value={`${controller.unsupportedCount}`}
      />
    </View>
    {controller.unsupportedEvents.length > 0 ? <View style={styles.unsupported}>
      <AppText color="secondary" variant="caption" weight="bold">
        {isCas ? "Unsupported events need attention" : "Skipped unsupported events"}
      </AppText>
      {isCas && controller.unsupportedEvents.some((event) => event.transactionType === "cancelled") ? (
        <AppText color="secondary" variant="caption">
          This cancellation includes financial values or cannot be read as a standalone notice. Its effect cannot be inferred safely, so this import remains blocked.
        </AppText>
      ) : null}
      {controller.unsupportedEvents.map((event) => (
        <AppText key={`${event.rowNumber}-${event.transactionType}`} color="secondary" variant="caption">
          {`Row ${event.rowNumber}: ${event.transactionType}${event.reason ? ` • ${event.reason}` : ""}`}
        </AppText>
      ))}
    </View> : null}
    {controller.groups.length === 0 && controller.unsupportedEvents.length > 0 ? (
      <AppText color="secondary" variant="caption">This file has no supported transaction rows to import.</AppText>
    ) : null}
    <AppText color="secondary" variant="caption">
      Cash is unchanged. Imported records keep their fees and taxes. CogVest does not calculate tax lots.
    </AppText>
    {replacementHoldings.length > 0 ? (
      <View style={styles.holdingPreview} testID="transaction-import-replacement-summary">
        <AppText weight="bold">Opening balance consequences</AppText>
        <AppText color="secondary" variant="caption">
          {replacementConsequenceText(exactReplacements, replacementHoldings.length)}
        </AppText>
      </View>
    ) : null}
    {plan.holdings.length > 0 ? (
      <ReviewDisclosure
        expanded={showHoldings}
        onPress={onToggleHoldings}
        testID="transaction-import-show-balances"
        title={`Review ${plan.holdings.length} resulting balances`}
      />
    ) : null}
    {plan.holdings.some((holding) => holding.asset.stockSplits?.length) ? (
      <View testID="transaction-import-split-summary" style={styles.holdingPreview}>
        <AppText weight="bold">
          {plan.holdings.some((holding) => holding.asset.stockSplits?.some((event) => event.kind === "bonus"))
            ? "Share adjustments included"
            : "Stock splits included"}
        </AppText>
        {plan.holdings.flatMap((holding) => (holding.asset.stockSplits ?? []).map((event) => (
          <AppText key={`${holding.asset.id}-${event.id}`} color="secondary" variant="caption">
            {stockSplitText(holding, event)}
          </AppText>
        )))}
        <AppText color="secondary" variant="caption">
          These verified events are saved with the import, not as new purchases.
        </AppText>
        {plan.command?.transactions.length === 0 ? (
          <AppText color="secondary" variant="caption">
            Your transactions are already saved. Apply the verified share adjustments without importing them again.
          </AppText>
        ) : null}
      </View>
    ) : null}
    {importDemergers.length > 0 ? (
      <View style={styles.holdingPreview} testID="transaction-import-demerger-summary">
        <AppText weight="bold">Demergers included</AppText>
        {importDemergers.map((event) => {
          if (event.kind !== "entitlement") return null;
          return <View key={event.eventId}>
            {demergerPreviewLines(event, plan.holdings).map((line) => (
              <AppText key={line} color="secondary" variant="caption">{line}</AppText>
            ))}
          </View>;
        })}
        <AppText color="secondary" variant="caption">
          Verified issuer allocation. No new investment or cash entry is created. Both holdings are saved together.
        </AppText>
      </View>
    ) : null}
    {showHoldings ? plan.holdings.map((holding) => (
      <View key={holding.asset.id} style={styles.holdingPreview}>
        <AppText weight="bold">{holding.asset.name}</AppText>
        <View style={styles.balanceDetails} testID={`transaction-import-holding-summary-${holding.asset.id}`}>
          <AppText color="secondary" variant="caption">{holding.importedTransactions} transactions</AppText>
          <View style={styles.summaryGrid}>
            <Summary
              label="Units"
              value={`${holding.reconciliation.quantity}`}
              testID={`transaction-import-units-${holding.asset.id}`}
            />
            <Summary
              label="Average cost"
              value={formatCurrency(holding.reconciliation.averageCostPrice, holding.asset.currency)}
              testID={`transaction-import-cost-${holding.asset.id}`}
            />
          </View>
        </View>
        {holding.cutover ? (
          <AppText color="secondary" variant="caption">Holdings measured as of {holding.cutover}</AppText>
        ) : null}
        {controller.mode === "fullHistory" && holding.baseline ? (
          <AppText
            color={holding.replacementExact ? "primary" : "secondary"}
            testID={`transaction-import-replacement-${holding.asset.id}`}
            variant="caption"
          >
            {holding.replacementExact
              ? "Opening balance will be replaced after confirmation."
              : "Opening balance is kept until history reconciles exactly."}
          </AppText>
        ) : null}
      </View>
    )) : null}
    {groupPlanErrors(plan.errors).map((group, index) => (
      <ErrorCard
        key={`${group.error.code}-${index}`}
        message={planErrorText(group, plan.holdings, controller.snapshot.assets)}
      />
    ))}
    {matchGroups.unresolved.length > 0 ? (
      <AppText color="secondary">
        Confirm the {matchGroups.unresolved.length} remaining holding matches above before importing.
      </AppText>
    ) : null}
    <AppButton
      disabled={!canConfirmImport(controller)}
      onPress={controller.confirmImport}
      testID="confirm-transaction-import"
      title={confirmImportTitle(controller)}
    />
  </PremiumCard>;
}
