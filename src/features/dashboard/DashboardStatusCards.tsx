import { router } from "expo-router";
import { Pressable, View } from "react-native";

import {
  AppButton,
  AppText,
  CategoryIcon,
  GroupedListRow,
  MaskedValue,
  MetricGroup,
  PremiumCard,
  SectionHeader,
  type AdaptiveLayoutMode,
} from "@/src/components/common";
import { formatMonthYear } from "@/src/domain/dates";
import {
  formatCompactINR,
  formatDate,
  formatINR,
} from "@/src/domain/formatters";

import { useStyles } from "./dashboardStyles";
import {
  formatSignedCompactINR,
  formatSignedINR,
} from "./dashboardViewModel";
import type { DashboardState } from "./useDashboard";

export function DashboardCurrencyWarning({ dashboard }: { dashboard: DashboardState }) {
  const styles = useStyles();

  if (dashboard.currencyIssues.length === 0) {
    return null;
  }

  return (
    <PremiumCard testID="dashboard-currency-warning">
      <View style={styles.infoCardRow}>
        <CategoryIcon assetClass="neutral" />
        <View style={styles.infoCardCopy}>
          <AppText weight="bold">Unsupported data excluded</AppText>
          <AppText color="secondary" variant="caption">
            {dashboard.currencyIssues[0].message}
            {dashboard.currencyIssues.length > 1
              ? ` ${dashboard.currencyIssues.length - 1} more record${
                  dashboard.currencyIssues.length === 2 ? "" : "s"
                } remain stored locally.`
              : " The record remains stored locally."}
          </AppText>
        </View>
      </View>
    </PremiumCard>
  );
}

export function DashboardEpfStatus({
  dashboard,
  onOpenEpf,
}: {
  dashboard: DashboardState;
  onOpenEpf?: () => void;
}) {
  if (dashboard.epfSummary.accountCount === 0) {
    return null;
  }

  return (
    <PremiumCard section testID="dashboard-epf-status">
      <AppText weight="bold">EPF recorded balances</AppText>
      {dashboard.epfSummary.value === null ? <AppText color="secondary">EPF value unavailable. Review account evidence.</AppText> :
        <MaskedValue testID="dashboard-epf-value" value={formatCompactINR(dashboard.epfSummary.value)} exactValue={formatINR(dashboard.epfSummary.value)} masked={dashboard.maskWealthValues} />}
      {dashboard.epfSummary.accounts.map(account => <AppText key={account.accountId} color="secondary" variant="caption">
        {dashboard.epfAccountNames[account.accountId] ?? "EPF account"} · as of {formatDate(account.lastEvidenceDate)}{account.historyComplete ? "" : " · later activity unconfirmed"}
      </AppText>)}
      {!dashboard.investedCapitalComplete ? <AppText color="secondary">EPF invested capital is unknown. Portfolio P&amp;L is unavailable.</AppText> : null}
      {dashboard.epfSummary.inTransit ? <AppText color="secondary">Includes an EPF transfer in transit, counted once.</AppText> : null}
      {dashboard.epfSummary.reasons.some(reason => reason.endsWith(":unknownWithdrawalDestination") || reason.endsWith(":untrackedTransferOrigin")) ?
        <AppText color="secondary">Some EPF movements have an unconfirmed origin or destination.</AppText> : null}
      <AppText color="secondary" variant="caption">Included in Debt. Progress shows EPF month-end values separately.</AppText>
      {onOpenEpf ? <AppButton onPress={onOpenEpf} testID="dashboard-open-epf" title="View EPF accounts" variant="ghost" /> : null}
    </PremiumCard>
  );
}

export function DashboardFuturesStatus({ dashboard }: { dashboard: DashboardState }) {
  if (!dashboard.futuresContributions.length) {
    return null;
  }

  return (
    <PremiumCard testID="dashboard-futures-status">
      <AppText weight="bold">USDT Futures</AppText>
      {dashboard.futuresContributions.map((item) => <View key={item.accountId}>
        <AppText color="secondary">{item.status === "ready" ? "Reconciled wallet equity included; notional excluded." : `Portfolio total pending: ${item.reason}`}</AppText>
        {item.equityInr !== null ? <MaskedValue value={formatCompactINR(Number(item.equityInr))} exactValue={formatINR(Number(item.equityInr))} masked={dashboard.maskWealthValues} /> : null}
      </View>)}
      <AppButton title="Review Futures" variant="secondary" onPress={() => router.push("/futures")} testID="dashboard-review-futures" />
    </PremiumCard>
  );
}

export function DashboardContinueSetup({
  dashboard,
  onQuickSetup,
  quickSetupSavedCount,
}: {
  dashboard: DashboardState;
  onQuickSetup?: () => void;
  quickSetupSavedCount: number;
}) {
  if (
    !(quickSetupSavedCount > 0 &&
    onQuickSetup &&
    dashboard.rollupRows.length > 0)
  ) {
    return null;
  }

  return (
    <PremiumCard elevated testID="dashboard-continue-setup">
      <AppText weight="bold">Continue portfolio setup</AppText>
      <AppText color="secondary" variant="caption">
        {quickSetupSavedCount} confirmed {quickSetupSavedCount === 1 ? "holding is" : "holdings are"} saved. Add the rest when ready.
      </AppText>
      <AppButton
        onPress={onQuickSetup}
        testID="dashboard-continue-setup-button"
        title="Continue setup"
        variant="secondary"
      />
    </PremiumCard>
  );
}

