import { useState } from "react";
import { View } from "react-native";

import { AppText, DisclosureButton, MaskedValue, SectionHeader } from "@/src/components/common";
import { formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import type { XirrSummary } from "@/src/domain/xirrSummary";

import { useStyles } from "./holdingsStyles";

const flowLabel = { trade: "Transaction", distribution: "Payout", account: "Account flow", terminal: "Current value" } as const;

/** Annualised return for one holding, with the cash flows behind it (#535). */
export function HoldingXirrPanel({ assetId, masked, summary }: { assetId: string; masked: boolean; summary: XirrSummary }) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  if (summary.status === "unavailable") {
    return (
      <View style={styles.openingRecords} testID={`holding-xirr-${assetId}`}>
        <SectionHeader title="Annualised return (XIRR)" />
        <AppText testID="holding-xirr-unavailable" weight="bold">Unavailable</AppText>
        {summary.messages.map((message) => (
          <AppText color="secondary" key={message} variant="caption">{message}</AppText>
        ))}
      </View>
    );
  }
  const positive = summary.rate >= 0;
  return (
    <View style={styles.openingRecords} testID={`holding-xirr-${assetId}`}>
      <SectionHeader title="Annualised return (XIRR)" />
      <AppText
        accessibilityLabel={`${formatPercentage(summary.rate * 100)} a year`}
        style={summary.rate === 0 ? undefined : positive ? styles.positiveText : styles.negativeText}
        testID="holding-xirr-rate"
        weight="bold"
      >
        {formatPercentage(summary.rate * 100)} a year
      </AppText>
      <AppText color="secondary" testID="holding-xirr-period" variant="caption">
        {summary.shortPeriod
          ? `Annualised over ${summary.days} days, not the gain for the period. `
          : ""}
        {`${formatDate(summary.startDate)} to ${formatDate(summary.endDate)} · INR`}
        {summary.valueAsOf ? ` · price as of ${formatDate(summary.valueAsOf)}` : ""}
      </AppText>
      {summary.notes.map((note) => (
        <AppText color="secondary" key={note} variant="caption">{note}</AppText>
      ))}
      <DisclosureButton
        expanded={expanded}
        onPress={() => setExpanded((value) => !value)}
        testID="holding-xirr-flows-toggle"
        title={expanded ? "Hide cash flows" : "Show cash flows"}
      />
      {expanded ? (
        <View style={styles.openingRecords} testID="holding-xirr-flows">
          {summary.flows.map((flow) => (
            <View key={`${flow.source}-${flow.id}`} style={styles.openingRecordRow}>
              <View style={styles.openingRecordCopy}>
                <AppText variant="caption" weight="bold">{flowLabel[flow.source]}</AppText>
                <AppText color="secondary" variant="caption">{formatDate(flow.date)}</AppText>
              </View>
              <MaskedValue masked={masked} value={formatINR(Number(flow.amountInr))} variant="caption" weight="bold" />
            </View>
          ))}
          <AppText color="secondary" variant="caption">
            Money you put in is negative; money returned and the current value are positive.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
