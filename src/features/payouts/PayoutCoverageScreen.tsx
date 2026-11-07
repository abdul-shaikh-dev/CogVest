import { Ionicons } from "@expo/vector-icons";
import { useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  GroupedListRow,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  androidRipple,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "@/src/components/common";
import { formatDate } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles, useTheme } from "@/src/theme";

import { noPayoutEntries, payoutCoverageRows, type PayoutCoverageRow } from "./payoutCoverageModel";

const holdingCount = (n: number) => `${n} ${n === 1 ? "holding" : "holdings"}`;

/**
 * Confirms that several holdings paid nothing in the period the portfolio
 * return measures (#619). Nothing is selected by default, and the selection is
 * reviewed before it is saved.
 */
export function PayoutCoverageScreen({ now = new Date(), onBack, onReviewHolding, store = getPortfolioStore() }: {
  now?: Date;
  onBack: () => void;
  onReviewHolding: (assetId: string) => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { confirmable, withPayouts } = payoutCoverageRows(snapshot, now);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(0);
  const chosen = confirmable.filter((row) => selected.has(row.assetId));

  function toggle(assetId: string) {
    setSaved(0);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function confirm() {
    const result = store.getState().confirmDistributionCoverage(noPayoutEntries(confirmable, selected));
    if (result.status === "rejected") {
      setMessage("Nothing was saved. Go back and check the selected holdings.");
      return;
    }
    setMessage("");
    setSaved(chosen.length);
    setSelected(new Set());
    setReviewing(false);
  }

  const header = (
    <ScreenHeader
      leading={<IconButton accessibilityLabel="Back" icon="arrow-back"
        onPress={reviewing ? () => setReviewing(false) : onBack} testID="payout-coverage-back" />}
      subtitle="Portfolio return"
      title={reviewing ? "Review confirmation" : "Confirm payouts"}
    />
  );

  if (reviewing) {
    return (
      <ScreenContainer scroll testID="payout-coverage-review">
        <View style={styles.content}>
          {header}
          <PremiumCard section>
            <AppText weight="bold">No dividends or payouts in the period shown for {holdingCount(chosen.length)}:</AppText>
            {chosen.map((row) => (
              <View key={row.assetId} style={styles.reviewRow} testID={`payout-coverage-review-${row.assetId}`}>
                <AppText>{row.name}</AppText>
                <AppText color="secondary" variant="caption">Since {formatDate(row.requiredFrom)}</AppText>
              </View>
            ))}
            <AppText color="secondary" variant="caption">
              If any of these paid you, go back and record those payouts instead.
            </AppText>
          </PremiumCard>
          {message ? <AppText selectable style={styles.error} testID="payout-coverage-error">{message}</AppText> : null}
          <View style={styles.actions}>
            <AppButton onPress={confirm} testID="payout-coverage-confirm"
              title={`Confirm no payouts for ${holdingCount(chosen.length)}`} />
            <AppButton onPress={() => setReviewing(false)} testID="payout-coverage-edit" title="Change selection" variant="secondary" />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (!confirmable.length && !withPayouts.length) {
    return (
      <ScreenContainer testID="payout-coverage-screen">
        <View style={styles.content}>
          {header}
          {saved ? (
            <AppText accessibilityLiveRegion="polite" testID="payout-coverage-saved" weight="bold">
              Payouts confirmed for {holdingCount(saved)}.
            </AppText>
          ) : null}
          <EmptyState actionLabel="Back" message="Every holding in your portfolio return has its payouts confirmed."
            onAction={onBack} title="Payouts confirmed" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll testID="payout-coverage-screen">
      <View style={styles.content}>
        {header}
        <AppText color="secondary">
          These holdings count in your portfolio return, but their dividends and payouts aren't confirmed as recorded.
          Select the ones that paid you nothing in the period shown.
        </AppText>
        {saved ? (
          <AppText accessibilityLiveRegion="polite" testID="payout-coverage-saved" weight="bold">
            Payouts confirmed for {holdingCount(saved)}.
          </AppText>
        ) : null}
        {confirmable.length ? (
          <PremiumCard section testID="payout-coverage-list">
            {confirmable.map((row) => (
              <CoverageRow checked={selected.has(row.assetId)} key={row.assetId} onRecord={() => onReviewHolding(row.assetId)}
                onToggle={() => toggle(row.assetId)} row={row} />
            ))}
          </PremiumCard>
        ) : null}
        {withPayouts.length ? (
          <PremiumCard section testID="payout-coverage-with-payouts">
            <AppText weight="bold">Payouts recorded in the period</AppText>
            <AppText color="secondary" variant="caption">
              Check each record is complete on its own payouts screen.
            </AppText>
            {withPayouts.map((row) => (
              <GroupedListRow
                key={row.assetId}
                meta={`${row.recordedPayouts} recorded since ${formatDate(row.requiredFrom)}`}
                onPress={() => onReviewHolding(row.assetId)}
                showChevron
                testID={`payout-coverage-open-${row.assetId}`}
                title={row.name}
              />
            ))}
          </PremiumCard>
        ) : null}
        {confirmable.length ? (
          <AppButton disabled={!chosen.length} onPress={() => setReviewing(true)} testID="payout-coverage-continue"
            title={chosen.length ? `Review ${holdingCount(chosen.length)}` : "Select holdings to confirm"} />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function CoverageRow({ checked, onRecord, onToggle, row }: {
  checked: boolean;
  onRecord: () => void;
  onToggle: () => void;
  row: PayoutCoverageRow;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const since = `No payouts since ${formatDate(row.requiredFrom)}`;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={`${row.name}. ${since}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        android_ripple={androidRipple()}
        onPress={onToggle}
        style={({ pressed }) => [styles.check, getPressedStateStyle({ pressed })]}
        testID={`payout-coverage-select-${row.assetId}`}
      >
        <Ionicons color={checked ? colors.primary : colors.text.secondary} name={checked ? "checkbox" : "square-outline"} size={22} />
        <View style={styles.copy}>
          <AppText>{row.name}</AppText>
          <AppText color="secondary" variant="caption">{since}</AppText>
        </View>
      </Pressable>
      <IconButton accessibilityLabel={`Record payouts for ${row.name}`} icon="create-outline" onPress={onRecord}
        plain testID={`payout-coverage-record-${row.assetId}`} />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  check: { ...minimumTouchTargetStyle, alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  copy: { flex: 1 },
  error: { color: colors.loss },
  reviewRow: { gap: spacing.xs },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
}));
