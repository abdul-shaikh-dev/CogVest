import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { AppText, ScreenContainer } from "@/src/components/common";
import { getPortfolioStore } from "@/src/store";
import {
  canUseVisualQaHarness,
  seedVisualQaPortfolio,
} from "@/src/testing/visualQaSeed";

export default function VisualQaSeedRoute() {
  const params = useLocalSearchParams<{ token?: string }>();
  const canSeed = canUseVisualQaHarness(params.token);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!canSeed) {
      return;
    }

    seedVisualQaPortfolio(getPortfolioStore());
    setSeeded(true);
  }, [canSeed]);

  if (!canSeed) {
    return (
      <ScreenContainer testID="visual-qa-seed-blocked">
        <AppText weight="bold">Visual QA seeding is unavailable.</AppText>
        <AppText color="secondary">
          This route only seeds local test data for explicit visual QA runs.
        </AppText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="visual-qa-seed-screen">
      <AppText weight="bold">
        {seeded ? "Visual QA portfolio seeded." : "Seeding visual QA portfolio..."}
      </AppText>
    </ScreenContainer>
  );
}
