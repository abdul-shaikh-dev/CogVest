import { useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  buildMonthlyProgressChartData,
  buildGeneratedMonthEndSnapshot,
  calculateAllocation,
  calculateCashBalance,
  calculateHoldings,
  calculateMonthlyProgressSummaries,
  calculatePortfolioTotal,
  getDefaultMonthlyChartRange,
  getPreviousCompletedMonth,
  type GeneratedMonthEndSnapshotResult,
  type GeneratedSnapshotStatus,
  type MonthlyChartRange,
} from "@/src/domain/calculations";
import { resolveHistoricalPrice } from "@/src/services/quotes";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { historicalQuoteCacheKey, type MonthlySnapshot } from "@/src/types";
import { createId } from "@/src/utils";

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function isCurrentMonth(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export function emptyProgressFormValues() {
  const now = new Date();

  return {
    cashValue: "",
    cryptoValue: "",
    debtValue: "",
    equityValue: "",
    investedValue: "",
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    monthlyExpense: "",
    monthlyInvestment: "",
    notes: "",
    portfolioValue: "",
    salary: "",
  };
}

export type ProgressFormValues = ReturnType<typeof emptyProgressFormValues>;
export type ProgressFormErrors = Partial<Record<keyof ProgressFormValues, string>>;

export type ProgressSnapshotAutomationStatus = {
  message: string;
  snapshot: MonthlySnapshot | null;
  status: GeneratedSnapshotStatus | "idle";
  targetMonth: string;
  warnings: string[];
};

type UseProgressInput = {
  historicalPriceFetcher?: typeof resolveHistoricalPrice;
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
};

const requiredNumberFields: Array<keyof ProgressFormValues> = [
  "portfolioValue",
  "investedValue",
  "equityValue",
  "debtValue",
  "cryptoValue",
  "cashValue",
  "monthlyInvestment",
  "salary",
];

function parseNumberField(
  values: ProgressFormValues,
  field: keyof ProgressFormValues,
  errors: ProgressFormErrors,
) {
  const value = values[field].trim();
  const parsedValue = value.length > 0 ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    errors[field] = "Enter a valid amount.";
  }

  return parsedValue;
}

export function validateProgressSnapshotForm(values: ProgressFormValues) {
  const errors: ProgressFormErrors = {};

  if (!/^\d{4}-\d{2}$/.test(values.month.trim())) {
    errors.month = "Use YYYY-MM.";
  }

  const parsedValues = Object.fromEntries(
    requiredNumberFields.map((field) => [
      field,
      parseNumberField(values, field, errors),
    ]),
  ) as Record<(typeof requiredNumberFields)[number], number>;
  const trimmedExpense = values.monthlyExpense.trim();
  const monthlyExpense =
    trimmedExpense.length === 0 ? undefined : Number(trimmedExpense);

  if (
    monthlyExpense !== undefined &&
    (!Number.isFinite(monthlyExpense) || monthlyExpense < 0)
  ) {
    errors.monthlyExpense = "Enter a valid amount.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, snapshot: null };
  }

  return {
    errors,
    snapshot: {
      cashValue: parsedValues.cashValue,
      cryptoValue: parsedValues.cryptoValue,
      debtValue: parsedValues.debtValue,
      equityValue: parsedValues.equityValue,
      id: createId("snapshot"),
      investedValue: parsedValues.investedValue,
      month: values.month.trim(),
      monthlyExpense,
      monthlyInvestment: parsedValues.monthlyInvestment,
      notes: values.notes.trim() || undefined,
      portfolioValue: parsedValues.portfolioValue,
      salary: parsedValues.salary,
    } satisfies MonthlySnapshot,
  };
}

function automationMessage(result: GeneratedMonthEndSnapshotResult) {
  if (result.status === "created") {
    return "Previous month snapshot generated automatically.";
  }

  if (result.status === "already-exists") {
    return "Previous month snapshot is already recorded.";
  }

  return "Not enough portfolio data to generate the previous month snapshot yet.";
}

