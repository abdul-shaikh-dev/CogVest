import { useState, useSyncExternalStore } from "react";
import { Linking, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";
import {
  AppButton,
  AppText,
  EmptyState,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import { calculateHoldings } from "@/src/domain/calculations";
import {
  getHoldingDuration,
  INDIA_HOLDING_DURATION_RULE,
} from "@/src/domain/calculations/holdingDuration";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { formatDate } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";

export function HoldingDurationScreen({
  onClose,
  store = getPortfolioStore(),
  now = new Date(),
}: {
  onClose: () => void;
  store?: StoreApi<PortfolioStoreState>;
  now?: Date;
}) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const [sourceError, setSourceError] = useState(false);
  const masked = state.preferences.maskWealthValues;
  const minimal = state.preferences.displayMode === "minimal";
  const holdings = calculateHoldings({ ...state, now }).filter((holding) =>
    ["stock", "etf"].includes(holding.asset.assetClass),
  );
  return (
    <ScreenContainer scroll testID="holding-duration-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Holding duration"
          subtitle="Informational reference"
          leading={
            <IconButton
              icon="arrow-back"
              accessibilityLabel="Back"
              onPress={onClose}
              testID="duration-back"
            />
          }
          action={
            <IconButton
              icon={masked ? "eye-off-outline" : "eye-outline"}
              accessibilityLabel={masked ? "Show values" : "Mask values"}
              onPress={() =>
                state.updatePreferences({ maskWealthValues: !masked })
              }
              testID="duration-mask"
            />
          }
        />
        <AppText color="secondary">
          Recorded holding time, not a tax eligibility check.
        </AppText>
        {minimal ? (
          <EmptyState
            title="Optional analysis is paused"
            message="Minimal Mode keeps this reference out of view."
            actionLabel="Done"
            onAction={onClose}
          />
        ) : masked ? (
          <AppText color="secondary">
            Holdings and acquisition dates are hidden while values are masked.
          </AppText>
        ) : holdings.length === 0 ? (
          <EmptyState
            title="No stock or ETF holdings"
            message="This optional reference does not apply to cash, crypto, debt or PPF."
            actionLabel="Back to Holdings"
            onAction={onClose}
          />
        ) : (
          holdings.map(({ asset }) => {
            const duration = getHoldingDuration({
              ...state,
              asset,
              asOf: formatLocalCalendarDate(now),
            });
            return (
              <PremiumCard
                key={asset.id}
                style={styles.group}
                testID={`duration-${asset.id}`}
              >
                <AppText weight="bold">{asset.name}</AppText>
                {duration.status === "unavailable" ? (
                  <>
                    <AppText weight="medium">Comparison unavailable</AppText>
                    <AppText color="secondary">{duration.reason}</AppText>
                  </>
                ) : (
                  <>
                    <AppText weight="bold">
                      {duration.beyondReference
                        ? `More than ${INDIA_HOLDING_DURATION_RULE.months} months recorded`
                        : `Within the ${INDIA_HOLDING_DURATION_RULE.months}-month reference`}
                    </AppText>
                    <AppText color="secondary">
                      Acquired {formatDate(duration.acquiredOn)} ·{" "}
                      {duration.elapsedDays} elapsed days
                    </AppText>
                    <AppText color="secondary">
                      {INDIA_HOLDING_DURATION_RULE.months}-month anniversary:{" "}
                      {formatDate(duration.anniversary)}
                    </AppText>
                    <AppText color="secondary">
                      As of {formatDate(duration.observedOn)} · one recorded
                      acquisition.
                    </AppText>
                  </>
                )}
              </PremiumCard>
            );
          })
        )}
        <PremiumCard style={styles.group}>
          <AppText weight="bold">About this reference</AppText>
          <AppText color="secondary">
            {INDIA_HOLDING_DURATION_RULE.jurisdiction} · rules reviewed{" "}
            {formatDate(INDIA_HOLDING_DURATION_RULE.rulesAsOf)}. The
            listed-security reference is more than{" "}
            {INDIA_HOLDING_DURATION_RULE.months} calendar months, not a fixed
            number of days. Exceptions and your complete transaction history can
            change tax treatment.
          </AppText>
          <AppButton
            title="Read official guidance"
            variant="secondary"
            onPress={() => {
              setSourceError(false);
              void Linking.openURL(INDIA_HOLDING_DURATION_RULE.sourceUrl).catch(
                () => setSourceError(true),
              );
            }}
          />
          {sourceError ? (
            <AppText accessibilityLiveRegion="polite">
              Could not open the guidance. Try again when a browser is
              available.
            </AppText>
          ) : null}
          <AppText color="secondary" variant="caption">
            Informational only, not financial or tax advice. Verify against your
            broker records and applicable rules before relying on a tax
            classification.
          </AppText>
        </PremiumCard>
        {!minimal ? (
          <AppButton title="Done" variant="secondary" onPress={onClose} />
        ) : null}
      </View>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  content: { gap: spacing.cardGap, paddingTop: spacing.md },
  group: { gap: spacing.sm },
});
