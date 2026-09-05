import { useEffect, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  GroupedListRow,
  IconButton,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { formatINR, formatPercentage } from "@/src/domain/formatters";
import { AddOpeningPositionForm } from "@/src/features/openingPositions/AddOpeningPositionForm";
import { useDashboard } from "@/src/features/dashboard";
import type { AssetLookupSearchResult } from "@/src/services/assetLookup";
import type { QuoteResult, ResolveQuoteInput } from "@/src/services/quotes";
import {
  getPortfolioStore,
  type OpeningPositionCommandResult,
  type PortfolioStoreState,
} from "@/src/store";
import { spacing } from "@/src/theme";

import {
  getQuickSetupSessionStore,
  type QuickSetupSessionState,
  useQuickSetupSession,
} from "./quickSetupSession";

type QuickPortfolioSetupScreenProps = {
  hardwareBackEnabled?: boolean;
  now?: Date;
  onAddPpfAccount: () => void;
  onComplete: () => void;
  onExit: () => void;
  resolveQuote?: (input: ResolveQuoteInput) => Promise<QuoteResult>;
  searchAssetLookupResults?: (input: {
    query: string;
  }) => Promise<AssetLookupSearchResult>;
  sessionStore?: StoreApi<QuickSetupSessionState>;
  store?: StoreApi<PortfolioStoreState>;
};

function formatSignedINR(value: number) {
  const formatted = formatINR(value);
  return value > 0 ? `+${formatted}` : formatted;
}

export function QuickPortfolioSetupScreen({
  hardwareBackEnabled = true,
  now,
  onAddPpfAccount,
  onComplete,
  onExit,
  resolveQuote,
  searchAssetLookupResults,
  sessionStore = getQuickSetupSessionStore(),
  store = getPortfolioStore(),
}: QuickPortfolioSetupScreenProps) {
  const setup = useQuickSetupSession(sessionStore);
  const portfolio = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const dashboard = useDashboard({ store });

  useEffect(() => {
    sessionStore.getState().start();
  }, [sessionStore]);

  const session = setup.session;
  const savedCount = session?.items.length ?? 0;

  function recordSavedHolding(
    result: OpeningPositionCommandResult,
    action: "addNext" | "finish",
  ) {
    sessionStore.getState().recordItem({
      assetId: result.asset.id,
      kind: "openingPosition",
      name: result.asset.name,
      recordId: result.openingPosition.id,
    });

    if (action === "finish") {
      sessionStore.getState().showReview();
    }
  }

  if (session?.stage === "review") {
    const totalCurrent = dashboard.rollupTotals.totalCurrentValue;
    const totalPnl = dashboard.rollupTotals.pnl;
    const totalPnlPct = dashboard.rollupTotals.pnlPct;
    const pending = dashboard.rollupTotals.valuationCoverage.pendingHoldings;
    const itemExists = (kind: "openingPosition" | "ppfAccount", recordId: string) =>
      kind === "openingPosition"
        ? portfolio.openingPositions.some((position) => position.id === recordId)
        : portfolio.ppfAccounts.some((account) => account.id === recordId);
    const missingItems = session.items.filter(
      (item) => !itemExists(item.kind, item.recordId),
    );

    return (
      <ScreenContainer scroll testID="quick-setup-review-screen">
        <ScreenHeader
          leading={
            <IconButton
              accessibilityLabel="Back to portfolio setup"
              icon="arrow-back"
              onPress={() => sessionStore.getState().showEntry()}
              testID="quick-setup-review-back"
            />
          }
          subtitle={`${savedCount} ${savedCount === 1 ? "holding" : "holdings"} confirmed locally`}
          title="Review portfolio"
        />

        <PremiumCard elevated testID="quick-setup-summary">
          <SectionHeader title="Portfolio summary" />
          <MetricGroup
            metrics={[
              {
                label: "Invested",
                masked: dashboard.maskWealthValues,
                value: formatINR(dashboard.rollupTotals.totalInvested),
              },
              {
                label: "Current",
                masked: dashboard.maskWealthValues && totalCurrent !== null,
                value: totalCurrent === null ? "Pending" : formatINR(totalCurrent),
              },
              {
                color: (totalPnl ?? 0) >= 0 ? "primary" : "secondary",
                label: "P&L",
                masked: dashboard.maskWealthValues && totalPnl !== null,
                value:
                  totalPnl === null ? "Pending" : formatSignedINR(totalPnl),
              },
              {
                color: (totalPnlPct ?? 0) >= 0 ? "primary" : "secondary",
                label: "P&L %",
                value:
                  totalPnlPct === null ? "Pending" : formatPercentage(totalPnlPct),
              },
            ]}
            testID="quick-setup-summary-metrics"
          />
        </PremiumCard>

        {pending > 0 ? (
          <PremiumCard testID="quick-setup-missing-values">
            <AppText weight="bold">{pending} current price {pending === 1 ? "is" : "are"} still needed</AppText>
            <AppText color="secondary" variant="caption">
              These holdings are saved. Refresh prices or add a manual valuation later from Holdings.
            </AppText>
          </PremiumCard>
        ) : null}

        {missingItems.length > 0 ? (
          <PremiumCard testID="quick-setup-missing-records">
            <AppText weight="bold">
              {missingItems.length} setup {missingItems.length === 1 ? "item no longer exists" : "items no longer exist"}
            </AppText>
            <AppText color="secondary" variant="caption">
              Remove missing references from this review, then finish or add the holding again.
            </AppText>
          </PremiumCard>
        ) : null}

        <View style={styles.list} testID="quick-setup-confirmed-items">
          <SectionHeader title="Confirmed in this setup" />
          <PremiumCard>
            {session.items.map((item) => {
              const exists = itemExists(item.kind, item.recordId);

              return (
                <GroupedListRow
                  key={`${item.kind}-${item.recordId}`}
                  meta={
                    exists
                      ? item.kind === "ppfAccount"
                        ? "PPF account"
                        : "Opening position"
                      : "Removed outside setup. Tap to remove this reference."
                  }
                  onPress={
                    exists
                      ? undefined
                      : () =>
                          sessionStore
                            .getState()
                            .removeItem(item.kind, item.recordId)
                  }
                  title={item.name}
                  value={exists ? "Saved" : "Remove"}
                />
              );
            })}
          </PremiumCard>
        </View>

        <View style={styles.actions}>
          <AppButton
            onPress={() => sessionStore.getState().showEntry()}
            testID="quick-setup-review-add-more"
            title="Add another holding"
            variant="secondary"
          />
          <AppButton
            disabled={missingItems.length > 0}
            onPress={() => {
              sessionStore.getState().finish();
              onComplete();
            }}
            testID="quick-setup-complete"
            title="Open Dashboard"
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <AddOpeningPositionForm
      hardwareBackEnabled={hardwareBackEnabled}
      now={now}
      onAddPpfAccount={onAddPpfAccount}
      onCancel={onExit}
      onQuickSetupItemSaved={recordSavedHolding}
      quickSetup
      quickSetupSavedCount={savedCount}
      resolveQuote={resolveQuote}
      searchAssetLookupResults={searchAssetLookupResults}
      store={store}
    />
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
});
