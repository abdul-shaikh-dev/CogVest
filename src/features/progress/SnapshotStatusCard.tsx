import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton, AppText } from "@/src/components/common";
import { getMonthlySnapshotPriceConfidence } from "@/src/domain/calculations";
import { useReducedMotionPreference } from "@/src/hooks";
import { spacing } from "@/src/theme";

import { useStyles } from "./progressStyles";
import {
  formatMonth,
  snapshotStatusMessage,
  snapshotStatusTitles,
} from "./progressViewModel";
import type { ProgressSnapshotAutomationStatus } from "./useProgress";

export function SnapshotStatusCard({
  onOpenHoldings,
  onReview,
  onRetry,
  status,
}: {
  onOpenHoldings: () => void;
  onReview: () => void;
  onRetry: () => void;
  status: ProgressSnapshotAutomationStatus;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const priceConfidence = status.snapshot
    ? getMonthlySnapshotPriceConfidence(status.snapshot)
    : null;
  const provisionalMonthLabels = status.provisionalMonths.map(formatMonth);
  const latestProvisionalMonth =
    provisionalMonthLabels[provisionalMonthLabels.length - 1];
  const statusTitle = snapshotStatusTitles[status.kind];
  const statusMessage = snapshotStatusMessage(status);
  let action: {
    accessibilityLabel: string;
    label: string;
    onPress: () => void;
  } | null = null;

  if (status.kind === "missing-price") {
    action = {
      accessibilityLabel: "Retry monthly history",
      label: "Try again",
      onPress: onRetry,
    };
  } else if (
    status.kind === "incomplete-ppf" ||
    status.kind === "reconstructed-history" ||
    status.kind === "records-incomplete"
  ) {
    action = {
      accessibilityLabel: "Open Holdings",
      label: "Open Holdings",
      onPress: onOpenHoldings,
    };
  } else if (status.kind === "estimated") {
    action = {
      accessibilityLabel: "Refresh estimated month-end prices",
      label: "Refresh prices",
      onPress: onRetry,
    };
  } else if (status.kind === "complete") {
    action = {
      accessibilityLabel: "Review month-end snapshot",
      label: "Review",
      onPress: onReview,
    };
  }
  const visibleWarnings = status.kind === "records-incomplete" || status.kind === "missing-price"
    ? status.warnings.slice(0, 3)
    : status.kind === "incomplete-ppf" ||
        status.kind === "reconstructed-history"
      ? []
      : status.warnings;
  const provisionalMonthCopy = provisionalMonthLabels.length
    ? provisionalMonthLabels.length > 2
      ? `Estimated prices remain for ${provisionalMonthLabels.length} months, latest ${latestProvisionalMonth}. Review if you have better month-end values.`
      : `Estimated prices remain for ${provisionalMonthLabels.join(", ")}. Review if you have better month-end values.`
    : null;

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Snapshot status details" accessibilityValue={{ text: statusTitle }} accessibilityLiveRegion="polite" onPress={() => setOpen(true)} style={styles.snapshotStatusCard} testID="month-end-snapshot-status-card">
        <View style={styles.snapshotStatusHeader}>
          <View style={styles.snapshotCopy}>
            <AppText weight="bold">{statusTitle}</AppText>
            {status.progress ? (
              <AppText color="secondary" variant="caption">{status.progress.checkedCount} of {status.progress.totalCount} months checked</AppText>
            ) : null}
          </View>
          <AppText color="secondary" variant="caption">Details</AppText>
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType={reducedMotion ? "none" : "fade"} onRequestClose={() => setOpen(false)}>
        <View style={[styles.monthPickerOverlay, { paddingBottom: insets.bottom + spacing.md, paddingTop: insets.top + spacing.md }]}>
          <View style={styles.monthPickerSheet}>
            <AppButton title="Close snapshot status" variant="secondary" onPress={() => setOpen(false)} />
            <ScrollView>
    <View
      style={styles.snapshotStatusCard}
      testID="month-end-snapshot-status-details"
    >
      <View style={styles.snapshotStatusHeader}>
        <View style={styles.snapshotCopy}>
          <AppText weight="bold">{statusTitle}</AppText>
          <AppText color="secondary" variant="caption">
            {statusMessage}
          </AppText>
        </View>
        {action ? (
          <AppButton
            accessibilityLabel={action.accessibilityLabel}
            onPress={() => { setOpen(false); action.onPress(); }}
            style={styles.snapshotReviewAction}
            title={action.label}
            variant="secondary"
          />
        ) : null}
      </View>
      {visibleWarnings.map((warning) => (
        <AppText color="secondary" key={warning} variant="caption">
          {warning}
        </AppText>
      ))}
      {(status.kind === "records-incomplete" || status.kind === "missing-price") && status.warnings.length > visibleWarnings.length ? (
        <AppText color="secondary" variant="caption">
          {status.warnings.length - visibleWarnings.length} more affected months.
        </AppText>
      ) : null}
      {provisionalMonthCopy ? (
        <AppText color="secondary" variant="caption">
          {provisionalMonthCopy}
        </AppText>
      ) : null}
      {priceConfidence === "confirmed" && !provisionalMonthCopy ? (
        <AppText color="secondary" variant="caption">
          Month-end prices confirmed.
        </AppText>
      ) : null}
      {priceConfidence === "manual" ? (
        <AppText color="secondary" variant="caption">
          Reviewed values saved manually.
        </AppText>
      ) : null}
    </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
