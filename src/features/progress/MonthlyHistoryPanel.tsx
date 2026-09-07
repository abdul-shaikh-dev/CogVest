import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppButton,
  AppText,
  assetClassLabel,
  CategoryIcon,
  PremiumCard,
  androidRipple,
  getPressedStateStyle,
} from "@/src/components/common";
import type { MonthlyProgressSummary } from "@/src/domain/calculations";
import { formatCompactINR, formatPercentage } from "@/src/domain/formatters";
import { decimal, normalizePercentage } from "@/src/domain/precision";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { AssetClass } from "@/src/types";

type MonthlyHistoryPanelProps = {
  maskWealthValues: boolean;
  minimal: boolean;
  summaries: MonthlyProgressSummary[];
};

type AssetMetric = {
  assetClass: AssetClass;
  current: number;
  previous: number | undefined;
};

const maskedValue = "₹••••";
const assetClasses: AssetClass[] = ["stock", "debt", "crypto", "cash"];

function formatMonth(month: string) {
  const [year, monthPart] = month.split("-");

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(Number(year), Number(monthPart) - 1, 1)));
}

function formatShortMonth(month: string) {
  const [year, monthPart] = month.split("-");

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(monthPart) - 1, 1)));
}

function previousCalendarMonth(month: string) {
  const [year, monthPart] = month.split("-");
  const previous = new Date(Date.UTC(Number(year), Number(monthPart) - 2, 1));

  return `${previous.getUTCFullYear()}-${String(
    previous.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function calculatePercentageChange(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) {
    return null;
  }

  return normalizePercentage(
    decimal(current).minus(previous).dividedBy(decimal(previous).abs()).times(100),
  );
}

function formatSignedValue(value: number) {
  const amount = formatCompactINR(Math.abs(value));

  if (value > 0) return `+${amount}`;
  if (value < 0) return `-${amount}`;
  return amount;
}

function formatComparison(change: number | null, hasCalendarPrevious: boolean) {
  if (!hasCalendarPrevious) return "No prior month";
  if (change === null) return "No % baseline";
  return formatPercentage(change);
}

function getAssetAllocation(summary: MonthlyProgressSummary, assetClass: AssetClass) {
  return summary.assetSnapshot.find((item) => item.assetClass === assetClass)
    ?.percentage;
}

export function MonthlyHistoryPanel({
  maskWealthValues,
  minimal,
  summaries,
}: MonthlyHistoryPanelProps) {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const overviewScrollOffsetRef = useRef(0);
  const isRestoringOverviewRef = useRef(false);
  const rowRefs = useRef<Record<string, View | null>>({});
  const originMonthRef = useRef<string | null>(null);

  const summariesByMonth = new Map(
    summaries.map((summary) => [summary.snapshot.month, summary]),
  );
  const years = [...new Set(summaries.map((summary) => summary.snapshot.month.slice(0, 4)))].sort(
    (left, right) => right.localeCompare(left),
  );
  const selectedSummary = selectedMonth
    ? summariesByMonth.get(selectedMonth)
    : undefined;
  const isDetailVisible = Boolean(selectedSummary);
  const overviewSummaries = summaries
    .filter((summary) => summary.snapshot.month.startsWith(`${selectedYear}-`))
    .sort((left, right) => right.snapshot.month.localeCompare(left.snapshot.month));

  useEffect(() => {
    if (!years.length) {
      setSelectedYear("");
      return;
    }

    if (!years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [selectedYear, years]);

  useEffect(() => {
    if (!isVisible) return;

    let frame: number;
    if (isDetailVisible) {
      isRestoringOverviewRef.current = false;
      frame = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ animated: false, y: 0 });
      });
    } else if (isRestoringOverviewRef.current) {
      const originMonth = originMonthRef.current;
      const restoreOffset = overviewScrollOffsetRef.current;

      // Wait for the overview rows to mount before restoring scroll and focus.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ animated: false, y: restoreOffset });
          const origin = originMonth ? rowRefs.current[originMonth] : null;
          const handle = origin ? findNodeHandle(origin) : null;

          if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
          frame = requestAnimationFrame(() => {
            isRestoringOverviewRef.current = false;
          });
        });
      });
    } else {
      return;
    }

    return () => cancelAnimationFrame(frame);
  }, [isDetailVisible, isVisible]);

  if (!summaries.length) return null;

  function openHistory() {
    setSelectedYear(years[0]);
    setSelectedMonth(null);
    overviewScrollOffsetRef.current = 0;
    isRestoringOverviewRef.current = false;
    originMonthRef.current = null;
    setIsVisible(true);
  }

  function closeHistory() {
    setIsVisible(false);
    setSelectedMonth(null);
    isRestoringOverviewRef.current = false;
  }

  function openMonth(month: string) {
    originMonthRef.current = month;
    setSelectedMonth(month);
  }

  function showOverview() {
    isRestoringOverviewRef.current = true;
    setSelectedMonth(null);
  }

  function requestClose() {
    if (selectedMonth) {
      showOverview();
    } else {
      closeHistory();
    }
  }

  return (
    <>
      <PremiumCard style={styles.entryCard} testID="monthly-history-panel">
        <View style={styles.entryCopy}>
          <AppText variant="title" weight="bold">
            Monthly History
          </AppText>
          <AppText color="secondary" variant="caption">
            Review stored month-end values and changes.
          </AppText>
        </View>
        <AppButton
          onPress={openHistory}
          style={styles.entryAction}
          testID="open-monthly-history"
          title="View history"
          variant="secondary"
        />
      </PremiumCard>

      <Modal
        animationType="none"
        onRequestClose={requestClose}
        testID="monthly-history-modal"
        transparent
        visible={isVisible}
      >
        <View style={[styles.modalBackdrop, { paddingTop: insets.top }]}>
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.md), paddingTop: spacing.md },
            ]}
          >
            <View style={styles.sheetHeader}>
              {isDetailVisible ? (
                <Pressable
                  accessibilityLabel="Back to monthly history"
                  accessibilityRole="button"
                  android_ripple={androidRipple()}
                  onPress={showOverview}
                  style={({ pressed }) => [styles.headerButton, getPressedStateStyle({ pressed })]}
                  testID="history-back"
                >
                  <AppText weight="bold">Back</AppText>
                </Pressable>
              ) : (
                <View style={styles.headerButton} />
              )}
              <AppText align="center" style={styles.sheetTitle} variant="title" weight="bold">
                {selectedSummary ? formatMonth(selectedSummary.snapshot.month) : "Monthly History"}
              </AppText>
              <Pressable
                accessibilityLabel="Close monthly history"
                accessibilityRole="button"
                android_ripple={androidRipple()}
                onPress={closeHistory}
                style={({ pressed }) => [styles.headerButton, getPressedStateStyle({ pressed })]}
                testID="close-monthly-history"
              >
                <AppText color="secondary" weight="bold">Close</AppText>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetContent}
              onScroll={(event) => {
                if (!selectedMonth && !isRestoringOverviewRef.current) {
                  overviewScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
                }
              }}
              ref={scrollRef}
              scrollEventThrottle={16}
              testID="monthly-history-scroll"
            >
              {selectedSummary ? (
                <MonthDetail
                  maskWealthValues={maskWealthValues}
                  minimal={minimal}
                  previousSummary={summariesByMonth.get(previousCalendarMonth(selectedSummary.snapshot.month))}
                  summary={selectedSummary}
                />
              ) : (
                <>
                  <AppText color="secondary" variant="caption">
                    Select a year. Months are stored newest first.
                  </AppText>
                  <AppText color="secondary" variant="caption">
                    Portfolio change includes deposits and withdrawals. It is not investment return.
                  </AppText>
                  <View accessibilityRole="tablist" style={styles.yearList}>
                    {years.map((year) => {
                      const isSelected = selectedYear === year;

                      return (
                        <Pressable
                          accessibilityRole="tab"
                          accessibilityState={{ selected: isSelected }}
                          android_ripple={androidRipple()}
                          key={year}
                          onPress={() => setSelectedYear(year)}
                          style={({ pressed }) => [
                            styles.yearButton,
                            isSelected ? styles.yearButtonSelected : null,
                            getPressedStateStyle({ pressed }),
                          ]}
                          testID={`history-year-${year}`}
                        >
                          <AppText color={isSelected ? "inverse" : "secondary"} weight="bold">
                            {year}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <AppText color="secondary" variant="caption">
                    {overviewSummaries.length} stored month{overviewSummaries.length === 1 ? "" : "s"}. Tap a month for its breakdown.
                  </AppText>
                  <View style={styles.historyColumns}>
                    <AppText color="secondary" style={styles.historyMonthColumn} variant="caption">Month</AppText>
                    <AppText align="right" color="secondary" style={styles.historyValueColumn} variant="caption">Portfolio</AppText>
                    <AppText align="right" color="secondary" style={styles.historyValueColumn} variant="caption">Change</AppText>
                    <View style={styles.historyChevronColumn} />
                  </View>
                  {overviewSummaries.map((summary) => {
                    const month = summary.snapshot.month;
                    const previousSummary = summariesByMonth.get(previousCalendarMonth(month));
                    const change = calculatePercentageChange(
                      summary.snapshot.portfolioValue,
                      previousSummary?.snapshot.portfolioValue,
                    );
                    const comparison = maskWealthValues
                      ? "Hidden"
                      : formatComparison(change, Boolean(previousSummary));

                    return (
                      <Pressable
                        accessibilityLabel={`View ${formatMonth(month)} details. Portfolio ${
                          maskWealthValues ? "hidden" : formatCompactINR(summary.snapshot.portfolioValue)
                        }. ${comparison}.`}
                        accessibilityRole="button"
                        android_ripple={androidRipple()}
                        key={summary.snapshot.id}
                        onPress={() => openMonth(month)}
                        ref={(node) => {
                          rowRefs.current[month] = node;
                        }}
                        style={({ pressed }) => [styles.historyRow, getPressedStateStyle({ pressed })]}
                        testID={`snapshot-month-${month}`}
                      >
                        <AppText style={styles.historyMonthColumn} weight="bold">{formatShortMonth(month)}</AppText>
                        <AppText align="right" style={styles.historyValueColumn} weight="bold">
                          {maskWealthValues ? maskedValue : formatCompactINR(summary.snapshot.portfolioValue)}
                        </AppText>
                        <AppText
                          align="right"
                          color={minimal || maskWealthValues || change === null ? "secondary" : "primary"}
                          numberOfLines={2}
                          style={[
                            styles.historyValueColumn,
                            !minimal && !maskWealthValues && change !== null ? change < 0 ? styles.lossText : styles.gainText : undefined,
                          ]}
                          weight="bold"
                        >
                          {comparison}
                        </AppText>
                        <AppText color="secondary" style={[styles.chevron, styles.historyChevronColumn]} weight="bold">›</AppText>
                      </Pressable>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MonthDetail({
  maskWealthValues,
  minimal,
  previousSummary,
  summary,
}: {
  maskWealthValues: boolean;
  minimal: boolean;
  previousSummary: MonthlyProgressSummary | undefined;
  summary: MonthlyProgressSummary;
}) {
  const snapshot = summary.snapshot;
  const previousSnapshot = previousSummary?.snapshot;
  const portfolioChange = calculatePercentageChange(
    snapshot.portfolioValue,
    previousSnapshot?.portfolioValue,
  );
  const assetMetrics: AssetMetric[] = assetClasses.map((assetClass) => ({
    assetClass,
    current:
      assetClass === "stock"
        ? snapshot.equityValue
        : assetClass === "debt"
          ? snapshot.debtValue
          : assetClass === "crypto"
            ? snapshot.cryptoValue
            : snapshot.cashValue,
    previous:
      assetClass === "stock"
        ? previousSnapshot?.equityValue
        : assetClass === "debt"
          ? previousSnapshot?.debtValue
          : assetClass === "crypto"
            ? previousSnapshot?.cryptoValue
            : previousSnapshot?.cashValue,
  }));
  const capitalRows = [
    { label: "Invested capital", value: snapshot.investedValue },
    {
      label: "Total portfolio change",
      signed: true,
      value: previousSummary ? summary.performance.totalValueChange : null,
    },
    { label: "Monthly investment", value: snapshot.monthlyInvestment },
    { label: "Net contribution", signed: true, value: summary.performance.netExternalFlow },
    {
      label: "Market change",
      signed: true,
      value: previousSummary ? summary.performance.marketMovement : null,
    },
    { label: "Salary", value: snapshot.salary },
    { label: "Expenses", value: snapshot.monthlyExpense },
  ];

  return (
    <View style={styles.detail} testID="selected-snapshot-summary">
      <AppText color="secondary" variant="caption">Month-end portfolio value</AppText>
      <AppText style={styles.detailPortfolio} weight="bold">
        {maskWealthValues ? maskedValue : formatCompactINR(snapshot.portfolioValue)}
      </AppText>
      <AppText
        color="secondary"
        style={!minimal && !maskWealthValues && portfolioChange !== null ? portfolioChange < 0 ? styles.lossText : styles.gainText : undefined}
        variant="caption"
        weight="bold"
      >
        {maskWealthValues
          ? "Hidden"
          : `${formatComparison(portfolioChange, Boolean(previousSummary))}${
              previousSummary ? ` vs ${formatMonth(previousSummary.snapshot.month)}` : ""
            }`}
      </AppText>

      <DetailSection title="What changed">
        {assetMetrics.map((metric) => {
          const change = calculatePercentageChange(metric.current, metric.previous);
          const allocation = getAssetAllocation(summary, metric.assetClass);
          const detail = maskWealthValues
            ? "Hidden"
            : allocation === undefined
              ? "Allocation unavailable"
              : `${formatPercentage(allocation).replace("+", "")} allocation`;

          return (
            <View key={metric.assetClass} style={styles.detailRow}>
              <View style={styles.assetLabel}>
                <CategoryIcon assetClass={metric.assetClass} size={18} />
                <View>
                  <AppText weight="bold">{assetClassLabel(metric.assetClass)}</AppText>
                  <AppText color="secondary" variant="caption">{detail}</AppText>
                </View>
              </View>
              <View style={styles.valueColumn}>
                <AppText weight="bold">{maskWealthValues ? maskedValue : formatCompactINR(metric.current)}</AppText>
                <AppText
                  color="secondary"
                  style={!minimal && !maskWealthValues && change !== null ? change < 0 ? styles.lossText : styles.gainText : undefined}
                  variant="caption"
                >
                  {maskWealthValues
                    ? "Hidden"
                    : `${formatComparison(change, Boolean(previousSummary))}${
                        previousSummary ? ` · previous ${formatCompactINR(metric.previous ?? 0)}` : ""
                      }`}
                </AppText>
              </View>
            </View>
          );
        })}
      </DetailSection>

      <DetailSection title="Capital & cash flow">
        {capitalRows.map((row) => (
          <DetailRow
            key={row.label}
            label={row.label}
            maskWealthValues={maskWealthValues}
            signed={row.signed}
            value={row.value}
          />
        ))}
        <DetailRow
          label="Investment rate"
          maskWealthValues={maskWealthValues}
          percentage
          value={summary.savingsRate}
        />
        <DetailRow
          label="Expense rate"
          maskWealthValues={maskWealthValues}
          percentage
          value={summary.expenseRate}
        />
      </DetailSection>

      {snapshot.notes && !maskWealthValues ? (
        <AppText color="secondary" variant="caption">{snapshot.notes}</AppText>
      ) : null}
    </View>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.detailSection}>
      <AppText variant="title" weight="bold">{title}</AppText>
      {children}
    </View>
  );
}

function DetailRow({
  label,
  maskWealthValues,
  percentage = false,
  signed = false,
  value,
}: {
  label: string;
  maskWealthValues: boolean;
  percentage?: boolean;
  signed?: boolean;
  value: number | null | undefined;
}) {
  const displayValue = maskWealthValues
    ? "Hidden"
    : value === null || value === undefined
      ? "Unavailable"
      : percentage
        ? formatPercentage(value).replace("+", "")
        : signed
          ? formatSignedValue(value)
          : formatCompactINR(value);

  return (
    <View style={styles.detailRow}>
      <AppText style={styles.detailRowLabel}>{label}</AppText>
      <AppText align="right" weight="bold">{displayValue}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  assetLabel: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm, minWidth: 0 },
  chevron: { fontSize: 22, lineHeight: 22 },
  detail: { gap: spacing.sm },
  detailPortfolio: { fontSize: 30, lineHeight: 36 },
  detailRow: {
    alignItems: "center",
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  detailRowLabel: { flex: 1, minWidth: 0 },
  detailSection: { gap: spacing.xs, marginTop: spacing.md },
  entryAction: { alignSelf: "stretch" },
  entryCard: { alignItems: "stretch", gap: spacing.md },
  entryCopy: { flex: 1, gap: spacing.xs },
  gainText: { color: colors.profit },
  headerButton: { alignItems: "center", justifyContent: "center", minHeight: interaction.minimumTouchTarget, minWidth: 64 },
  historyColumns: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  historyChevronColumn: { flexBasis: 16, flexGrow: 0, flexShrink: 0 },
  historyMonthColumn: { flexBasis: 40, flexGrow: 0.65, flexShrink: 1, minWidth: 0 },
  historyRow: {
    alignItems: "center",
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  historyValueColumn: { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  lossText: { color: colors.loss },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.72)", flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.strong,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    height: "90%",
  },
  sheetContent: { gap: spacing.sm, paddingHorizontal: spacing.cardInner, paddingVertical: spacing.md },
  sheetHeader: { alignItems: "center", borderBottomColor: colors.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  sheetTitle: { flex: 1 },
  valueColumn: { alignItems: "flex-end", flexShrink: 1, gap: spacing.xs, maxWidth: "54%", minWidth: 0 },
  yearButton: { alignItems: "center", borderRadius: radii.pill, justifyContent: "center", minHeight: interaction.minimumTouchTarget, paddingHorizontal: spacing.md },
  yearButtonSelected: { backgroundColor: colors.primary },
  yearList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
