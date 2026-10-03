import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AppButton, AppText } from "@/src/components/common";
import { ProgressScreen } from "@/src/features/progress";
import { createProgressEdgeFixture, progressEdgeNow } from "@/src/testing/progressEdgeFixture";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

function EnabledProgressEdgeQa({ scenario, minimal }: { scenario: string; minimal: boolean }) {
  const [fixture] = useState(() => createProgressEdgeFixture(scenario, minimal));
  useEffect(() => () => fixture.dispose(), [fixture]);
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <ProgressScreen store={fixture.store} now={progressEdgeNow} historicalPriceFetcher={fixture.fetcher} />
    {scenario === "building" ? <AppButton title="Finish synthetic fetch" testID="progress-edge-finish" onPress={fixture.release} /> : null}
  </>;
}

export default function ProgressEdgeQaRoute() {
  const { token, scenario = "single", mode } = useLocalSearchParams<{ token?: string; scenario?: string; mode?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) {
    return <AppText testID="progress-edge-qa-blocked">Progress QA is unavailable.</AppText>;
  }
  return <EnabledProgressEdgeQa key={`${scenario}-${mode}`} scenario={scenario} minimal={mode === "minimal"} />;
}
