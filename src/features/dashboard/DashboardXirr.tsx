import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppButton, AppText, MaskedValue } from "@/src/components/common";
import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";
import type { XirrSummary } from "@/src/domain/xirrSummary";

import { useStyles } from "./dashboardStyles";
import { DashboardXirrBlockers } from "./DashboardXirrBlockers";

/** Totals of the flows behind the rate, so the result can be checked without listing every trade. */
function flowTotals(summary: Extract<XirrSummary, { status: "rate" }>) {
  let paidIn = decimal(0);
  let returned = decimal(0);
  let current = decimal(0);
  for (const flow of summary.flows) {
    const amount = decimal(flow.amountInr);
    if (flow.source === "terminal") current = current.plus(amount);
    else if (amount.isNegative()) paidIn = paidIn.minus(amount);
    else returned = returned.plus(amount);
  }
  return { count: summary.flows.filter((flow) => flow.source !== "terminal").length,
    paidIn: paidIn.toNumber(), returned: returned.toNumber(), current: current.toNumber() };
}

/**
 * Annualised portfolio return (#535, simplified in #610) inside the Invested &
 * returns area: everything CogVest tracks, Cash included, from the user's start
 * or the earliest month-end snapshot. Assumptions are listed, not blocking.
 */
export function DashboardXirr({ masked, names = {}, onConfirmPayouts, onReviewPayouts, onSetBasis, scope, summary }: {
  masked: boolean;
  /** Holding and account names for the blocker checklist. */
  names?: Record<string, string>;
  /** Opens bulk payout confirmation for the holdings behind the payouts note (#619). */
  onConfirmPayouts?: () => void;
  onReviewPayouts?: (assetId: string) => void;
  onSetBasis?: () => void;
  scope: string;
  summary: XirrSummary;
}) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const rateText = summary.status === "rate" ? `${formatPercentage(summary.rate * 100)} a year` : "Unavailable";
  return (
    <View testID="dashboard-xirr">
      <Pressable
        accessibilityLabel={`Portfolio return, XIRR: ${rateText}. ${expanded ? "Hide" : "Show"} breakdown`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.priceDisclosure}
        testID="dashboard-xirr-toggle"
      >
        <View style={styles.xirrLabel}>
          <AppText color="secondary" variant="caption">Portfolio return (XIRR)</AppText>
          <AppText
            color={summary.status === "rate" ? undefined : "secondary"}
            style={summary.status !== "rate" || summary.rate === 0 ? undefined
              : summary.rate > 0 ? styles.positiveText : styles.negativeText}
            testID="dashboard-xirr-rate"
            weight="bold"
          >
            {rateText}
          </AppText>
        </View>
        <AppText color="secondary" variant="caption">{expanded ? "Hide breakdown" : "Breakdown"}</AppText>
      </Pressable>
      {summary.status === "rate" && summary.notes.length && !expanded ? (
        <AppText color="secondary" testID="dashboard-xirr-assumptions" variant="caption">
          Estimate with {summary.notes.length} {summary.notes.length === 1 ? "assumption" : "assumptions"}. Open Breakdown to see {summary.notes.length === 1 ? "it" : "them"}.
        </AppText>
      ) : null}
      {summary.status === "rate" && summary.shortPeriod ? (
        <AppText color="secondary" testID="dashboard-xirr-short" variant="caption">
          Annualised over {summary.days} days, not the gain for the period.
        </AppText>
      ) : null}
      {summary.status === "unavailable" && !expanded ? (
        <>
          <AppText color="secondary" testID="dashboard-xirr-reason" variant="caption">{summary.messages[0]}</AppText>
          {summary.blockers.length > 1 ? (
            <AppText color="secondary" testID="dashboard-xirr-more" variant="caption">
              {summary.blockers.length - 1} more to fix. Open Breakdown for the full list.
            </AppText>
          ) : null}
        </>
      ) : null}
      {expanded ? (
        <View style={styles.priceDetails} testID="dashboard-xirr-details">
          <AppText color="secondary" variant="caption">{scope}</AppText>
          {summary.status === "unavailable" ? (
            <DashboardXirrBlockers
              blockers={summary.blockers}
              names={names}
              onReviewPayouts={onReviewPayouts}
              onSetBasis={onSetBasis}
            />
          ) : (
            <XirrRateDetails masked={masked} summary={summary} />
          )}
          {summary.status === "rate" && (summary.payoutGapAssetIds?.length ?? 0) > 0 && onConfirmPayouts ? (
            <AppButton onPress={onConfirmPayouts} testID="dashboard-xirr-confirm-payouts" title="Confirm payouts" variant="secondary" />
          ) : null}
          <AppText color="secondary" variant="caption">
            XIRR weighs each amount by when it moved. It differs from P&amp;L, which compares value with what you invested.
          </AppText>
          {onSetBasis ? (
            <AppButton onPress={onSetBasis} testID="dashboard-xirr-set-basis" title="Change start" variant="secondary" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function XirrRateDetails({ masked, summary }: { masked: boolean; summary: Extract<XirrSummary, { status: "rate" }> }) {
  const totals = flowTotals(summary);
  return (
    <>
      <AppText color="secondary" testID="dashboard-xirr-period" variant="caption">
        {formatDate(summary.startDate)} to {formatDate(summary.endDate)} · INR
        {summary.valueAsOf ? ` · values as of ${formatDate(summary.valueAsOf)}` : ""}
      </AppText>
      <AppText color="secondary" variant="caption">
        {totals.count} dated {totals.count === 1 ? "amount" : "amounts"}, then the current value:
      </AppText>
      <Line label="Put in" masked={masked} testID="dashboard-xirr-paid-in" value={totals.paidIn} />
      <Line label="Taken out or paid to you" masked={masked} testID="dashboard-xirr-returned" value={totals.returned} />
      <Line label="Current value" masked={masked} testID="dashboard-xirr-current" value={totals.current} />
      {summary.notes.map((note) => <AppText color="secondary" key={note} variant="caption">{note}</AppText>)}
    </>
  );
}

function Line({ label, masked, testID, value }: { label: string; masked: boolean; testID: string; value: number }) {
  const styles = useStyles();
  return (
    <View style={styles.xirrLine}>
      <AppText color="secondary" variant="caption">{label}</AppText>
      <MaskedValue masked={masked} testID={testID} value={formatINR(value)} variant="caption" weight="bold" />
    </View>
  );
}
