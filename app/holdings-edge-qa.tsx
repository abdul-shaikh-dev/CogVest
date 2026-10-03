import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { AppText } from "@/src/components/common";
import { HoldingsScreen } from "@/src/features/holdings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

const now = new Date("2026-10-03T12:00:00Z");

function EnabledHoldingsEdgeQa({ scenario, minimal }: { scenario?: string; minimal: boolean }) {
  const [store] = useState(() => {
    const result = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
    result.setState({ preferences: { ...result.getState().preferences, displayMode: minimal ? "minimal" : "standard" } });
    if (scenario !== "empty") {
      result.getState().addAsset({
        id: "edge-long", name: "Synthetic International Infrastructure and Emerging Markets Opportunities Fund Direct Growth",
        symbol: "EDGE", ticker: "EDGE", currency: "INR", assetClass: "stock", instrumentType: "mutualFund",
      });
      result.getState().addOpeningPosition({
        id: "edge-opening", assetId: "edge-long", date: "2026-01-01",
        quantity: 123456, averageCostPrice: 76543.21,
        ...(scenario === "pending" ? {} : { currentPrice: 98765.43 }),
      });
    }
    return result;
  });
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <HoldingsScreen store={store} now={now} refreshQuotes={async () => ({
      failed: [{ assetId: "edge-long", error: "Synthetic provider unavailable" }],
      timedOut: [], updated: [], quoteCache: {},
    })} />
  </>;
}

export default function HoldingsEdgeQaRoute() {
  const { token, scenario, mode } = useLocalSearchParams<{ token?: string; scenario?: string; mode?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) {
    return <AppText testID="holdings-edge-qa-blocked">Holdings QA is unavailable.</AppText>;
  }
  return <EnabledHoldingsEdgeQa key={`${scenario}-${mode}`} scenario={scenario} minimal={mode === "minimal"} />;
}
