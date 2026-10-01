import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { getPortfolioStore } from "@/src/store";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createAndroidScaleFixture } from "@/src/testing/androidScaleFixture";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

export default function ScaleQaRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [result, setResult] = useState("Ready");
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) {
    return <AppText testID="scale-qa-blocked">Scale QA is unavailable.</AppText>;
  }
  function seed() {
    Alert.alert("Replace synthetic test data?", "Only use this on a disposable emulator. It replaces the portfolio and daily cache.", [
      { text: "Cancel", style: "cancel" },
      { text: "Replace with scale fixture", style: "destructive", onPress: () => {
        try {
          const fixture = createAndroidScaleFixture();
          const cache = createDailyPriceCache();
          if (cache.clear().status !== "cleared") throw new Error("Cache unavailable");
          for (const entry of fixture.dailyPriceEntries) {
            if (cache.write(entry).status !== "stored") throw new Error("Cache write failed");
          }
          const state = getPortfolioStore().getState();
          state.replaceFromBackup({ portfolio: fixture.portfolio, quoteCache: fixture.quoteCache,
            historicalQuoteCache: {}, casFolioSalt: null }, state.getBackupRevision());
        } catch { setResult("Scale fixture could not be installed."); }
      } },
    ]);
  }
  return <ScreenContainer testID="scale-qa-screen">
    <AppText weight="bold">Synthetic Android scale QA</AppText>
    <AppText>250 assets, 1000 transactions, all completed months since 2019, ten daily histories with 3653 points each.</AppText>
    <AppButton title="Prepare scale fixture" testID="scale-qa-seed" onPress={seed} />
    <AppText>{result}</AppText>
  </ScreenContainer>;
}
