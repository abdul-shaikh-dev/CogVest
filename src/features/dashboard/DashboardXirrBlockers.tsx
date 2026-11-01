import { Pressable, View } from "react-native";

import { AppText } from "@/src/components/common";
import type { XirrBlocker } from "@/src/domain/xirrSummary";

import { useStyles } from "./dashboardStyles";

/** Reasons fixed on the return start screen. */
const startReasons = new Set<XirrBlocker["reason"]>([
  "no-measurement-basis", "basis-needs-reconfirming", "records-before-start", "opening-after-start", "trade-funding-unknown",
]);
/** Reasons fixed on a holding's payouts screen. */
const payoutReasons = new Set<XirrBlocker["reason"]>(["distributions-not-recorded", "payout-before-purchase"]);
const SHOWN_NAMES = 5;

const unitLabel: Record<NonNullable<XirrBlocker["unit"]>, [string, string]> = {
  holdings: ["holding", "holdings"],
  trades: ["trade", "trades"],
  cashEntries: ["Cash entry", "Cash entries"],
  ppfEntries: ["PPF entry", "PPF entries"],
};

/** "441 trades across 26 holdings", "18 holdings", or null for portfolio-level reasons. */
export function blockerExtent(blocker: XirrBlocker) {
  if (!blocker.unit || !blocker.count) return null;
  const [one, many] = unitLabel[blocker.unit];
  const extent = `${blocker.count} ${blocker.count === 1 ? one : many}`;
  return blocker.unit !== "holdings" && blocker.assetIds.length > 1 ? `${extent} across ${blocker.assetIds.length} holdings` : extent;
}

/**
 * Everything keeping a return unavailable, with what each applies to and where
 * it is fixed (#607). Names are shown, never values, so masking is unaffected.
 */
export function DashboardXirrBlockers({ blockers, names, onReviewPayouts, onSetBasis }: {
  blockers: XirrBlocker[];
  names: Record<string, string>;
  onReviewPayouts?: (assetId: string) => void;
  onSetBasis?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.xirrBlockers} testID="dashboard-xirr-blockers">
      {blockers.map((blocker) => {
        const extent = blockerExtent(blocker);
        const named = blocker.assetIds.filter((id) => names[id]);
        const showPayoutLinks = payoutReasons.has(blocker.reason) && onReviewPayouts;
        const listed = showPayoutLinks ? named.slice(0, SHOWN_NAMES) : [];
        const unlisted = named.length - listed.length;
        return (
          <View key={blocker.reason} style={styles.xirrBlocker} testID={`dashboard-xirr-blocker-${blocker.reason}`}>
            <AppText variant="caption" weight="bold">{blocker.message}</AppText>
            {extent ? (
              <AppText color="secondary" testID={`dashboard-xirr-blocker-${blocker.reason}-extent`} variant="caption">
                {extent}
                {!showPayoutLinks && blocker.unit === "holdings" && named.length
                  ? `: ${named.slice(0, SHOWN_NAMES).map((id) => names[id]).join(", ")}${named.length > SHOWN_NAMES ? ` and ${named.length - SHOWN_NAMES} more` : ""}`
                  : ""}
              </AppText>
            ) : null}
            {listed.map((id) => (
              <Pressable
                accessibilityLabel={`Review payouts for ${names[id]}`}
                accessibilityRole="button"
                key={id}
                onPress={() => onReviewPayouts?.(id)}
                style={styles.xirrBlockerAction}
                testID={`dashboard-xirr-payouts-${id}`}
              >
                <AppText style={styles.brandText} variant="caption" weight="bold">Review payouts · {names[id]}</AppText>
              </Pressable>
            ))}
            {unlisted > 0 ? (
              <AppText color="secondary" variant="caption">
                And {unlisted} more. Each holding&apos;s payouts are under Holdings.
              </AppText>
            ) : null}
            {startReasons.has(blocker.reason) && onSetBasis ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSetBasis}
                style={styles.xirrBlockerAction}
                testID={`dashboard-xirr-fix-${blocker.reason}`}
              >
                <AppText style={styles.brandText} variant="caption" weight="bold">Open return start</AppText>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
