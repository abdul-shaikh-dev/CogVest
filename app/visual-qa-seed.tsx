import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppText, ScreenContainer } from "@/src/components/common";
import { getPortfolioStore } from "@/src/store";
import {
  canUseVisualQaHarness,
  seedVisualQaPortfolio,
} from "@/src/testing/visualQaSeed";
import { colors, spacing } from "@/src/theme";

export default function VisualQaSeedRoute() {
  const params = useLocalSearchParams<{ token?: string; history?: string }>();
  const canSeed = canUseVisualQaHarness({
    isDevelopment: __DEV__,
    token: params.token,
  });
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState("");
  const hasPrompted = useRef(false);

  useEffect(() => {
    if (!canSeed || hasPrompted.current) {
      return;
    }

    hasPrompted.current = true;
    Alert.alert(
      "Replace local developer data?",
      "This visual QA tool permanently replaces holdings, transactions, cash entries, quotes, and monthly snapshots stored by this development build.",
      [
        {
          onPress: () => router.replace("/dashboard"),
          style: "cancel",
          text: "Cancel",
        },
        {
          onPress: () => {
            try {
              seedVisualQaPortfolio(getPortfolioStore(), {
                longHistory: params.history === "long",
              });
              setSeeded(true);
            } catch (error) {
              setSeedError(
                error instanceof Error ? error.message : "Unknown error",
              );
            }
          },
          style: "destructive",
          text: "Replace with visual QA data",
        },
      ],
      { cancelable: false },
    );
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

  if (seeded) {
    return (
      <ScreenContainer testID="visual-qa-seed-screen">
        <AppText weight="bold">Visual QA portfolio seeded.</AppText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="visual-qa-seed-confirmation">
      <View style={styles.content}>
        <AppText variant="title" weight="bold">
          Visual QA confirmation required
        </AppText>
        <AppText color="secondary">
          Approve or cancel the Android confirmation dialog. No local data is
          changed until you approve the destructive action.
        </AppText>
        {seedError ? (
          <AppText style={styles.error} testID="visual-qa-seed-error">
            Visual QA data could not be installed: {seedError}
          </AppText>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  error: {
    color: colors.loss,
  },
});
