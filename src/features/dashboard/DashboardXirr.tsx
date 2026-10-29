import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppButton, AppText, MaskedValue } from "@/src/components/common";
import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import { decimal } from "@/src/domain/precision";
import type { XirrSummary } from "@/src/domain/xirrSummary";

import { useStyles } from "./dashboardStyles";

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

type XirrView = { scope: string; summary: XirrSummary };
type Measure = "investments" | "whole";
const measureLabel: Record<Measure, string> = { investments: "Investments", whole: "Whole portfolio" };

/**
 * Annualised return (#535) inside the Invested & returns area: Investments
 * (D8) or the whole portfolio, Cash included, from the user's start (D9).
 */
export function DashboardXirr({ investments, masked, onSetBasis, whole }: {
  investments: XirrView;
  masked: boolean;
  onSetBasis?: () => void;
  whole: XirrView;
}) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const [measure, setMeasure] = useState<Measure>("investments");
  const { scope, summary } = measure === "investments" ? investments : whole;
  const rateText = summary.status === "rate" ? `${formatPercentage(summary.rate * 100)} a year` : "Unavailable";
  return (
    <View testID="dashboard-xirr">
      <View accessibilityRole="radiogroup" style={styles.xirrMeasures}>
        {(["investments", "whole"] as const).map((item) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: measure === item }}
            key={item}
            onPress={() => setMeasure(item)}
            style={[styles.xirrMeasure, measure === item && styles.xirrMeasureSelected]}
            testID={`dashboard-xirr-measure-${item}`}
          >
            <AppText color={measure === item ? undefined : "secondary"} variant="caption" weight={measure === item ? "bold" : undefined}>
              {measureLabel[item]}
            </AppText>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityLabel={`${measureLabel[measure]} return, XIRR: ${rateText}. ${expanded ? "Hide" : "Show"} breakdown`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.priceDisclosure}
        testID="dashboard-xirr-toggle"
      >
        <View style={styles.xirrLabel}>
          <AppText color="secondary" variant="caption">{measureLabel[measure]} return (XIRR)</AppText>
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
      {summary.status === "rate" && summary.shortPeriod ? (
        <AppText color="secondary" testID="dashboard-xirr-short" variant="caption">
          Annualised over {summary.days} days, not the gain for the period.
        </AppText>
      ) : null}
      {summary.status === "unavailable" && !expanded ? (
        <AppText color="secondary" testID="dashboard-xirr-reason" variant="caption">{summary.messages[0]}</AppText>
      ) : null}
      {measure === "whole" && onSetBasis ? (
        <AppButton onPress={onSetBasis} testID="dashboard-xirr-set-basis" title="Whole-portfolio start" variant="ghost" />
      ) : null}
      {expanded ? (
        <View style={styles.priceDetails} testID="dashboard-xirr-details">
          <AppText color="secondary" variant="caption">{scope}</AppText>
          {summary.status === "unavailable" ? summary.messages.map((message) => (
            <AppText color="secondary" key={message} variant="caption">{message}</AppText>
          )) : (
            <XirrRateDetails masked={masked} summary={summary} />
          )}
          <AppText color="secondary" variant="caption">
            XIRR weighs each amount by when it moved. It differs from P&amp;L, which compares value with what you invested.
          </AppText>
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
