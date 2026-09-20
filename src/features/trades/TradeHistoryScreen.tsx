import { useState, useSyncExternalStore } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  GroupedListRow,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { formatCurrency, formatDate } from "@/src/domain/formatters";
import { calculateRecordedSaleGains } from "@/src/domain/calculations/holdings";
import { isManualTrade } from "@/src/domain/transactionSemantics";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, radii, spacing } from "@/src/theme";

type TradeHistoryScreenProps = {
  assetId: string;
  onBack: () => void;
  onReviewTrade: (tradeId: string) => void;
  store?: StoreApi<PortfolioStoreState>;
  now?: Date;
};

export function TradeHistoryScreen({
  assetId,
  onBack,
  onReviewTrade,
  store = getPortfolioStore(),
  now = new Date(),
}: TradeHistoryScreenProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const asset = snapshot.assets.find((item) => item.id === assetId);
  const trades = snapshot.trades
    .filter((trade) => !assetId || trade.assetId === assetId)
    .sort((left, right) => right.date.localeCompare(left.date));
  const gains = calculateRecordedSaleGains({
    assets: snapshot.assets.filter((item) => !assetId || item.id === assetId),
    openingPositions: snapshot.openingPositions,
    trades: snapshot.trades,
    now,
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedTradeIds, setSelectedTradeIds] = useState<Set<string>>(() => new Set());
  const [isReviewingDeletion, setIsReviewingDeletion] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState<string>();
  const selectedIds = [...selectedTradeIds].filter((id) => trades.some((trade) => trade.id === id));
  const deletionPreview = isReviewingDeletion
    ? store.getState().previewTradeDeletion(selectedIds)
    : undefined;

  function leaveSelection() {
    setIsSelecting(false);
    setSelectedTradeIds(new Set());
    setIsReviewingDeletion(false);
  }

  function toggleSelection(tradeId: string) {
    setSelectedTradeIds((current) => {
      const next = new Set(current);
      if (next.has(tradeId)) next.delete(tradeId);
      else next.add(tradeId);
      return next;
    });
  }

  function reviewDeletion() {
    setDeletionMessage(undefined);
    setIsReviewingDeletion(true);
  }

  async function deleteSelectedTransactions() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const result = store.getState().deleteTrades(selectedIds);
      if (result.status === "rejected") {
        setDeletionMessage(deletionFailureMessage(result.reason, result.blockingAssetIds, snapshot));
        return;
      }
      const count = result.impact.transactions;
      leaveSelection();
      setDeletionMessage(`${count} ${count === 1 ? "transaction" : "transactions"} removed. Portfolio and automatic history updated.`);
    } catch {
      setDeletionMessage("The selected transactions could not be removed safely. Nothing was changed.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (assetId && !asset) {
    return (
      <ScreenContainer testID="trade-history-screen">
        <EmptyState
          actionLabel="Back to Holdings"
          message="The holding may have been removed or changed."
          title="Holding unavailable"
          onAction={onBack}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll testID="trade-history-screen">
      <View style={styles.content}>
        <AppButton
          style={styles.backButton}
          title={isSelecting ? "Cancel selection" : "Back to Holdings"}
          variant="ghost"
          onPress={isSelecting ? leaveSelection : onBack}
        />
        <ScreenHeader
          title="Transactions"
          subtitle={asset
            ? `${asset.name} · local records`
            : `${trades.length} ${trades.length === 1 ? "record" : "records"} · local only`}
        />
        {deletionMessage ? (
          <AppText accessibilityLiveRegion="polite" color={deletionMessage.includes("removed") ? "secondary" : undefined} style={deletionMessage.includes("removed") ? undefined : styles.errorText} testID="transaction-deletion-message">
            {deletionMessage}
          </AppText>
        ) : null}
        {trades.length === 0 ? (
          <EmptyState
            message="Opening positions are reviewed separately from later purchases and sales."
            title="No transactions yet"
          />
        ) : (
          <PremiumCard style={styles.historyCard}>
            <View accessibilityLiveRegion={isSelecting ? "polite" : "none"} testID={isSelecting ? "transaction-selection-count" : undefined}>
              <SectionHeader title={isSelecting ? `${selectedIds.length} selected` : "Transaction history"} />
            </View>
            {isSelecting ? (
              <View style={styles.selectionActions}>
                <AppButton
                  disabled={selectedIds.length === trades.length}
                  onPress={() => setSelectedTradeIds(new Set(trades.map((trade) => trade.id)))}
                  testID="select-all-transactions"
                  title={`Select all ${trades.length} shown`}
                  variant="secondary"
                />
                <AppButton
                  disabled={selectedIds.length === 0}
                  onPress={() => setSelectedTradeIds(new Set())}
                  testID="clear-transaction-selection"
                  title="Clear selection"
                  variant="ghost"
                />
              </View>
            ) : (
              <AppButton
                onPress={() => {
                  setDeletionMessage(undefined);
                  setIsSelecting(true);
                }}
                testID="start-transaction-selection"
                title="Select transactions"
                variant="secondary"
              />
            )}
            {trades.map((trade, index) => (
              (() => {
                const isManual = isManualTrade(trade);
                const tradeAsset = snapshot.assets.find((item) => item.id === trade.assetId);
                const currency = tradeAsset?.currency;
                const title = isManual
                  ? trade.type === "buy" ? "Purchase" : "Sale"
                  : trade.type === "transferIn" ? "Transfer in" : "Transfer out";
                let description = snapshot.preferences.maskWealthValues
                  ? `${formatDate(trade.date)} · values masked`
                  : isManual
                    ? `${formatDate(trade.date)} · ${trade.quantity} units at ${currency ? formatCurrency(trade.pricePerUnit, currency) : "currency unavailable"}`
                    : `${formatDate(trade.date)} · ${trade.quantity} units · ${
                        trade.type === "transferIn" && trade.acquisitionCostPerUnit !== undefined
                          ? `acquisition basis ${trade.acquisitionCostPerUnit} per unit`
                          : "no execution price"
                      }`;
                if (trade.type === "sell" && !snapshot.preferences.maskWealthValues) {
                  const gain = gains[trade.id];
                  description += gain == null || !currency
                    ? "\nRealized gain unavailable: incomplete or unsupported history"
                    : `\nRealized gain ${gain >= 0 ? "+" : ""}${formatCurrency(gain, currency)} · after fees`;
                }
                const selectionDetails = snapshot.preferences.maskWealthValues
                  ? "values masked"
                  : isManual
                    ? `${trade.quantity} units at ${currency ? formatCurrency(trade.pricePerUnit, currency) : "currency unavailable"}, total ${currency ? formatCurrency(trade.totalValue, currency) : "unavailable"}`
                    : `${trade.quantity} units, ${
                        trade.type === "transferIn" && trade.acquisitionCostPerUnit !== undefined
                          ? `acquisition basis ${currency ? formatCurrency(trade.acquisitionCostPerUnit, currency) : `${trade.acquisitionCostPerUnit} per unit`}`
                          : "no execution price"
                      }`;

                return (
                  <GroupedListRow
                    accessibilityLabel={isSelecting
                      ? `${selectedTradeIds.has(trade.id) ? "Selected" : "Not selected"}, ${tradeAsset?.name ?? "Unknown holding"}, ${title}, ${formatDate(trade.date)}, ${selectionDetails}, transaction ${index + 1} of ${trades.length}`
                      : undefined}
                    accessibilityRole={isSelecting ? "checkbox" : "button"}
                    accessibilityState={isSelecting ? { checked: selectedTradeIds.has(trade.id) } : undefined}
                    icon={
                      isSelecting
                        ? selectedTradeIds.has(trade.id) ? "checkmark-circle" : "ellipse-outline"
                        : isManual
                        ? trade.type === "buy"
                          ? "arrow-down-circle-outline"
                          : "arrow-up-circle-outline"
                          : "swap-horizontal-outline"
                    }
                    key={trade.id}
                    meta={description}
                    selected={isSelecting && selectedTradeIds.has(trade.id)}
                    title={`${title}${asset ? "" : ` · ${tradeAsset?.name ?? "Unknown holding"}`}`}
                    value={
                      snapshot.preferences.maskWealthValues || !isManual || !currency
                        ? undefined
                        : `${trade.type === "sell" ? "Net " : ""}${formatCurrency(trade.totalValue, currency)}`
                    }
                    testID={`review-trade-${trade.id}`}
                    onPress={() => isSelecting ? toggleSelection(trade.id) : onReviewTrade(trade.id)}
                  />
                );
              })()
            ))}
            {isSelecting ? (
              <AppButton
                disabled={selectedIds.length === 0}
                onPress={reviewDeletion}
                testID="review-selected-transaction-deletion"
                title={`Review deletion${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                variant="destructive"
              />
            ) : null}
          </PremiumCard>
        )}
        <AppText color="secondary" variant="caption">
          Purchases and sales keep cash records in sync. Imported transfers cannot be edited; use reviewed deletion to remove them.
          {" "}Realized gains use recorded weighted-average cost, not tax lots.
        </AppText>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsReviewingDeletion(false)}
        transparent
        visible={isReviewingDeletion}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalSheet} testID="transaction-deletion-preview">
            <ScrollView contentContainerStyle={styles.modalContent}>
              {deletionPreview?.status === "ready" ? (
                <>
                <SectionHeader title={`Delete ${deletionPreview.impact.transactions} ${deletionPreview.impact.transactions === 1 ? "transaction" : "transactions"}?`} />
                <AppText color="secondary">
                  {selectedIds.length === trades.length
                    ? trades.length === 1
                      ? "The transaction shown on this screen is selected."
                      : `All ${trades.length} transactions shown on this screen are selected.`
                    : `Only the ${selectedIds.length} selected transactions will be removed.`}
                </AppText>
                {deletionPreview.impact.affectedHoldings.map((holding) => (
                  <View key={holding.assetId} style={styles.impactRow}>
                    <AppText weight="bold">{holding.name}</AppText>
                    <AppText color="secondary" variant="caption">
                      {holding.transactions} transaction{holding.transactions === 1 ? "" : "s"}
                      {holding.linkedCashEntries > 0 ? ` · ${holding.linkedCashEntries} linked cash` : ""}
                      {holding.corporateActionRecalculated ? " · corporate-action balance recalculated" : ""}
                    </AppText>
                  </View>
                ))}
                <AppText color="secondary" variant="caption">
                  {deletionPreview.impact.linkedCashEntries} linked cash movement{deletionPreview.impact.linkedCashEntries === 1 ? "" : "s"} will be removed. {deletionPreview.impact.automaticSnapshots} automatic snapshot{deletionPreview.impact.automaticSnapshots === 1 ? "" : "s"} from {deletionPreview.impact.earliestAffectedMonth} may be rebuilt; manual snapshots stay unchanged.
                </AppText>
                {deletionPreview.impact.importedTransactions > 0 ? (
                  <AppText color="secondary" variant="caption">
                    Import provenance for {deletionPreview.impact.importedTransactions} selected transaction{deletionPreview.impact.importedTransactions === 1 ? "" : "s"} will be removed. Importing the source file again can add those rows again.
                  </AppText>
                ) : null}
                {deletionPreview.impact.detachedDemergers > 0 ? (
                  <AppText color="secondary" variant="caption">
                    {deletionPreview.impact.detachedDemergers} demerger link{deletionPreview.impact.detachedDemergers === 1 ? "" : "s"} with no remaining supporting records will also be removed and can be restored by reimporting the complete history.
                  </AppText>
                ) : null}
                <AppText weight="bold">This cannot be undone.</AppText>
                </>
              ) : deletionPreview ? (
                <>
                <SectionHeader title="Deletion blocked" />
                <AppText style={styles.errorText} testID="transaction-deletion-blocked">
                  {deletionFailureMessage(deletionPreview.reason, deletionPreview.blockingAssetIds, snapshot)}
                </AppText>
                <AppText color="secondary" variant="caption">No transaction or linked record has been changed.</AppText>
                </>
              ) : null}
              {deletionMessage && deletionPreview?.status === "ready" ? <AppText accessibilityLiveRegion="polite" style={styles.errorText}>{deletionMessage}</AppText> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <AppButton disabled={isDeleting} onPress={() => setIsReviewingDeletion(false)} title={deletionPreview?.status === "ready" ? "Keep transactions" : "Close"} variant="secondary" />
              {deletionPreview?.status === "ready" ? (
                <AppButton disabled={isDeleting} onPress={deleteSelectedTransactions} testID="confirm-delete-selected-transactions" title={isDeleting ? "Deleting..." : "Delete permanently"} variant="destructive" />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function deletionFailureMessage(
  reason: string,
  blockingAssetIds: string[] | undefined,
  snapshot: PortfolioStoreState,
) {
  if (reason === "oversold") {
    const names = blockingAssetIds?.map((id) => snapshot.assets.find((asset) => asset.id === id)?.name).filter(Boolean).join(", ");
    return `Removing this selection would leave ${names || "an affected holding"} with more disposals than available units. Include dependent sales or keep the required acquisition records.`;
  }
  if (reason === "insufficientCash") return "Removing linked sale proceeds would make the recorded Cash timeline negative. Keep the proceeds or first correct the later cash-funded purchases.";
  if (reason === "corporateActionDependency") return "This selection would break a verified split, bonus, or demerger chain. Include all dependent history or keep the supporting transactions.";
  if (reason === "inconsistentLink") return "A selected transaction has an inconsistent linked cash movement. Correct that record before deleting this batch.";
  if (reason === "notFound") return "One or more selected transactions changed or are no longer available. Cancel selection and try again.";
  return "Select at least one transaction before reviewing deletion.";
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
  },
  content: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  errorText: { color: colors.loss },
  historyCard: { gap: spacing.md },
  impactRow: { borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingBottom: spacing.sm },
  modalActions: { gap: spacing.sm },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.78)", flex: 1, justifyContent: "center", padding: spacing.lg },
  modalContent: { gap: spacing.md },
  modalSheet: { backgroundColor: colors.surface.card, borderRadius: radii.sheet, gap: spacing.md, maxHeight: "90%", padding: spacing.lg },
  selectionActions: { gap: spacing.sm },
});
