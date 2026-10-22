import { useState } from "react";
import { View } from "react-native";

import { AppText, PremiumCard, SectionHeader } from "@/src/components/common";
import type {
  MonthlyChartCustomRange,
  MonthlyChartRange,
  MonthlyProgressChartData,
} from "@/src/domain/calculations";

import {
  ChartCardHeader,
  ChartRangeContext,
  ChartRangeSelector,
  CustomMonthRangeControls,
} from "./ProgressChartRange";
import { useStyles } from "./progressStyles";
import { TrendChart } from "./ProgressTrendChart";

export function ProgressTrendCards({
  assetChartCustomRange,
  assetChartData,
  assetChartRange,
  isReducedMotionEnabled,
  isHistoryBuilding,
  maskWealthValues,
  onAssetCustomRangeChange,
  onAssetRangeChange,
  onPortfolioCustomRangeChange,
  onPortfolioRangeChange,
  portfolioChartCustomRange,
  portfolioChartData,
  portfolioChartRange,
  minimal,
  ppfExcludedHistory,
  showDetails = true,
}: {
  assetChartCustomRange: MonthlyChartCustomRange;
  assetChartData: MonthlyProgressChartData;
  assetChartRange: MonthlyChartRange;
  isReducedMotionEnabled: boolean;
  isHistoryBuilding: boolean;
  maskWealthValues: boolean;
  onAssetCustomRangeChange: (range: MonthlyChartCustomRange) => void;
  onAssetRangeChange: (range: MonthlyChartRange) => void;
  onPortfolioCustomRangeChange: (range: MonthlyChartCustomRange) => void;
  onPortfolioRangeChange: (range: MonthlyChartRange) => void;
  portfolioChartCustomRange: MonthlyChartCustomRange;
  portfolioChartData: MonthlyProgressChartData;
  portfolioChartRange: MonthlyChartRange;
  minimal: boolean;
  ppfExcludedHistory: { estimatedMonths: string[]; missingMonths: string[] } | null;
  showDetails?: boolean;
}) {
  const styles = useStyles();
  const [customRangeTarget, setCustomRangeTarget] = useState<"asset" | "portfolio" | null>(null);

  if (isHistoryBuilding) {
    return (
      <PremiumCard testID="progress-trends-building">
        <SectionHeader title="Trend history is still building" />
        <View style={styles.chartPlaceholder}>
          <AppText color="secondary" align="center">
            Charts will appear when CogVest finishes checking the stored months.
          </AppText>
        </View>
      </PremiumCard>
    );
  }

  if (
    portfolioChartData.availableMonths.length < 2 &&
    assetChartData.availableMonths.length < 2
  ) {
    return (
      <PremiumCard>
        <SectionHeader title="Trend history is still building" />
        <View style={styles.chartPlaceholder}>
          <AppText color="secondary" align="center">
            {ppfExcludedHistory
              ? "PPF is excluded: earlier balances are unknown. At least 2 consecutive valued months of market and cash records are needed for this chart. Missing prices must be resolved before a trend can be shown."
              : "Record at least 2 monthly snapshots to compare portfolio and asset trends."}
          </AppText>
        </View>
      </PremiumCard>
    );
  }

  return (
    <>
      {ppfExcludedHistory ? (
        <PremiumCard testID="ppf-excluded-chart-notice">
          <SectionHeader title="Market and cash history" />
          <AppText color="secondary">
            PPF is excluded from every month in these charts because its earlier balances are unknown.
            These are reconstructed values, not complete portfolio snapshots.
          </AppText>
          {ppfExcludedHistory.estimatedMonths.length > 0 ? (
            <AppText color="secondary" variant="caption">
              Some months use estimated prices, not confirmed historical closes.
            </AppText>
          ) : null}
          {ppfExcludedHistory.missingMonths.length > 0 ? (
            <AppText color="secondary" variant="caption">
              Some months could not be valued. Only the latest uninterrupted history is shown; missing months are not joined across.
            </AppText>
          ) : null}
        </PremiumCard>
      ) : null}
      <PremiumCard section>
        <ChartCardHeader
          subtitle={ppfExcludedHistory ? "Market holdings + cash · PPF excluded" : showDetails ? "Portfolio and invested capital · not investment return" : "Month-end portfolio value · includes cash"}
          title={ppfExcludedHistory ? "Tracked Growth" : "Portfolio Growth"}
        />
        <ChartRangeSelector
          onChange={onPortfolioRangeChange}
          onOpenCustom={() => setCustomRangeTarget("portfolio")}
          selectedRange={portfolioChartRange}
          testIDPrefix="portfolio-monthly-chart-range"
        />
        <ChartRangeContext
          monthLabels={portfolioChartData.monthLabels}
          hasGaps={portfolioChartData.gapAfterIndices.length > 0}
          testID="portfolio-chart-context"
        />
        {portfolioChartData.hasEnoughHistory ? (
          <TrendChart
            partialHistory={ppfExcludedHistory !== null}
            portfolioLabel={ppfExcludedHistory ? "Market + cash" : "Portfolio"}
            key={`${portfolioChartRange}:${portfolioChartCustomRange.startMonth}:${portfolioChartCustomRange.endMonth}:${portfolioChartData.monthLabels.join("|")}`}
            isReducedMotionEnabled={isReducedMotionEnabled}
            maskWealthValues={maskWealthValues}
            minimal={minimal}
            summaryOnly={!showDetails}
            monthLabels={portfolioChartData.monthLabels}
            estimatedIndices={portfolioChartData.estimatedIndices}
            gapAfterIndices={portfolioChartData.gapAfterIndices}
            series={ppfExcludedHistory ? portfolioChartData.portfolioSeries.filter(item => item.label !== "Invested") : portfolioChartData.portfolioSeries}
            investedComparisons={portfolioChartData.investedComparisons}
            testIDPrefix="portfolio-trend"
          />
        ) : (
          <View style={styles.chartPlaceholder}>
            <AppText color="secondary" align="center">
              Select at least 2 available months to show this trend.
            </AppText>
          </View>
        )}
      </PremiumCard>
      {showDetails ? <PremiumCard section>
        <ChartCardHeader
          subtitle={ppfExcludedHistory ? "Cash and PPF excluded · includes money added or withdrawn" : "Cash excluded · includes money added or withdrawn"}
          title="Value by asset class"
        />
        <ChartRangeSelector
          onChange={onAssetRangeChange}
          onOpenCustom={() => setCustomRangeTarget("asset")}
          selectedRange={assetChartRange}
          testIDPrefix="asset-monthly-chart-range"
        />
        <ChartRangeContext
          monthLabels={assetChartData.monthLabels}
          hasGaps={assetChartData.gapAfterIndices.length > 0}
          testID="asset-chart-context"
        />
        {assetChartData.hasEnoughHistory ? (
          <>
            <TrendChart
              partialHistory={ppfExcludedHistory !== null}
              key={`${assetChartRange}:${assetChartCustomRange.startMonth}:${assetChartCustomRange.endMonth}:${assetChartData.monthLabels.join("|")}`}
              isReducedMotionEnabled={isReducedMotionEnabled}
              maskWealthValues={maskWealthValues}
              minimal={minimal}
              monthLabels={assetChartData.monthLabels}
              estimatedIndices={assetChartData.estimatedIndices}
              gapAfterIndices={assetChartData.gapAfterIndices}
              series={assetChartData.assetSeries}
              testIDPrefix="asset-trend"
            />
          </>
        ) : (
          <View style={styles.chartPlaceholder}>
            <AppText color="secondary" align="center">
              Select at least 2 available months to show this trend.
            </AppText>
          </View>
        )}
      </PremiumCard> : null}
      {customRangeTarget === "portfolio" ? (
        <CustomMonthRangeControls
          appliedRange={portfolioChartCustomRange}
          availableMonths={portfolioChartData.availableMonths}
          chartTitle="Portfolio Growth"
          onCancel={() => setCustomRangeTarget(null)}
          onApply={(range) => {
            onPortfolioCustomRangeChange(range);
            onPortfolioRangeChange("Custom");
            setCustomRangeTarget(null);
          }}
          testIDPrefix="portfolio-custom-range"
        />
      ) : null}
      {customRangeTarget === "asset" ? (
        <CustomMonthRangeControls
          appliedRange={assetChartCustomRange}
          availableMonths={assetChartData.availableMonths}
          chartTitle="Value by asset class"
          onCancel={() => setCustomRangeTarget(null)}
          onApply={(range) => {
            onAssetCustomRangeChange(range);
            onAssetRangeChange("Custom");
            setCustomRangeTarget(null);
          }}
          testIDPrefix="asset-custom-range"
        />
      ) : null}
    </>
  );
}
