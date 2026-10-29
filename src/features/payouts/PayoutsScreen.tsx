import { useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  GroupedListRow,
  IconButton,
  MASKED_INR_VALUE,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField } from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { getFirstRecordedPurchase } from "@/src/features/holdings/holdingsReview";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";

import { canRecordPayouts, payoutNet, payoutsSummary, sortedPayouts, treatmentLabel } from "./payoutForm";

/** Dividends and other payouts of one holding, and whether the record is complete (D3). */
export function PayoutsScreen({ assetId, now = new Date(), onAddPayout, onBack, onReviewPayout, store = getPortfolioStore() }: {
  assetId: string;
  now?: Date;
  onAddPayout: () => void;
  onBack: () => void;
  onReviewPayout: (distributionId: string) => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const asset = snapshot.assets.find((item) => item.id === assetId);
  const coverage = snapshot.distributionCoverage.find((item) => item.assetId === assetId);
  const firstPurchase = getFirstRecordedPurchase(
    snapshot.openingPositions.filter((item) => item.assetId === assetId),
    snapshot.trades.filter((item) => item.assetId === assetId),
  );
  const [editingCoverage, setEditingCoverage] = useState(false);
  const [from, setFrom] = useState(coverage?.from ?? firstPurchase ?? formatLocalCalendarDate(now));
  const [message, setMessage] = useState("");

  if (!asset || !canRecordPayouts(asset)) {
    return (
      <ScreenContainer testID="payouts-screen">
        <EmptyState actionLabel="Back" message="Payouts can be recorded for INR stocks, ETFs and funds."
          onAction={onBack} title="Payouts unavailable" />
      </ScreenContainer>
    );
  }
  const masked = snapshot.preferences.maskWealthValues;
  const payouts = sortedPayouts(snapshot.distributions, assetId);

  function saveCoverage(value: string | null) {
    setMessage("");
    const result = store.getState().setDistributionCoverage(assetId, value);
    if (result.status === "rejected") {
      setMessage("Choose a date that is not in the future.");
      return;
    }
    setEditingCoverage(false);
  }

  return (
    <ScreenContainer scroll testID="payouts-screen">
      <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} testID="payouts-back" />}
          subtitle={asset.name}
          title="Dividends and payouts"
        />
        <PremiumCard section testID="payouts-coverage">
          <SectionHeader title="Complete record" />
          <AppText testID="payouts-coverage-status" weight="bold">
            {coverage
              ? `All payouts since ${formatDate(coverage.from)} are recorded`
              : "Not confirmed complete"}
          </AppText>
          <AppText color="secondary" variant="caption">
            {coverage
              ? "Keep adding new payouts as they arrive. Returns use this to include them, including when there were none."
              : "Returns for this holding stay unavailable until you confirm every payout since your first purchase is recorded, even if there were none."}
          </AppText>
          {editingCoverage ? (
            <>
              <DatePickerField label="All payouts recorded since" maximumDate={now} onChange={setFrom}
                testID="payouts-coverage-from" value={from} />
              {firstPurchase && from > firstPurchase ? (
                <AppText color="secondary" variant="caption" testID="payouts-coverage-late">
                  This starts after your first recorded purchase ({formatDate(firstPurchase)}), so returns stay unavailable.
                </AppText>
              ) : null}
              {message ? <AppText selectable style={styles.error} testID="payouts-coverage-error">{message}</AppText> : null}
              <View style={styles.actions}>
                <AppButton onPress={() => saveCoverage(from)} testID="payouts-coverage-save" title="Confirm complete" />
                <AppButton onPress={() => setEditingCoverage(false)} title="Cancel" variant="secondary" />
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              <AppButton onPress={() => setEditingCoverage(true)} testID="payouts-coverage-edit"
                title={coverage ? "Change date" : "Confirm record is complete"} variant="secondary" />
              {coverage ? (
                <AppButton onPress={() => saveCoverage(null)} testID="payouts-coverage-remove"
                  title="Remove confirmation" variant="ghost" />
              ) : null}
            </View>
          )}
        </PremiumCard>
        <PremiumCard section testID="payouts-list">
          <SectionHeader title="Recorded payouts" />
          <AppText color="secondary" variant="caption" testID="payouts-summary">
            {payoutsSummary(snapshot.distributions, coverage, assetId)}
          </AppText>
          {payouts.map((item) => (
            <GroupedListRow
              key={item.id}
              meta={`${treatmentLabel[item.treatment]}${item.taxWithheld ? ` · tax ${masked ? MASKED_INR_VALUE : formatINR(item.taxWithheld)}` : ""}`}
              onPress={() => onReviewPayout(item.id)}
              testID={`payout-row-${item.id}`}
              title={formatDate(item.paidOn)}
              value={masked ? MASKED_INR_VALUE : formatINR(payoutNet(item))}
            />
          ))}
          {payouts.length > 0 ? (
            <AppText color="secondary" variant="caption">Amounts are after tax withheld.</AppText>
          ) : null}
        </PremiumCard>
        <AppButton onPress={onAddPayout} testID="payouts-add" title="Add payout" />
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
}));