export function DashboardCashLiability({
  dashboard,
  hasCompleteValuation,
}: {
  dashboard: DashboardState;
  hasCompleteValuation: boolean;
}) {
  const styles = useStyles();

  if (!(dashboard.cashBalance < 0 && hasCompleteValuation)) {
    return null;
  }

  return (
    <PremiumCard
      style={styles.liabilityCard}
      testID="dashboard-cash-liability"
    >
      <View style={styles.liabilityHeader}>
        <View style={styles.liabilityCopy}>
          <AppText style={styles.warningText} weight="bold">
            Negative cash balance
          </AppText>
          <AppText color="secondary" variant="caption">
            This liability is included in net portfolio value. Review Cash
            Ledger if it is unexpected.
          </AppText>
        </View>
      </View>
      <View style={styles.heroMetrics}>
        <View style={styles.heroMetricCell}>
          <AppText color="secondary" variant="caption">
            Gross holdings
          </AppText>
          <MaskedValue
            exactValue={formatINR(
              dashboard.rollupTotals.holdingsCurrentValue ?? 0,
            )}
            masked={dashboard.maskWealthValues}
            testID="dashboard-liability-gross"
            value={formatCompactINR(
              dashboard.rollupTotals.holdingsCurrentValue ?? 0,
            )}
            weight="bold"
          />
        </View>
        <View style={styles.heroMetricCell}>
          <AppText color="secondary" variant="caption">
            Cash balance
          </AppText>
          <MaskedValue
            exactValue={formatINR(dashboard.cashBalance)}
            masked={dashboard.maskWealthValues}
            style={styles.negativeText}
            testID="dashboard-liability-cash"
            value={formatCompactINR(dashboard.cashBalance)}
            weight="bold"
          />
        </View>
        <View style={styles.heroMetricCell}>
          <AppText color="secondary" variant="caption">
            Net portfolio
          </AppText>
          <MaskedValue
            exactValue={formatINR(
              dashboard.rollupTotals.totalCurrentValue ?? 0,
            )}
            masked={dashboard.maskWealthValues}
            style={
              (dashboard.rollupTotals.totalCurrentValue ?? 0) < 0
                ? styles.negativeText
                : undefined
            }
            testID="dashboard-liability-net"
            value={formatCompactINR(
              dashboard.rollupTotals.totalCurrentValue ?? 0,
            )}
            weight="bold"
          />
        </View>
      </View>
    </PremiumCard>
  );
}

export function DashboardMonthlyActivity({
  currentDate,
  dashboard,
  isMinimalMode,
}: {
  currentDate: Date;
  dashboard: DashboardState;
  isMinimalMode: boolean;
}) {
  const styles = useStyles();

  if (isMinimalMode) {
    return null;
  }

  if (!dashboard.maskWealthValues && dashboard.monthlyMetrics.investment === 0 && dashboard.monthlyMetrics.cashChange === 0) {
    return (
      <View style={styles.quietActivity} testID="dashboard-monthly-context">
        <AppText color="secondary" variant="caption" weight="medium">{`${formatMonthYear(currentDate)} activity`}</AppText>
        <AppText color="secondary" variant="caption">No net investment or cash change</AppText>
      </View>
    );
  }

  return (
    <PremiumCard section style={styles.compactSection} testID="dashboard-monthly-context">
      <SectionHeader title={`${formatMonthYear(currentDate)} activity`} />
      <MetricGroup
        metrics={[
          {
            exactValue: formatINR(dashboard.monthlyMetrics.investment),
            label: "Invested",
            masked: dashboard.maskWealthValues,
            value: formatCompactINR(dashboard.monthlyMetrics.investment),
          },
          {
            exactValue: formatSignedINR(dashboard.monthlyMetrics.cashChange),
            label: "Cash change",
            masked: dashboard.maskWealthValues,
            value: formatSignedCompactINR(
              dashboard.monthlyMetrics.cashChange,
            ),
          },
        ]}
      />
    </PremiumCard>
  );
}

export function DashboardProgressLink({
  adaptiveLayoutMode,
  isMinimalMode,
  onOpenProgress,
}: {
  adaptiveLayoutMode: AdaptiveLayoutMode;
  isMinimalMode: boolean;
  onOpenProgress?: () => void;
}) {
  const styles = useStyles();

  if (isMinimalMode) {
    return (
      <GroupedListRow
        title="Month-end snapshot"
        meta="Stored values, not current prices"
        accessibilityLabel="Open Progress. Stored month-end values, not current prices."
        onPress={onOpenProgress}
        showChevron
        testID="dashboard-open-progress"
      />
    );
  }

  return (
    <PremiumCard style={styles.supportCard} testID="dashboard-support-card">
      <View
        style={[
          styles.supportRow,
          adaptiveLayoutMode !== "standard" && styles.supportRowStacked,
        ]}
        testID="dashboard-next-review-card"
      >
        <CategoryIcon assetClass="neutral" size={18} />
        <View style={styles.infoCardCopy}>
          <AppText variant="caption" weight="bold">
            Month-end snapshot
          </AppText>
          <AppText color="secondary" variant="caption">
            Progress shows stored month-end values. They can differ from current holdings and prices here.
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenProgress}
          style={styles.inlineAction}
          testID="dashboard-open-progress"
        >
          <AppText style={styles.brandText} variant="caption" weight="bold">
            Open Progress
          </AppText>
        </Pressable>
      </View>
    </PremiumCard>
  );
}
