import { useState, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import {
  buildMonthlyProgressChartData,
  calculateAllocation,
  calculateCashBalance,
  calculateHoldings,
  calculateMonthlyProgressSummaries,
  calculatePortfolioTotal,
  getDefaultMonthlyChartRange,
  type MonthlyChartRange,
} from "@/src/domain/calculations";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import type { MonthlySnapshot } from "@/src/types";
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

export function useProgress({
  store = getPortfolioStore(),
}: {
  store?: StoreApi<PortfolioStoreState>;
} = {}) {
  const snapshot = usePortfolioSnapshot(store);
  const [formValues, setFormValues] = useState(emptyProgressFormValues);
  const [errors, setErrors] = useState<ProgressFormErrors>({});
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
    .filter((trade) => trade.type === "buy" && isCurrentMonth(trade.date))
    .reduce((total, trade) => total + trade.totalValue, 0);
  const monthlyOpeningInvestment = snapshot.openingPositions
    .filter((position) => isCurrentMonth(position.date))
    .reduce(
      (total, position) =>
        total + position.quantity * position.averageCostPrice,
      0,
    );
  const monthlyInvestment = monthlyTradeInvestment + monthlyOpeningInvestment;
  const monthlyCashAdded = snapshot.cashEntries
    .filter((entry) => entry.type === "addition" && isCurrentMonth(entry.date))
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

  return {
    allocation,
    cashBalance,
    assetChartData,
    assetChartRange,
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
    savingsRate,
    setAssetChartRange,
    setField,
    setPortfolioChartRange,
    totalInvested,
  };
}
