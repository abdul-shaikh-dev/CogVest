import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { buildPpfExcludedChartHistory } from "@/src/domain/calculations/ppfExcludedChartHistory";
import type { StoreApi } from "zustand/vanilla";

import {
  buildMonthlyProgressChartData,
  calculateMonthlyProgressSummaries,
  getDefaultMonthlyChartRange,
  getPreviousCompletedMonth,
  type MonthlyChartCustomRange,
  type MonthlyChartRange,
} from "@/src/domain/calculations";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { resolveHistoricalPrice } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";

import {
  getSnapshotAutomationProgress,
  inFlightSnapshotAutomationRuns,
  publishSnapshotAutomationProgress,
  runMonthEndSnapshotAutomation,
  snapshotAutomationEpochs,
  subscribeToSnapshotAutomationProgress,
} from "./monthEndSnapshotRun";
import {
  automationStatusFromResult,
  calculateProgressPortfolio,
  emptyProgressFormValues,
  getCompletedMonthState,
  getDefaultCustomChartRange,
  getSnapshotAutomationTargetMonths,
  normalizeCustomChartRange,
  presentSnapshotAutomationStatus,
  validateProgressSnapshotForm,
  type MonthEndSnapshotAutomationRunResult,
  type ProgressFormErrors,
  type ProgressFormValues,
  type SnapshotAutomationStatusState,
} from "./progressSnapshotModel";

export type {
  ProgressFormErrors,
  ProgressFormValues,
  ProgressSnapshotAutomationStatus,
  ProgressSnapshotStatusKind,
  SnapshotAutomationProgress,
} from "./progressSnapshotModel";

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

type UseProgressInput = {
  historicalPriceFetcher?: typeof resolveHistoricalPrice;
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
};

