import { useLocalSearchParams } from "expo-router";
import { Profiler, useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { AddOpeningPositionForm } from "@/src/features/openingPositions";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import {
  assetSearchQaFixtureCounts,
  createAssetSearchQaLookup,
  seedAssetSearchQaStore,
} from "@/src/testing/assetSearchFixture";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";
import { colors, spacing } from "@/src/theme";

type Measurement = {
  detail: string;
  kind: "event-loop-stall" | "render" | "search-to-render";
  milliseconds: number;
};

const renderTargetMs = 500;
const eventLoopStallThresholdMs = 100;
const eventLoopSampleMs = 50;
const maxMeasurements = 12;

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function formatMeasurement(measurement: Measurement) {
  return `${measurement.kind}: ${measurement.milliseconds.toFixed(1)}ms (${measurement.detail})`;
}

export default function AssetSearchQaRoute() {
  const params = useLocalSearchParams<{ token?: string }>();
  const enabled = canUseVisualQaHarness({
    isDevelopment: __DEV__,
    token: params.token,
  });
  const storeRef = useRef<ReturnType<typeof createPortfolioStore> | null>(null);
  const recentSearchStorageRef = useRef<ReturnType<typeof createMemoryJsonStorage> | null>(null);
  const pendingSearchAtRef = useRef<number | null>(null);
  const measurementsRef = useRef<Measurement[]>([]);
  const suppressNextProfilerCommitRef = useRef(false);
  const [formKey, setFormKey] = useState(0);
  const [measurementSnapshot, setMeasurementSnapshot] = useState<Measurement[]>([]);

  const recordMeasurement = useCallback((measurement: Measurement) => {
    console.info("[asset-search-qa]", formatMeasurement(measurement));
    measurementsRef.current = [measurement, ...measurementsRef.current].slice(
      0,
      maxMeasurements,
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let expected = now() + eventLoopSampleMs;
    const interval = setInterval(() => {
      const observed = now();
      const lag = observed - expected;
      expected = observed + eventLoopSampleMs;

      if (lag > eventLoopStallThresholdMs) {
        recordMeasurement({
          detail: `interval lag above ${eventLoopStallThresholdMs}ms`,
          kind: "event-loop-stall",
          milliseconds: lag,
        });
      }
    }, eventLoopSampleMs);

    return () => clearInterval(interval);
  }, [enabled, recordMeasurement]);

  const searchAssetLookupResults = useCallback(async ({ query }: { query: string }) => {
    pendingSearchAtRef.current = now();
    return {
      failures: [],
      results: createAssetSearchQaLookup(query),
    };
  }, []);

  if (!enabled) {
    return (
      <ScreenContainer testID="asset-search-qa-blocked">
        <AppText weight="bold">Asset-search QA is unavailable.</AppText>
        <AppText color="secondary">
          This development-only route requires the explicit local visual-QA token.
        </AppText>
      </ScreenContainer>
    );
  }

  if (!storeRef.current) {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    seedAssetSearchQaStore(store);
    storeRef.current = store;
    recentSearchStorageRef.current = createMemoryJsonStorage();
  }
  const recentSearchStorage = recentSearchStorageRef.current;

  if (!recentSearchStorage) {
    throw new Error("Asset-search QA memory storage was not initialized.");
  }

  function handleRender(
    _id: string,
    phase: "mount" | "nested-update" | "update",
    actualDuration: number,
  ) {
    if (suppressNextProfilerCommitRef.current) {
      suppressNextProfilerCommitRef.current = false;
      return;
    }

    const searchStartedAt = pendingSearchAtRef.current;
    const renderedAt = now();

    recordMeasurement({
      detail: `${phase}; raw React actualDuration; target <= ${renderTargetMs}ms`,
      kind: "render",
      milliseconds: actualDuration,
    });

    if (searchStartedAt !== null && phase !== "mount") {
      pendingSearchAtRef.current = null;
      recordMeasurement({
        detail: "fixture lookup callback to next committed form render",
        kind: "search-to-render",
        milliseconds: renderedAt - searchStartedAt,
      });
    }
  }

  function resetMeasurements() {
    console.info("[asset-search-qa] measurement window reset");
    pendingSearchAtRef.current = null;
    measurementsRef.current = [];
    suppressNextProfilerCommitRef.current = true;
    setMeasurementSnapshot([]);
  }

  function captureMeasurements() {
    suppressNextProfilerCommitRef.current = true;
    setMeasurementSnapshot([...measurementsRef.current]);
  }

  function warmUpForm() {
    pendingSearchAtRef.current = null;
    setFormKey((current) => current + 1);
  }

  return (
    <View style={styles.screen} testID="asset-search-qa-screen">
      <View style={styles.controls}>
        <AppText variant="section" weight="bold">Asset search QA</AppText>
        <AppText color="secondary" variant="caption">
          Isolated synthetic data: {assetSearchQaFixtureCounts.savedAssets} saved assets and {assetSearchQaFixtureCounts.providerCandidates} provider candidates. Try `SAVED0420` for a saved exact match, or `CAND0042` for a provider exact match.
        </AppText>
        <View style={styles.actions}>
          <AppButton onPress={warmUpForm} testID="asset-search-qa-warmup" title="Warm up form" variant="secondary" />
          <AppButton onPress={captureMeasurements} testID="asset-search-qa-capture-metrics" title="Capture metrics" variant="ghost" />
          <AppButton onPress={resetMeasurements} testID="asset-search-qa-reset-metrics" title="Reset metrics" variant="ghost" />
        </View>
        <View style={styles.report} testID="asset-search-qa-report">
          <AppText variant="caption" testID="asset-search-qa-record-counts">
            Assets: {storeRef.current.getState().assets.length}; openings: {storeRef.current.getState().openingPositions.length}
          </AppText>
          <AppText variant="caption" weight="bold">Raw measurements</AppText>
          <AppText color="secondary" variant="caption">
            {"Render target: <= "}{renderTargetMs}ms. Event-loop stalls are logged only when sampled lag exceeds {eventLoopStallThresholdMs}ms. Measurements are debug observations, not device-performance claims.
          </AppText>
          {measurementSnapshot.length === 0 ? (
            <AppText color="secondary" variant="caption">Capture metrics to display the current ref-held measurements.</AppText>
          ) : measurementSnapshot.slice(0, 3).map((measurement, index) => (
            <AppText key={`${measurement.kind}-${index}-${measurement.milliseconds}`} variant="caption">
              {formatMeasurement(measurement)}
            </AppText>
          ))}
        </View>
      </View>
      <View style={styles.form}>
        <Profiler id="asset-search-qa-form" onRender={handleRender}>
          <AddOpeningPositionForm
            key={formKey}
            hardwareBackEnabled={false}
            recentSearchStorage={recentSearchStorage}
            resolveQuote={async ({ asset }) => ({ ok: true, quote: {
              assetId: asset.id, currency: asset.currency, price: 100,
              source: asset.assetClass === "crypto" ? "coingecko" : "yahoo",
              asOf: new Date().toISOString(),
            } })}
            searchAssetLookupResults={searchAssetLookupResults}
            store={storeRef.current}
          />
        </Profiler>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  controls: {
    backgroundColor: colors.surface.elevated,
    gap: spacing.xs,
    paddingHorizontal: spacing.screenHorizontal,
    paddingVertical: spacing.sm,
  },
  form: {
    flex: 1,
  },
  report: {
    gap: 2,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
