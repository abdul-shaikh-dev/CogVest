import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { createMmkvJsonStorage, type JsonStorage } from "@/src/services/storage";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import {
  dailyPriceCacheFixtureAssetCount,
  dailyPriceCacheFixtureNow,
  dailyPriceCacheFixturePointCount,
  runDailyPriceCacheFixtureBenchmark,
  type DailyPriceCacheBenchmarkResult,
} from "@/src/testing/dailyPriceCacheFixture";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";
import { colors, spacing } from "@/src/theme";

const qaMmkvId = "cogvest-daily-price-qa";

function createQaStorage(): JsonStorage {
  const { createMMKV } = require("react-native-mmkv") as typeof import("react-native-mmkv");

  return createMmkvJsonStorage(createMMKV({ id: qaMmkvId }));
}

function milliseconds(value: number) {
  return `${value.toFixed(2)}ms`;
}

function statusPass(result: DailyPriceCacheBenchmarkResult) {
  const expectedSlicePointCount = dailyPriceCacheFixtureAssetCount * 365;

  return result.fixture.pointCount === dailyPriceCacheFixturePointCount &&
    result.writes.statuses.length === dailyPriceCacheFixtureAssetCount &&
    result.writes.statuses.every((status) => status === "stored") &&
    result.coldRead.statuses.length === dailyPriceCacheFixtureAssetCount &&
    result.coldRead.statuses.every((status) => status === "hit") &&
    result.coldRead.freshnesses.length === dailyPriceCacheFixtureAssetCount &&
    result.coldRead.freshnesses.every((freshness) => freshness === "current") &&
    result.coldRead.coverages.length === dailyPriceCacheFixtureAssetCount &&
    result.coldRead.coverages.every((coverage) => coverage === "complete") &&
    result.warmRead.statuses.length === dailyPriceCacheFixtureAssetCount &&
    result.warmRead.statuses.every((status) => status === "hit") &&
    result.chartTransform.pointCount === expectedSlicePointCount &&
    result.chartTransform.finiteValueCount === expectedSlicePointCount;
}

export default function QuoteCacheQaRoute() {
  const params = useLocalSearchParams<{ token?: string }>();
  const enabled = canUseVisualQaHarness({
    isDevelopment: __DEV__,
    token: params.token,
  });
  const storageRef = useRef<JsonStorage | null>(null);
  const storageFailureRef = useRef<string | null>(null);
  const [result, setResult] = useState<DailyPriceCacheBenchmarkResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <ScreenContainer testID="quote-cache-qa-blocked">
        <AppText weight="bold">Quote-cache QA is unavailable.</AppText>
        <AppText color="secondary">
          This route requires the explicit development visual-QA token.
        </AppText>
      </ScreenContainer>
    );
  }

  if (!storageRef.current && !storageFailureRef.current) {
    try {
      storageRef.current = createQaStorage();
    } catch {
      storageFailureRef.current = "Synthetic QA storage could not be opened on this device.";
    }
  }

  function runBenchmark() {
    const storage = storageRef.current;

    if (!storage || storageFailureRef.current) {
      setError(storageFailureRef.current ?? "Synthetic QA storage is unavailable.");
      return;
    }

    try {
      // This id is dedicated to synthetic QA data and never touches portfolio storage.
      const clearResult = createDailyPriceCache({
        now: () => dailyPriceCacheFixtureNow,
        storage,
      }).clear();
      if (clearResult.status !== "cleared") {
        setError("Synthetic QA cache could not be cleared before the benchmark.");
        return;
      }
      const nextResult = runDailyPriceCacheFixtureBenchmark(storage);

      console.info("[quote-cache-qa] result", JSON.stringify(nextResult));
      setError(null);
      setResult(nextResult);
    } catch {
      setError("Synthetic QA benchmark could not complete on this device.");
    }
  }

  const passed = result ? statusPass(result) : false;

  return (
    <ScreenContainer scroll testID="quote-cache-qa-screen">
      <View style={styles.content}>
        <AppText variant="section" weight="bold">Quote-cache QA</AppText>
        <AppText color="secondary" variant="caption">
          Synthetic daily histories only. Benchmarking records cache bytes and JS timings; it does not claim UI smoothness.
        </AppText>
        <AppButton
          onPress={runBenchmark}
          testID="quote-cache-qa-run"
          title="Run benchmark"
          variant="secondary"
        />
        <View style={styles.result} testID="quote-cache-qa-result">
          {error ? (
            <AppText color="secondary" variant="caption">{error}</AppText>
          ) : !result ? (
            <AppText color="secondary" variant="caption">Ready</AppText>
          ) : (
            <>
              <AppText weight="bold">{passed ? "PASS" : "CHECK RESULTS"}</AppText>
              <AppText
                accessibilityLabel={`Synthetic point count: ${result.fixture.pointCount}`}
                testID="quote-cache-qa-point-count"
                variant="caption"
              >
                Synthetic point count: {result.fixture.pointCount}
              </AppText>
              <AppText variant="caption">
                Dates: {result.fixture.from} to {result.fixture.to}; storage: {result.storageBytes} bytes.
              </AppText>
              <AppText variant="caption">
                10 writes: {milliseconds(result.writes.milliseconds)}; cold read: {milliseconds(result.coldRead.milliseconds)}; warm read: {milliseconds(result.warmRead.milliseconds)}.
              </AppText>
              <AppText variant="caption">
                Write: {result.writes.statuses[0]}; read: {result.coldRead.statuses[0]}; freshness: {result.coldRead.freshnesses[0]}; coverage: {result.coldRead.coverages[0]}.
              </AppText>
              <AppText variant="caption">
                Slice and chart transform: {milliseconds(result.chartTransform.milliseconds)}; finite values: {result.chartTransform.finiteValueCount}/{result.chartTransform.pointCount}.
              </AppText>
            </>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  result: {
    backgroundColor: colors.surface.elevated,
    gap: spacing.xs,
    padding: spacing.md,
  },
});
