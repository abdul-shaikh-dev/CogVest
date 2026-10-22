import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { validateMonthlySnapshot } from "@/src/domain/monthlySnapshotValidation";
import {
  AppButton,
  AppText,
  CategoryIcon,
  DisclosureButton,
  EmptyState,
  IconButton,
  MASKED_INR_VALUE,
  MaskedValue,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  assetClassLabel,
} from "@/src/components/common";
import { getMonthlySnapshotPriceConfidence } from "@/src/domain/calculations";
import {
  formatCompactINR,
  formatINR,
  formatPercentage,
} from "@/src/domain/formatters";
import { useReducedMotionPreference } from "@/src/hooks";
import type { resolveHistoricalPrice } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { isVisualQaSessionActive } from "@/src/testing/visualQaSeed";

import { EpfHistoryScope } from "./EpfHistoryScope";
import { MonthlyHistoryPanel } from "./MonthlyHistoryPanel";
import { MonthPickerField } from "./ProgressChartRange";
import { getProgressEmptyStateKind } from "./progressEmptyState";
import { useStyles } from "./progressStyles";
import { ProgressTrendCards } from "./ProgressTrendCards";
import {
  formatOptionalSignedCompactINR,
  getMonthLabel,
  getSingleEpfAccountId,
} from "./progressViewModel";
import { SnapshotStatusCard } from "./SnapshotStatusCard";
import { useProgress } from "./useProgress";