function getMonthEndDate(targetMonth: string) {
  const [yearValue, monthValue] = targetMonth.split("-");
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;

  return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

function isOnOrBefore(isoDate: string, maxDate: Date) {
  return new Date(isoDate).getTime() <= maxDate.getTime();
}

function needsHistoricalPrice({
  assetId,
  state,
  targetMonth,
}: {
  assetId: string;
  state: PortfolioStoreState;
  targetMonth: string;
}) {
  const cacheKey = historicalQuoteCacheKey(assetId, targetMonth);

  if (state.historicalQuoteCache[cacheKey]) {
    return false;
  }

  const monthEnd = getMonthEndDate(targetMonth);
  const hasOpeningPosition = state.openingPositions.some(
    (position) =>
      position.assetId === assetId && isOnOrBefore(position.date, monthEnd),
  );
  const hasTrade = state.trades.some(
    (trade) => trade.assetId === assetId && isOnOrBefore(trade.date, monthEnd),
  );

  return hasOpeningPosition || hasTrade;
}

export function useProgress({
  historicalPriceFetcher = resolveHistoricalPrice,
  now = new Date(),
  store = getPortfolioStore(),
}: UseProgressInput = {}) {
  const snapshot = usePortfolioSnapshot(store);
  const [formValues, setFormValues] = useState(emptyProgressFormValues);
  const [errors, setErrors] = useState<ProgressFormErrors>({});
  const [snapshotAutomationStatus, setSnapshotAutomationStatus] =
    useState<ProgressSnapshotAutomationStatus>(() => ({
      message: "Month-end snapshot automation has not run yet.",
      snapshot: null,
      status: "idle",
      targetMonth: getPreviousCompletedMonth(now),
      warnings: [],
    }));
  const [portfolioChartRange, setPortfolioChartRange] =
    useState<MonthlyChartRange>(() =>
      getDefaultMonthlyChartRange(snapshot.monthlySnapshots.length),
    );
  const [assetChartRange, setAssetChartRange] = useState<MonthlyChartRange>(() =>
    getDefaultMonthlyChartRange(snapshot.monthlySnapshots.length),
  );
  const holdings = calculateHoldings({
    assets: snapshot.assets,
    openingPositions: snapshot.openingPositions,
    quoteCache: snapshot.quoteCache,
    trades: snapshot.trades,
  });
  const cashBalance = calculateCashBalance(snapshot.cashEntries);
  const portfolioValue = calculatePortfolioTotal(holdings, snapshot.cashEntries);
  const totalInvested = holdings.reduce(
    (total, holding) => total + holding.totalInvested,
    0,
  );
  const monthlyTradeInvestment = snapshot.trades
    .filter((trade) => trade.type === "buy" && isCurrentMonth(trade.date, now))
    .reduce((total, trade) => total + trade.totalValue, 0);
  const monthlyOpeningInvestment = snapshot.openingPositions
    .filter((position) => isCurrentMonth(position.date, now))
    .reduce(
      (total, position) =>
        total + position.quantity * position.averageCostPrice,
      0,
    );
  const monthlyInvestment = monthlyTradeInvestment + monthlyOpeningInvestment;
  const monthlyCashAdded = snapshot.cashEntries
    .filter((entry) => entry.type === "addition" && isCurrentMonth(entry.date, now))
    .reduce((total, entry) => total + entry.amount, 0);
  const savingsRate =
    monthlyCashAdded === 0 ? 0 : (monthlyInvestment / monthlyCashAdded) * 100;
  const allocation = calculateAllocation({ cashBalance, holdings });
  const hasData = holdings.length > 0 || snapshot.cashEntries.length > 0;
  const monthlySummaries = calculateMonthlyProgressSummaries(
    snapshot.monthlySnapshots,
  );
  const latestSummary = monthlySummaries[0];
  const portfolioChartData = buildMonthlyProgressChartData(
    snapshot.monthlySnapshots,
    portfolioChartRange,
  );
  const assetChartData = buildMonthlyProgressChartData(
    snapshot.monthlySnapshots,
    assetChartRange,
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

  function saveSnapshot() {
    const result = validateProgressSnapshotForm(formValues);

    if (!result.snapshot) {
      setErrors(result.errors);
      return;
    }

    const existingSnapshot = snapshot.monthlySnapshots.find(
      (monthlySnapshot) => monthlySnapshot.month === result.snapshot.month,
    );

    if (existingSnapshot) {
      store.getState().updateMonthlySnapshot({
        ...result.snapshot,
        id: existingSnapshot.id,
      });
    } else {
      store.getState().addMonthlySnapshot(result.snapshot);
    }

    setFormValues(emptyProgressFormValues());
    setErrors({});
  }

  async function ensureMonthEndSnapshot() {
    const state = store.getState();
    const targetMonth = getPreviousCompletedMonth(now);
    const existingSnapshot = state.monthlySnapshots.some(
      (monthlySnapshot) => monthlySnapshot.month === targetMonth,
    );
    const lookupWarnings: string[] = [];

    if (!existingSnapshot) {
      const quoteableAssets = state.assets.filter(
        (asset) => asset.assetClass !== "cash" && asset.assetClass !== "debt",
      );

      for (const asset of quoteableAssets) {
        if (!needsHistoricalPrice({ assetId: asset.id, state, targetMonth })) {
          continue;
        }

        const historicalPriceResult = await historicalPriceFetcher({
          asset,
          targetMonth,
        });

        if (historicalPriceResult.ok) {
          store.getState().upsertHistoricalQuote(historicalPriceResult.quote);
        } else {
          lookupWarnings.push(historicalPriceResult.error);
        }
      }
    }

    const refreshedState = store.getState();
    const result = buildGeneratedMonthEndSnapshot({
      assets: refreshedState.assets,
      cashEntries: refreshedState.cashEntries,
      existingSnapshots: refreshedState.monthlySnapshots,
      historicalQuotes: refreshedState.historicalQuoteCache,
      now,
      openingPositions: refreshedState.openingPositions,
      quoteCache: refreshedState.quoteCache,
      trades: refreshedState.trades,
    });
    const statusWarnings = [...result.warnings, ...lookupWarnings];

    if (result.status === "created" && result.snapshot) {
      store.getState().addMonthlySnapshot(result.snapshot);
    }

    setSnapshotAutomationStatus({
      message: automationMessage(result),
      snapshot: result.snapshot,
      status: result.status,
      targetMonth: getPreviousCompletedMonth(now),
      warnings: statusWarnings,
    });

    return {
      ...result,
      warnings: statusWarnings,
    };
  }

  return {
    allocation,
    cashBalance,
    assetChartData,
    assetChartRange,
    ensureMonthEndSnapshot,
    errors,
    formValues,
    hasData,
    latestSummary,
    monthlyCashAdded,
    monthlyInvestment,
    monthlySummaries,
    portfolioChartData,
    portfolioChartRange,
    portfolioValue,
    preferences: snapshot.preferences,
    saveSnapshot,
    saveSnapshotEdits: saveSnapshot,
    savingsRate,
    setAssetChartRange,
    setField,
    setPortfolioChartRange,
    snapshotAutomationStatus,
    totalInvested,
  };
}
