import { useMemo, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppText, MaskedValue, PremiumCard } from "@/src/components/common";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { buildEpfMonthlyHistory, type EpfMonthValue } from "@/src/domain/epf/history";
import { formatCompactINR, formatINR } from "@/src/domain/formatters";
import type { PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";

function formatMonth(month: string) {
  const [year, monthPart] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC", year: "numeric" })
    .format(new Date(Date.UTC(year, monthPart - 1, 1)));
}

const statusCopy: Record<EpfMonthValue["status"], string> = {
  confirmed: "Confirmed month-end balance.",
  lastRecorded: "Last recorded balance; later activity is unconfirmed.",
  partial: "Unavailable: not every account has a balance for this month.",
};

/**
 * EPF stays outside stored snapshots. Its month-end values are derived from
 * recorded evidence and shown separately, never back-filled or merged.
 */
export function EpfHistoryScope({ maskWealthValues, month, now, store }: {
  maskWealthValues: boolean;
  /** The month selected in stored history; without one, the latest EPF month. */
  month?: string;
  now?: Date;
  store: StoreApi<PortfolioStoreState>;
}) {
  const epf = useSyncExternalStore(store.subscribe, () => store.getState().epf, () => store.getState().epf);
  const today = formatLocalCalendarDate(now ?? new Date());
  const history = useMemo(() => buildEpfMonthlyHistory(epf, today), [epf, today]);
  if (epf.accounts.length === 0) return null;
  const months = history.ok ? history.months : [];
  const row = month === undefined ? months.at(-1) : months.find((item) => item.month === month);
  const amount = (value: number, testID: string) => (
    <MaskedValue exactValue={formatINR(value)} masked={maskWealthValues} testID={testID}
      value={formatCompactINR(value)} variant="caption" weight="bold" />
  );

  return (
    <PremiumCard testID="progress-epf-scope">
      <AppText weight="bold">EPF is not in monthly history</AppText>
      <AppText color="secondary" variant="caption">
        Stored month-end values exclude EPF. EPF is shown separately from recorded evidence; earlier balances are not inferred.
      </AppText>
      {!history.ok ? (
        <AppText color="secondary" variant="caption" testID="progress-epf-unavailable">
          EPF month-end values need review before they can be shown.
        </AppText>
      ) : row ? (
        <View style={styles.month} testID="progress-epf-month">
          <View style={styles.line}>
            <AppText variant="caption">EPF at end of {formatMonth(row.month)}</AppText>
            {row.value === null
              ? <AppText variant="caption" weight="bold" testID="progress-epf-month-value">Unavailable</AppText>
              : amount(row.value, "progress-epf-month-value")}
          </View>
          <AppText color="secondary" variant="caption" testID="progress-epf-month-status">
            {statusCopy[row.status]}
            {row.status === "partial" ? ` ${row.coveredAccountCount} of ${row.accountCount} accounts recorded.` : ""}
          </AppText>
          {row.flows.contributions !== 0 ? (
            <View style={styles.line}>
              <AppText color="secondary" variant="caption">Contributions (capital, not return)</AppText>
              {amount(row.flows.contributions, "progress-epf-month-contributions")}
            </View>
          ) : null}
          {row.flows.interest !== 0 ? (
            <View style={styles.line}>
              <AppText color="secondary" variant="caption">Credited interest</AppText>
              {amount(row.flows.interest, "progress-epf-month-interest")}
            </View>
          ) : null}
          {row.inTransit > 0 ? (
            <View style={styles.line}>
              <AppText color="secondary" variant="caption">Moving between EPF accounts</AppText>
              {amount(row.inTransit, "progress-epf-month-transit")}
            </View>
          ) : null}
          {row.flows.reconciled ? (
            <AppText color="secondary" variant="caption">
              Includes a balance reconciliation; its difference is not a contribution or return.
            </AppText>
          ) : null}
        </View>
      ) : month !== undefined ? (
        <View style={styles.month} testID="progress-epf-month">
          <View style={styles.line}>
            <AppText variant="caption">EPF at end of {formatMonth(month)}</AppText>
            <AppText variant="caption" weight="bold" testID="progress-epf-month-value">Unavailable</AppText>
          </View>
          <AppText color="secondary" variant="caption" testID="progress-epf-month-status">
            No EPF balance was recorded by then; it is not counted as zero.
          </AppText>
        </View>
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  line: { alignItems: "baseline", columnGap: spacing.sm, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  month: { gap: spacing.xs, marginTop: spacing.xs },
});
