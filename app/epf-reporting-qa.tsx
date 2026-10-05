import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { AppText } from "@/src/components/common";
import { DashboardScreen } from "@/src/features/dashboard";
import { ProgressScreen } from "@/src/features/progress";
import { createEpfReportingFixture, epfReportingDate } from "@/src/testing/epfReportingFixture";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

function Enabled({ minimal, progress }: { minimal: boolean; progress: boolean }) {
  const [store] = useState(() => {
    const fixture = createEpfReportingFixture();
    fixture.getState().updatePreferences({ displayMode: minimal ? "minimal" : "standard" });
    return fixture;
  });
  return progress ? <ProgressScreen store={store} now={epfReportingDate} historicalPriceFetcher={async () => ({ ok: false, error: "Synthetic fixture has no provider" })} />
    : <DashboardScreen store={store} now={epfReportingDate} />;
}
export default function EpfReportingQa() {
  const { token, mode } = useLocalSearchParams<{ token?: string; mode?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) return <AppText>EPF QA unavailable.</AppText>;
  return <Enabled key={mode} minimal={mode === "minimal"} progress={mode === "progress"} />;
}