type ProgressScreenProps = {
  historicalPriceFetcher?: typeof resolveHistoricalPrice;
  now?: Date;
  onAddHolding?: () => void;
  /** Opens the EPF account when there is one, or the EPF accounts list when there are several. */
  onOpenEpf?: (accountId?: string) => void;
  onOpenHoldings?: () => void;
  onReviewSnapshot?: () => void;
  onSetUpPortfolio?: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

export function ProgressScreen({
  historicalPriceFetcher,
  now,
  onAddHolding,
  onOpenEpf,
  onOpenHoldings,
  onReviewSnapshot,
  onSetUpPortfolio,
  store = getPortfolioStore(),
}: ProgressScreenProps) {
  const styles = useStyles();
  const progress = useProgress({ historicalPriceFetcher, now, store });
  const hasInvalidSnapshot = store.getState().monthlySnapshots.some((snapshot) => Object.keys(validateMonthlySnapshot(snapshot)).length > 0);
  const futuresAccountCount = useSyncExternalStore(store.subscribe,
    () => store.getState().futuresAccounts.length,
    () => store.getState().futuresAccounts.length);
  const epfAccountCount = useSyncExternalStore(store.subscribe,
    () => store.getState().epf.accounts.length,
    () => store.getState().epf.accounts.length);
  const singleEpfAccountId = useSyncExternalStore(store.subscribe,
    () => getSingleEpfAccountId(store.getState()),
    () => getSingleEpfAccountId(store.getState()));
  const emptyStateKind = getProgressEmptyStateKind({ epfAccountCount, hasSnapshotRecords: progress.hasData });
  const isReducedMotionEnabled = useReducedMotionPreference();
  const isMinimalMode = progress.preferences.displayMode === "minimal";
  const isHistoryBuilding =
    !hasInvalidSnapshot &&
    !isVisualQaSessionActive() &&
    (progress.snapshotAutomationStatus.kind === "checking" ||
      progress.snapshotAutomationStatus.kind === "generating");
  const hasRunAutomationRef = useRef(false);
  const [summaryMonth, setSummaryMonth] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  useEffect(() => { setDetailsExpanded(false); }, [isMinimalMode]);
  const showDetails = !isMinimalMode || detailsExpanded;
  const selectedSummary = progress.monthlySummaries.find(item => item.snapshot.month === summaryMonth) ?? progress.latestSummary;

  useEffect(() => {
    if (hasRunAutomationRef.current || isVisualQaSessionActive()) {
      return;
    }

    if (hasInvalidSnapshot) return;
    hasRunAutomationRef.current = true;
    void progress.ensureMonthEndSnapshot({ retryProvisional: false });
  }, [progress]);

  function reviewSnapshot() {
    onReviewSnapshot?.();
  }

  function retrySnapshotAutomation() {
    void progress.ensureMonthEndSnapshot();
  }

  return (
    <ScreenContainer scroll testID="progress-screen">
      <View style={styles.content}>
        <ScreenHeader
          compact
          title="Monthly Progress"
          action={<IconButton
            plain
            accessibilityLabel={progress.preferences.maskWealthValues ? "Show values" : "Mask values"}
            icon={progress.preferences.maskWealthValues ? "eye-off-outline" : "eye-outline"}
            onPress={() => store.getState().updatePreferences({ maskWealthValues: !progress.preferences.maskWealthValues })}
            testID="progress-mask-toggle"
          />}
          subtitle={
            progress.latestSummary
              ? undefined
              : getMonthLabel()
          }
        />
        {hasInvalidSnapshot ? <PremiumCard testID="snapshot-repair-needed">
          <AppText weight="bold">Snapshot needs correction</AppText>
          <AppText color="secondary">History updates are paused. Review stored balances before backing up. Your values have not been changed.</AppText>
          <AppButton title="Review snapshot" onPress={reviewSnapshot} testID="snapshot-repair-action" />
        </PremiumCard> : null}
        {futuresAccountCount > 0 ? <PremiumCard testID="progress-futures-scope">
          <AppText weight="bold">Futures are not in monthly history</AppText>
          <AppText color="secondary" variant="caption">These stored month-end values exclude manual futures accounts. Current dashboard totals can include a reconciled futures wallet; past snapshots are not reconstructed from today's mark price or INR rate.</AppText>
        </PremiumCard> : null}
        <EpfHistoryScope maskWealthValues={progress.preferences.maskWealthValues}
          month={selectedSummary?.snapshot.month} now={now} store={store} />
        {selectedSummary ? (
          <>
            <View style={styles.monthlyAnswer} testID="progress-monthly-answer">
              <View style={styles.summaryActions}>
              <MonthPickerField label="Stored month-end value"
                months={progress.monthlySummaries.map(item => item.snapshot.month)}
                value={selectedSummary.snapshot.month} onChange={setSummaryMonth} testID="progress-summary-month" />
              <MonthlyHistoryPanel
                maskWealthValues={progress.preferences.maskWealthValues}
                minimal={isMinimalMode}
                summaries={progress.monthlySummaries}
              />
              </View>
              <MaskedValue
                exactValue={formatINR(selectedSummary.snapshot.portfolioValue)}
                masked={progress.preferences.maskWealthValues}
                style={styles.heroValue}
                value={formatCompactINR(selectedSummary.snapshot.portfolioValue)}
                weight="bold"
              />
              {getMonthlySnapshotPriceConfidence(selectedSummary.snapshot) === "provisional" ? (
                <AppText color="secondary" variant="caption">Estimated prices</AppText>
              ) : null}
              {isMinimalMode ? (
                <DisclosureButton
                  expanded={detailsExpanded}
                  onPress={() => setDetailsExpanded((visible) => !visible)}
                  testID="progress-details-toggle"
                  title="Comparisons & breakdowns"
                />
              ) : null}
              {showDetails ? <View style={styles.answerMetrics}>
                <View style={styles.answerMetric}>
                  <AppText color="secondary" variant="caption">Market change</AppText>
                  <MaskedValue
                    exactValue={
                      selectedSummary.performance.marketMovement === null
                        ? undefined
                        : formatINR(selectedSummary.performance.marketMovement)
                    }
                    masked={progress.preferences.maskWealthValues && selectedSummary.performance.marketMovement !== null}
                    value={formatOptionalSignedCompactINR(selectedSummary.performance.marketMovement)}
                    weight="bold"
                  />
                </View>
                <View style={styles.answerMetric}>
                  <AppText color="secondary" variant="caption">Monthly investment</AppText>
                  <MaskedValue
                    exactValue={formatINR(selectedSummary.snapshot.monthlyInvestment)}
                    masked={progress.preferences.maskWealthValues}
                    value={formatCompactINR(selectedSummary.snapshot.monthlyInvestment)}
                    weight="bold"
                  />
                </View>
              </View> : null}
            {hasInvalidSnapshot ? null : <SnapshotStatusCard
              onOpenHoldings={() => onOpenHoldings?.()}
              onReview={reviewSnapshot}
              onRetry={retrySnapshotAutomation}
              status={progress.snapshotAutomationStatus}
            />}
            </View>

            {hasInvalidSnapshot ? null : <ProgressTrendCards
              ppfExcludedHistory={progress.ppfExcludedHistory}
              assetChartCustomRange={progress.assetChartCustomRange}
              assetChartData={progress.assetChartData}
              assetChartRange={progress.assetChartRange}
              isReducedMotionEnabled={isReducedMotionEnabled}
              isHistoryBuilding={isHistoryBuilding}
              maskWealthValues={progress.preferences.maskWealthValues}
              onAssetCustomRangeChange={progress.setAssetChartCustomRange}
              onAssetRangeChange={progress.setAssetChartRange}
              onPortfolioCustomRangeChange={
                progress.setPortfolioChartCustomRange
              }
              onPortfolioRangeChange={progress.setPortfolioChartRange}
              portfolioChartCustomRange={progress.portfolioChartCustomRange}
              portfolioChartData={progress.portfolioChartData}
              portfolioChartRange={progress.portfolioChartRange}
              minimal={isMinimalMode}
              showDetails={showDetails}
            />}

          </>
        ) : progress.hasData ? (
          <>
            <MetricGroup
              metrics={[
                {
                  exactValue:
                    progress.portfolioValue === null
                      ? undefined
                      : formatINR(progress.portfolioValue),
                  label: epfAccountCount ? "Value ex. EPF" : "Portfolio",
                  masked:
                    progress.preferences.maskWealthValues &&
                    progress.portfolioValue !== null,
                  value:
                    progress.portfolioValue === null
                      ? "Valuation pending"
                      : formatCompactINR(progress.portfolioValue),
                },
                {
                  exactValue: formatINR(progress.totalInvested),
                  label: epfAccountCount ? "Invested ex. EPF" : "Invested",
                  masked: progress.preferences.maskWealthValues,
                  value: formatCompactINR(progress.totalInvested),
                },
                {
                  exactValue: formatINR(progress.cashBalance),
                  label: "Cash",
                  masked: progress.preferences.maskWealthValues,
                  value: formatCompactINR(progress.cashBalance),
                },
              ].filter((metric) => showDetails || metric.label === "Portfolio")}
            />

            {isMinimalMode ? (
              <DisclosureButton
                expanded={detailsExpanded}
                onPress={() => setDetailsExpanded((visible) => !visible)}
                testID="progress-details-toggle"
                title="Comparisons & breakdowns"
              />
            ) : null}

            {hasInvalidSnapshot ? null : <SnapshotStatusCard
              onOpenHoldings={() => onOpenHoldings?.()}
              onReview={reviewSnapshot}
              onRetry={retrySnapshotAutomation}
              status={progress.snapshotAutomationStatus}
            />}

            {isMinimalMode ? null : (
              <PremiumCard>
                <SectionHeader title="What changed this month?" />
                <AppText
                  accessibilityLabel={
                    progress.preferences.maskWealthValues
                      ? "Monthly investment: amount hidden"
                      : undefined
                  }
                  color="secondary"
                >
                  Monthly investment: {progress.preferences.maskWealthValues ? MASKED_INR_VALUE : formatINR(progress.monthlyInvestment)}
                </AppText>
              </PremiumCard>
            )}

            {hasInvalidSnapshot ? null : <ProgressTrendCards
              ppfExcludedHistory={progress.ppfExcludedHistory}
              assetChartCustomRange={progress.assetChartCustomRange}
              assetChartData={progress.assetChartData}
              assetChartRange={progress.assetChartRange}
              isReducedMotionEnabled={isReducedMotionEnabled}
              isHistoryBuilding={isHistoryBuilding}
              maskWealthValues={progress.preferences.maskWealthValues}
              onAssetCustomRangeChange={progress.setAssetChartCustomRange}
              onAssetRangeChange={progress.setAssetChartRange}
              onPortfolioCustomRangeChange={
                progress.setPortfolioChartCustomRange
              }
              onPortfolioRangeChange={progress.setPortfolioChartRange}
              portfolioChartCustomRange={progress.portfolioChartCustomRange}
              portfolioChartData={progress.portfolioChartData}
              portfolioChartRange={progress.portfolioChartRange}
              minimal={isMinimalMode}
              showDetails={showDetails}
            />}

            {showDetails ? <PremiumCard>
              <SectionHeader
                title={
                  progress.allocation.some((item) => item.percentage === null)
                    ? "Asset class balances"
                    : "Asset class snapshot"
                }
              />
              {progress.allocation.some((item) => item.percentage === null) ? (
                <AppText color="secondary" variant="caption">
                  Allocation percentages are unavailable while net portfolio
                  value is zero or negative.
                </AppText>
              ) : null}
              {progress.allocation.map((item) => (
                <View key={item.assetClass} style={styles.assetRow}>
                  <View style={styles.assetIdentity}>
                    <CategoryIcon assetClass={item.assetClass} />
                    <AppText weight="bold">{assetClassLabel(item.assetClass)}</AppText>
                  </View>
                  <View style={styles.assetValue}>
                    <MaskedValue
                      masked={progress.preferences.maskWealthValues}
                      value={formatINR(item.value)}
                    />
                    {item.percentage === null ? null : (
                      <AppText color="secondary" variant="caption">
                        {formatPercentage(item.percentage).replace("+", "")}
                      </AppText>
                    )}
                  </View>
                </View>
              ))}
            </PremiumCard> : null}
          </>
        ) : emptyStateKind === "epfOnly" ? (
          <EmptyState
            actionLabel={epfAccountCount === 1 ? "Open EPF account" : "Open EPF accounts"}
            actionTestID="progress-empty-open-epf"
            title="Monthly history starts with market or cash activity"
            message="Add holdings or Cash activity to start month-end history."
            onAction={() => onOpenEpf?.(singleEpfAccountId)}
            secondaryActionLabel="Add holdings"
            secondaryActionTestID="progress-empty-add-holding"
            onSecondaryAction={() => onAddHolding?.()}
          />
        ) : (
          <EmptyState
            actionLabel="Set up portfolio"
            actionTestID="progress-empty-setup"
            title="No portfolio history yet"
            message="Add or import holdings, PPF balances, or cash activity. CogVest will create monthly history automatically after that."
            onAction={() => onSetUpPortfolio?.()}
          />
        )}

      </View>
    </ScreenContainer>
  );
}
