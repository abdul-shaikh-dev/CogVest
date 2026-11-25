import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppButton, AppText, MaskedValue } from "@/src/components/common";
import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import { type XirrSummary, xirrFlowTotals } from "@/src/domain/xirrSummary";
import type { MonthlySnapshot } from "@/src/types";

import { useStyles } from "./dashboardStyles";
import { DashboardBenchmark } from "./DashboardBenchmark";
import { DashboardXirrBlockers } from "./DashboardXirrBlockers";

type XirrProps = {
  masked: boolean;
  /** Stored month-end values, for the benchmark chart (#765). */
  monthlySnapshots?: readonly Pick<MonthlySnapshot, "month" | "portfolioValue">[];
  /** Holding and account names for the blocker checklist. */
  names?: Record<string, string>;
  /** Opens bulk payout confirmation for the holdings behind the payouts note (#619). */
  onConfirmPayouts?: () => void;
  onReviewPayouts?: (assetId: string) => void;
  onSetBasis?: () => void;
  scope: string;
  summary: XirrSummary;
};

/**
 * Annualised portfolio return (#535, simplified in #610): everything CogVest
 * tracks, Cash included, from the user's start or the earliest month-end
 * snapshot. Assumptions are listed, not blocking. The Dashboard shows it as a
 * tile with its details below the tile row (#782).
 */
export function DashboardXirr(props: XirrProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <DashboardXirrTile expanded={expanded} onToggle={() => setExpanded((value) => !value)} summary={props.summary} />
      {expanded ? <DashboardXirrDetails {...props} /> : null}
    </View>
  );
}

/** What the tile says under the rate: why to read it with care, then where to tap. */
export function getXirrTileCaption(summary: XirrSummary, expanded: boolean) {
  if (expanded) return "Hide breakdown";
  if (summary.status === "unavailable") return "Why ›";
  const context = summary.shortPeriod ? `Over ${summary.days} days` : summary.notes.length ? "Estimate" : "";
  return context ? `${context} · Breakdown ›` : "Breakdown ›";
}

export function DashboardXirrTile({ expanded, onToggle, stacked = false, summary }: {
  expanded: boolean;
  /** Full width, for large font sizes. */
  stacked?: boolean;
  onToggle: () => void;
  summary: XirrSummary;
}) {
  const styles = useStyles();
  const rateText = summary.status === "rate" ? `${formatPercentage(summary.rate * 100)} a year` : "Unavailable";
  return (
    <Pressable
      accessibilityLabel={`Whole portfolio return, XIRR, including Cash: ${rateText}. ${expanded ? "Hide" : "Show"} breakdown`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={[styles.glanceTile, stacked && styles.glanceTileFull]}
      testID="dashboard-xirr-toggle"
    >
      <View testID="dashboard-xirr">
        {/* Says whose return this is, so it isn't read against the holdings P&L beside it (#805). */}
        <AppText color="secondary" variant="caption">Whole portfolio return (XIRR)</AppText>
        <AppText
          color={summary.status === "rate" ? undefined : "secondary"}
          style={summary.status !== "rate" || summary.rate === 0 ? undefined
            : summary.rate > 0 ? styles.positiveText : styles.negativeText}
          testID="dashboard-xirr-rate"
          weight="bold"
        >
          {rateText}
        </AppText>
        <AppText color="secondary" testID="dashboard-xirr-tile-caption" variant="caption">
          {getXirrTileCaption(summary, expanded)}
        </AppText>
      </View>
    </Pressable>
  );
}

export function DashboardXirrDetails({ masked, monthlySnapshots, names = {}, onConfirmPayouts, onReviewPayouts, onSetBasis, scope, summary }: XirrProps) {
  const styles = useStyles();
  return (
    <View style={styles.priceDetails} testID="dashboard-xirr-details">
      {summary.status === "rate" && summary.shortPeriod ? (
        <AppText color="secondary" testID="dashboard-xirr-short" variant="caption">
          Annualised over {summary.days} days, not the gain for the period.
        </AppText>
      ) : null}
      {summary.status === "rate" && summary.notes.length ? (
        <AppText color="secondary" testID="dashboard-xirr-assumptions" variant="caption">
          Estimate with {summary.notes.length} {summary.notes.length === 1 ? "assumption" : "assumptions"}, listed below.
        </AppText>
      ) : null}
      <AppText color="secondary" variant="caption">{scope}</AppText>
      {summary.status === "unavailable" ? (
        <DashboardXirrBlockers
          blockers={summary.blockers}
          names={names}
          onReviewPayouts={onReviewPayouts}
          onSetBasis={onSetBasis}
        />
      ) : (
        <>
          <XirrRateDetails masked={masked} summary={summary} />
          <DashboardBenchmark masked={masked} monthlySnapshots={monthlySnapshots} summary={summary} />
        </>
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
  );
}

function XirrRateDetails({ masked, summary }: { masked: boolean; summary: Extract<XirrSummary, { status: "rate" }> }) {
  const totals = xirrFlowTotals(summary);
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
