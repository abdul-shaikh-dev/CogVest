import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import { QuickPortfolioSetupScreen } from "@/src/features/quickSetup";
import {
  canUseVisualQaHarness,
  resolveVisualQaQuote,
  visualQaAssetLookupResults,
} from "@/src/testing/visualQaSeed";

export default function QuickPortfolioSetupRoute() {
  const params = useLocalSearchParams<{
    token?: string;
    visualQaState?: string;
  }>();
  const [isFocused, setIsFocused] = useState(false);
  const canUseVisualQaState = canUseVisualQaHarness({
    isDevelopment: __DEV__,
    token: params.token,
  });
  const visualQaState = canUseVisualQaState ? params.visualQaState : undefined;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  return (
    <QuickPortfolioSetupScreen
      hardwareBackEnabled={isFocused}
      now={visualQaState ? new Date("2026-05-29T10:15:00.000Z") : undefined}
      onAddPpfAccount={() =>
        router.push({
          pathname: "/ppf-account",
          params: { returnTo: "quick-portfolio-setup" },
        })
      }
      onComplete={() => router.replace("/(tabs)/dashboard")}
      onExit={() => router.back()}
      resolveQuote={
        visualQaState === "lookup"
          ? async ({ asset }) => resolveVisualQaQuote(asset)
          : undefined
      }
      searchAssetLookupResults={
        visualQaState === "lookup"
          ? async () => ({ failures: [], results: visualQaAssetLookupResults })
          : visualQaState === "lookup-failure"
            ? async () => ({ failures: ["Provider unavailable"], results: [] })
            : undefined
      }
    />
  );
}
