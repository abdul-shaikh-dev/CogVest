import { useLocalSearchParams } from "expo-router";

import { AddOpeningPositionForm } from "@/src/features/openingPositions";
import {
  canUseVisualQaHarness,
  visualQaAssetLookupResults,
  visualQaQuotes,
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
      resolveQuote={
        visualQaState === "lookup"
          ? async ({ asset }) => {
              const quote =
                visualQaQuotes.find((candidate) => candidate.assetId === asset.id) ??
                visualQaQuotes[0];

              return { ok: true, quote };
            }
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
