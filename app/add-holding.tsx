import { router, useLocalSearchParams } from "expo-router";

import { AddOpeningPositionForm } from "@/src/features/openingPositions";
import {
  canUseVisualQaHarness,
  visualQaAssetLookupResults,
  resolveVisualQaQuote,
} from "@/src/testing/visualQaSeed";

export default function AddHoldingScreen() {
  const params = useLocalSearchParams<{
    token?: string;
    visualQaState?: string;
  }>();
  const canUseVisualQaState = canUseVisualQaHarness(params.token);
  const visualQaState = canUseVisualQaState ? params.visualQaState : undefined;

  return (
    <AddOpeningPositionForm
      initialVisualQaState={
        visualQaState === "review" ? "review" : undefined
      }
      onCancel={() => router.back()}
      onComplete={() => router.replace("/(tabs)/holdings")}
      resolveQuote={
        visualQaState === "lookup"
          ? async ({ asset }) => resolveVisualQaQuote(asset)
          : undefined
      }
      searchAssetLookupResults={
        visualQaState === "lookup"
          ? async () => ({ failures: [], results: visualQaAssetLookupResults })
          : undefined
      }
    />
  );
}
