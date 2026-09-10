import { useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
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
  kind: "event-loop-stall" | "render" | "search-to-render" | "query-to-render" | "filter-to-render" | "saved-page-to-render" | "provider-page-to-render";
  milliseconds: number;
};

type MeasurementSnapshot = {
  droppedMeasurements: number;
  measurements: Measurement[];
};

const renderTargetMs = 500;
const eventLoopStallThresholdMs = 100;
const eventLoopSampleMs = 50;
const maxMeasurements = 2000;

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export default function AssetSearchQaRoute() {
  const params = useLocalSearchParams<{ token?: string; profile?: string }>();
  const profileRenders = params.profile === "1";
  const isFocused = useIsFocused();
  const enabled = canUseVisualQaHarness({
    isDevelopment: __DEV__,
    token: params.token,
  });
  const storeRef = useRef<ReturnType<typeof createPortfolioStore> | null>(null);
  const recentSearchStorageRef = useRef<ReturnType<typeof createMemoryJsonStorage> | null>(null);
  const pendingSearchAtRef = useRef<number | null>(null);
  const pendingActionRef = useRef<{
    kind: "query" | "filter" | "saved-page" | "provider-page";
    startedAt: number;
    remaining: Set<"saved" | "provider">;
  } | null>(null);
  const measurementsRef = useRef<Measurement[]>([]);
  const droppedMeasurementsRef = useRef(0);
  const measurementWindowActiveRef = useRef(true);
  const nextRenderContextRef = useRef<string | undefined>("cold route mount");
  const eventLoopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressNextProfilerCommitRef = useRef(false);
  const [formKey, setFormKey] = useState(0);
  const [measurementWindowEpoch, setMeasurementWindowEpoch] = useState(0);
  const [measurementSnapshot, setMeasurementSnapshot] =
    useState<MeasurementSnapshot | null>(null);

  const recordMeasurement = useCallback((measurement: Measurement) => {
    if (!measurementWindowActiveRef.current) {
      return;
    }

    if (measurementsRef.current.length >= maxMeasurements) {
      droppedMeasurementsRef.current += 1;
      return;
    }

    measurementsRef.current.push(measurement);
  }, []);

  useEffect(() => {
    if (!enabled || !isFocused || !measurementWindowActiveRef.current) {
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
    eventLoopIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      if (eventLoopIntervalRef.current === interval) {
        eventLoopIntervalRef.current = null;
      }
    };
  }, [enabled, isFocused, measurementWindowEpoch, recordMeasurement]);

  const searchAssetLookupResults = useCallback(async ({ query }: { query: string }) => {
    pendingSearchAtRef.current = now();
    return {
      failures: [],
      results: createAssetSearchQaLookup(query),
    };
  }, []);

  const handleDiscoveryAction = useCallback((kind: "query" | "filter" | "saved-page" | "provider-page") => {
    pendingActionRef.current = {
      kind, startedAt: now(),
      remaining: new Set(kind === "filter" ? ["saved", "provider"] : [kind === "provider-page" ? "provider" : "saved"]),
    };
  }, []);

  const handleDiscoverySettled = useCallback((kind: "saved" | "provider") => {
    const renderedAt = now();
    if (kind === "provider" && pendingSearchAtRef.current !== null) {
      recordMeasurement({ kind: "search-to-render", detail: "fixture callback to complete visible provider page", milliseconds: renderedAt - pendingSearchAtRef.current });
      pendingSearchAtRef.current = null;
    }
    const action = pendingActionRef.current;
    if (!action) return;
    action.remaining.delete(kind);
    if (action.remaining.size === 0) {
      recordMeasurement({ kind: `${action.kind}-to-render`, detail: "input handler to complete visible result rows", milliseconds: renderedAt - action.startedAt });
      pendingActionRef.current = null;
    }
  }, [recordMeasurement]);

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
    if (
      suppressNextProfilerCommitRef.current ||
      !isFocused ||
      !measurementWindowActiveRef.current
    ) {
      suppressNextProfilerCommitRef.current = false;
      return;
    }

    const renderContext = nextRenderContextRef.current ?? "interactive";

    nextRenderContextRef.current = undefined;

    recordMeasurement({
      detail: `${renderContext}; ${phase}; raw React actualDuration; target <= ${renderTargetMs}ms`,
      kind: "render",
      milliseconds: actualDuration,
    });

  }

  function resetMeasurements() {
    pendingActionRef.current = null;
    pendingSearchAtRef.current = null;
    measurementsRef.current = [];
    droppedMeasurementsRef.current = 0;
    measurementWindowActiveRef.current = true;
    suppressNextProfilerCommitRef.current = true;
    setMeasurementSnapshot(null);
    setMeasurementWindowEpoch((current) => current + 1);
  }

  function captureMeasurements() {
    pendingActionRef.current = null;
    measurementWindowActiveRef.current = false;
    pendingSearchAtRef.current = null;
    if (eventLoopIntervalRef.current) {
      clearInterval(eventLoopIntervalRef.current);
      eventLoopIntervalRef.current = null;
    }
    const snapshot = {
      droppedMeasurements: droppedMeasurementsRef.current,
      measurements: [...measurementsRef.current],
    };

    console.info(
      "[asset-search-qa] metrics",
      JSON.stringify({
        capturedAt: new Date().toISOString(),
        coverage: {
          eventLoopSampleMs,
          eventLoopStallThresholdMs,
          renderTargetMs,
          routeWasFocused: isFocused,
          profileRenders,
          window: "ended on capture; reset starts a new window",
        },
        ...snapshot,
      }),
    );
    suppressNextProfilerCommitRef.current = true;
    setMeasurementSnapshot(snapshot);
  }

  function warmUpForm() {
    pendingSearchAtRef.current = null;
    nextRenderContextRef.current = "warm-up form remount";
    setFormKey((current) => current + 1);
  }

  const form = <AddOpeningPositionForm
    onDiscoveryAction={handleDiscoveryAction}
    onDiscoverySettled={handleDiscoverySettled}
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
  />;

  return (
    <View style={styles.screen} testID="asset-search-qa-screen">
      <View style={styles.controls}>
        <AppText variant="section" weight="bold">Asset search QA</AppText>
        <AppText color="secondary" variant="caption">
          Synthetic: {assetSearchQaFixtureCounts.savedAssets} saved / {assetSearchQaFixtureCounts.providerCandidates} candidates. SAVED0420 or CAND0042.
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
          <AppText color="secondary" variant="caption">
            {"Render <= "}{renderTargetMs}ms; sampled lag limit {eventLoopStallThresholdMs}ms. Capture ends and exports the window. Reset starts a new one. Debug observations only.
          </AppText>
          {!measurementSnapshot ? (
            <AppText color="secondary" variant="caption">Capture metrics to end the active window and display its export summary.</AppText>
          ) : (
            <AppText color="secondary" variant="caption">
              Captured {measurementSnapshot.measurements.length}; dropped {measurementSnapshot.droppedMeasurements}. Full JSON exported.
            </AppText>
          )}
        </View>
      </View>
      <View style={styles.form}>
        {profileRenders ? <Profiler id="asset-search-qa-form" onRender={handleRender}>{form}</Profiler> : form}
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
