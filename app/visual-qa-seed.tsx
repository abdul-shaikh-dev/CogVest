import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

import { AppText, ScreenContainer } from "@/src/components/common";
import { getPortfolioStore } from "@/src/store";
import {
  canUseVisualQaHarness,
  seedVisualQaPortfolio,
} from "@/src/testing/visualQaSeed";

export default function VisualQaSeedRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const canSeed = canUseVisualQaHarness(params.token);

  useEffect(() => {
    if (!canSeed) {
      return;
    }

    seedVisualQaPortfolio(getPortfolioStore());
    router.replace("/(tabs)/dashboard");
  }, [canSeed, router]);

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
      <AppText weight="bold">Seeding visual QA portfolio...</AppText>
    </ScreenContainer>
  );
}