export function useProgress({
  historicalPriceFetcher = resolveHistoricalPrice,
  now = new Date(),
  store = getPortfolioStore(),
}: UseProgressInput = {}) {
  const snapshot = usePortfolioSnapshot(store);
  const activeAutomationProgress = useSyncExternalStore(
    (listener) => subscribeToSnapshotAutomationProgress(store, listener),
    () => getSnapshotAutomationProgress(store),
    () => null,
  );
  const currentCalendarMonth = formatLocalCalendarDate(now).slice(0, 7);
  // Keep chart-only partial history out of persisted full-portfolio snapshots.
  // Memoize the multi-month reconstruction, not cheap presentation calculations.
  const ppfExcludedHistory = useMemo(() => buildPpfExcludedChartHistory({
    assets: snapshot.assets,
    cashEntries: snapshot.cashEntries,
    existingSnapshots: snapshot.monthlySnapshots,
    historicalQuotes: snapshot.historicalQuoteCache,
    now: new Date(`${currentCalendarMonth}-15T12:00:00Z`),
    openingPositions: snapshot.openingPositions,
    ppfAccounts: snapshot.ppfAccounts,
    ppfLedgerEntries: snapshot.ppfLedgerEntries,
    quoteCache: snapshot.quoteCache,
    trades: snapshot.trades,
  }), [snapshot.assets, snapshot.cashEntries, snapshot.monthlySnapshots,
    snapshot.historicalQuoteCache, snapshot.openingPositions, snapshot.ppfAccounts,
    snapshot.ppfLedgerEntries, snapshot.quoteCache, snapshot.trades, currentCalendarMonth]);
  const chartSnapshots = ppfExcludedHistory?.snapshots ?? snapshot.monthlySnapshots;
  const [formValues, setFormValues] = useState(emptyProgressFormValues);
  const [errors, setErrors] = useState<ProgressFormErrors>({});
  const [snapshotAutomationStatus, setSnapshotAutomationStatus] =
    useState<SnapshotAutomationStatusState>(() => ({
      message: "Checking completed months for missing snapshots.",
      pendingMonths: [],
      progress: null,
      provisionalMonths: [],
      snapshot: null,
      status: "idle",
      targetMonth: getPreviousCompletedMonth(now),
      warnings: [],
    }));
  const [portfolioChartRange, setPortfolioChartRange] =
    useState<MonthlyChartRange>(() =>
      getDefaultMonthlyChartRange(chartSnapshots.length),
    );
  const [assetChartRange, setAssetChartRange] = useState<MonthlyChartRange>(() =>
    getDefaultMonthlyChartRange(chartSnapshots.length),
  );
  const [portfolioChartCustomRange, setPortfolioChartCustomRange] =
    useState<MonthlyChartCustomRange>(() =>
      getDefaultCustomChartRange(chartSnapshots),
    );
  const [assetChartCustomRange, setAssetChartCustomRange] =
    useState<MonthlyChartCustomRange>(() =>
      getDefaultCustomChartRange(chartSnapshots),
    );

  useEffect(() => {
    setPortfolioChartCustomRange((current) =>
      normalizeCustomChartRange(current, chartSnapshots),
    );
    setAssetChartCustomRange((current) =>
      normalizeCustomChartRange(current, chartSnapshots),
    );
  }, [chartSnapshots]);
  const asOf = formatLocalCalendarDate(now);
  // Range selection must not replay the entire portfolio. These calculations
  // use calendar-day cutovers; financial records, quotes or a new day invalidate.
  const { allocation, cashBalance, hasData, monthlyMetrics, portfolioValue, totalInvested } = useMemo(
    () => calculateProgressPortfolio({
      assets: snapshot.assets,
      cashEntries: snapshot.cashEntries,
      openingPositions: snapshot.openingPositions,
      ppfAccounts: snapshot.ppfAccounts,
      ppfLedgerEntries: snapshot.ppfLedgerEntries,
      quoteCache: snapshot.quoteCache,
      trades: snapshot.trades,
    }, now, asOf),
    [snapshot.assets, snapshot.openingPositions, snapshot.trades, snapshot.quoteCache,
      snapshot.cashEntries, snapshot.ppfAccounts, snapshot.ppfLedgerEntries, asOf],
  );
  const monthlySummaries = useMemo(() => calculateMonthlyProgressSummaries(
    snapshot.monthlySnapshots,
  ), [snapshot.monthlySnapshots]);
  const latestSummary = monthlySummaries[0];
  const portfolioChartData = buildMonthlyProgressChartData(
    chartSnapshots,
    portfolioChartRange,
    portfolioChartCustomRange,
  );
  const assetChartData = buildMonthlyProgressChartData(
    chartSnapshots,
    assetChartRange,
    assetChartCustomRange,
  );

  function setField(field: keyof ProgressFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function saveSnapshot(snapshotId?: string) {
    const result = validateProgressSnapshotForm(formValues);

    if (!result.snapshot) {
      setErrors(result.errors);
      return false;
    }
    const candidate = result.snapshot;

    const existingSnapshot = snapshot.monthlySnapshots.find(
      (monthlySnapshot) => snapshotId ? monthlySnapshot.id === snapshotId : monthlySnapshot.month === candidate.month,
    );
    if (snapshotId && !existingSnapshot) {
      setErrors({ portfolioValue: "Snapshot changed. Reopen the review before saving." });
      return false;
    }
    if (snapshot.monthlySnapshots.some((item) => item.month === candidate.month && item.id !== existingSnapshot?.id)) {
      setErrors({ month: "This month already has a snapshot. Choose another month." });
      return false;
    }

    try {
      if (existingSnapshot) {
        store.getState().updateMonthlySnapshot({
          ...candidate,
          generated: existingSnapshot.generated
            ? { ...existingSnapshot.generated, source: "manual" }
            : undefined,
          id: existingSnapshot.id,
          performanceBasis: existingSnapshot.month !== candidate.month
            ? candidate.performanceBasis
            : existingSnapshot.performanceBasis ?? {
              reason: "legacy-snapshot",
              status: "unavailable",
              warnings: [
                "Monthly performance is unavailable for snapshots recorded before contribution tracking.",
              ],
            },
        });
      } else {
        store.getState().addMonthlySnapshot(candidate);
      }
    } catch {
      setErrors({ portfolioValue: "Snapshot could not be saved. Your stored values are unchanged. Free device storage and try again." });
      return false;
    }

    setFormValues(emptyProgressFormValues());
    setErrors({});
    return true;
  }

  async function ensureMonthEndSnapshot(
    { retryProvisional = true }: { retryProvisional?: boolean } = {},
  ) {
    const restoreEpoch = store.getState().restoreEpoch;
    if (snapshotAutomationEpochs.get(store) !== restoreEpoch) {
      inFlightSnapshotAutomationRuns.delete(store);
      snapshotAutomationEpochs.set(store, restoreEpoch);
    }
    const requestedLastCompletedMonth = getPreviousCompletedMonth(now);

    while (true) {
      let run = inFlightSnapshotAutomationRuns.get(store);

      if (!run) {
        const state = store.getState();
        const targetMonths = getSnapshotAutomationTargetMonths({
          now,
          retryProvisional,
          state,
        });

        if (targetMonths.length === 0) {
          const {
            hasCompletedPortfolioRecord,
            latestCompletedSnapshot,
            provisionalMonths,
          } = getCompletedMonthState(state, requestedLastCompletedMonth);
          const result: MonthEndSnapshotAutomationRunResult = {
            createdCount: 0,
            lastCompletedMonth: requestedLastCompletedMonth,
            pendingMonths: [],
            provisionalCount: provisionalMonths.length,
            provisionalMonths,
            refreshedCount: 0,
            snapshot: latestCompletedSnapshot,
            status: hasCompletedPortfolioRecord
              ? "already-exists"
              : "insufficient-data",
            targetMonths,
            warnings: [],
          };

          setSnapshotAutomationStatus(automationStatusFromResult(result));

          return result;
        }

        run = runMonthEndSnapshotAutomation({
          historicalPriceFetcher,
          now,
          store,
          targetMonths,
        });
        inFlightSnapshotAutomationRuns.set(store, run);
        const startedRun = run;
        void startedRun
          .finally(() => {
            if (inFlightSnapshotAutomationRuns.get(store) === startedRun) {
              inFlightSnapshotAutomationRuns.delete(store);
            }
          })
          .catch(() => undefined);
      }

      let result: MonthEndSnapshotAutomationRunResult;
      try {
        result = await run;
      } catch (error) {
        publishSnapshotAutomationProgress(store, null);
        throw error;
      }
      if (store.getState().restoreEpoch !== restoreEpoch) {
        publishSnapshotAutomationProgress(store, null);
        return result;
      }

      if (result.lastCompletedMonth !== requestedLastCompletedMonth) {
        if (inFlightSnapshotAutomationRuns.get(store) === run) {
          inFlightSnapshotAutomationRuns.delete(store);
        }
        continue;
      }

      setSnapshotAutomationStatus(automationStatusFromResult(result));
      publishSnapshotAutomationProgress(store, null);

      return result;
    }
  }

  const progressSnapshotAutomationStatus = presentSnapshotAutomationStatus({
    activeProgress: activeAutomationProgress,
    automationStatus: snapshotAutomationStatus,
    hasData,
    latestStoredSnapshot: monthlySummaries[0]?.snapshot ?? null,
    now,
    ppfAccounts: snapshot.ppfAccounts,
    reconstructedSnapshots: ppfExcludedHistory?.snapshots ?? null,
  });

  return {
    allocation,
    cashBalance,
    assetChartData,
    assetChartCustomRange,
    assetChartRange,
    ensureMonthEndSnapshot,
    errors,
    formValues,
    hasData,
    latestSummary,
    monthlyInvestment: monthlyMetrics.invested,
    monthlySummaries,
    portfolioChartData,
    ppfExcludedHistory,
    portfolioChartCustomRange,
    portfolioChartRange,
    portfolioValue,
    preferences: snapshot.preferences,
    saveSnapshot,
    saveSnapshotEdits: saveSnapshot,
    setAssetChartRange,
    setAssetChartCustomRange,
    setField,
    setPortfolioChartRange,
    setPortfolioChartCustomRange,
    snapshotAutomationStatus: progressSnapshotAutomationStatus,
    totalInvested,
  };
}
