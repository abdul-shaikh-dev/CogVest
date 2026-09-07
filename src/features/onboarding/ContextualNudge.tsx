import { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";
import { AppButton, AppText } from "@/src/components/common";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";

type Kind = "metadata" | "minimal" | "insights";
// Increment only when the teaching content materially changes, not for styling.
export const nudgeVersions = { metadata: 1, minimal: 1, insights: 1 } as const;

export function ContextualNudge({
  kind,
  store = getPortfolioStore(),
  hasConviction = false,
  hasPlan = false,
}: {
  kind: Kind;
  store?: StoreApi<PortfolioStoreState>;
  hasConviction?: boolean;
  hasPlan?: boolean;
}) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const [hidden, setHidden] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const records = [
    ...state.openingPositions,
    ...state.trades.filter((trade) => trade.type === "buy"),
  ];
  const savedConviction = records.some(
    (record) => record.conviction !== undefined,
  );
  const savedPlan = records.some(
    (record) => record.intendedHoldDays !== undefined,
  );
  const completed =
    kind === "metadata"
      ? savedConviction && savedPlan
      : kind === "minimal" && state.preferences.displayMode === "minimal";
  const acknowledged =
    (state.preferences.nudgeVersions?.[kind] ?? 0) >= nudgeVersions[kind];

  useEffect(() => {
    if (!completed || acknowledged) return;
    try {
      store.getState().acknowledgeNudge(kind, nudgeVersions[kind]);
    } catch {
      /* Optional guidance must never block portfolio work. */
    }
  }, [acknowledged, completed, kind, store]);

  const explainConviction = !savedConviction && !hasConviction;
  const explainPlan = !savedPlan && !hasPlan;
  if (
    hidden ||
    acknowledged ||
    completed ||
    state.preferences.displayMode === "minimal" ||
    (kind === "metadata" && !explainConviction && !explainPlan)
  )
    return null;

  const title =
    kind === "metadata"
      ? "Optional context"
      : kind === "minimal"
        ? "A quieter view"
        : "About patterns";
  const copy =
    kind === "metadata"
      ? [
          explainConviction
            ? "Conviction records your confidence, from 1 (low) to 5 (high)."
            : "",
          explainPlan
            ? "A holding plan records how many days you originally intended to hold."
            : "",
          "Both can be left blank; neither affects your portfolio values.",
        ]
          .filter(Boolean)
          .join(" ")
      : kind === "minimal"
        ? "Hide optional analysis, not your records. Switch back anytime."
        : "Observations use your saved records, not predictions or advice. Adding missing context is optional.";
  return (
    <View style={styles.content} testID={`nudge-${kind}`}>
      <View style={styles.heading}>
        <AppText
          accessibilityRole="header"
          style={styles.title}
          weight="medium"
        >
          {title}
        </AppText>
        <AppButton
          title={saveFailed ? "Hide for now" : "Got it"}
          accessibilityLabel={`Dismiss ${title.toLowerCase()} guidance`}
          testID={`dismiss-nudge-${kind}`}
          variant="ghost"
          onPress={() => {
            if (saveFailed) {
              setHidden(true);
              return;
            }
            try {
              store.getState().acknowledgeNudge(kind, nudgeVersions[kind]);
            } catch {
              setSaveFailed(true);
            }
          }}
        />
      </View>
      <AppText color="secondary">{copy}</AppText>
      {saveFailed ? (
        <AppText color="secondary" accessibilityLiveRegion="polite">
          Could not save this preference. You can still continue.
        </AppText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingVertical: spacing.sm },
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1 },
});
