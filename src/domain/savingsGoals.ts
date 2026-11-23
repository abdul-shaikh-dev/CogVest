import { decimal, normalizeMoney, normalizePercentage, sumFinancialValues } from "@/src/domain/precision";
import type { SavingsGoal } from "@/src/types";

/**
 * Savings goals (#767). Pure checks and projections; values come in already
 * valued in INR by the caller, the same way the Dashboard values them.
 */

export const maxSavingsGoals = 20;
export const maxSavingsGoalNameLength = 60;
export const minSavingsGoalReturnPct = 0;
export const maxSavingsGoalReturnPct = 30;
const maxTargetAmountInr = 1_000_000_000_000;
const maxSelectedItems = 500;

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function hasAtMostTwoDecimals(value: number) {
  return decimal(value).decimalPlaces() <= 2;
}

/** Problems with a goal's own fields, as user-facing messages keyed by field. */
export function savingsGoalProblems(goal: SavingsGoal) {
  const problems: Partial<Record<"name" | "targetAmountInr" | "targetDate" | "assumedAnnualReturnPct" | "scope", string>> = {};
  const name = goal.name.trim();
  if (!name || name !== goal.name || name.length > maxSavingsGoalNameLength) {
    problems.name = `Enter a name of up to ${maxSavingsGoalNameLength} characters.`;
  }
  if (!Number.isFinite(goal.targetAmountInr) || goal.targetAmountInr <= 0 ||
    goal.targetAmountInr > maxTargetAmountInr || !hasAtMostTwoDecimals(goal.targetAmountInr)) {
    problems.targetAmountInr = "Enter a target amount above ₹0.";
  }
  if (!isCalendarDate(goal.targetDate)) problems.targetDate = "Choose a target date.";
  if (!Number.isFinite(goal.assumedAnnualReturnPct) ||
    goal.assumedAnnualReturnPct < minSavingsGoalReturnPct ||
    goal.assumedAnnualReturnPct > maxSavingsGoalReturnPct ||
    !hasAtMostTwoDecimals(goal.assumedAnnualReturnPct)) {
    problems.assumedAnnualReturnPct = `Enter a yearly return from ${minSavingsGoalReturnPct}% to ${maxSavingsGoalReturnPct}%.`;
  }
  if (goal.scope.kind === "selected") {
    const { assetIds, epfAccountIds, includeCash, ppfAccountIds } = goal.scope;
    const ids = [...assetIds, ...ppfAccountIds, ...epfAccountIds];
    if (!includeCash && ids.length === 0) problems.scope = "Choose at least one holding or account.";
    else if (ids.length > maxSelectedItems || new Set(assetIds).size !== assetIds.length ||
      new Set(ppfAccountIds).size !== ppfAccountIds.length || new Set(epfAccountIds).size !== epfAccountIds.length ||
      ids.some((id) => typeof id !== "string" || id.length === 0)) {
      problems.scope = "The chosen holdings and accounts are invalid.";
    }
  }
  return problems;
}

/** Problems across all goals: individual fields, duplicate ids and the goal limit. */
export function savingsGoalsProblems(goals: readonly SavingsGoal[]) {
  if (goals.length > maxSavingsGoals) return [`Keep up to ${maxSavingsGoals} goals.`];
  if (new Set(goals.map((goal) => goal.id)).size !== goals.length) return ["Goal IDs must be unique."];
  return goals.some((goal) => Object.keys(savingsGoalProblems(goal)).length > 0) ? ["A goal is invalid."] : [];
}

/** Current INR values the goal can draw on, as the Dashboard values them today. */
export type SavingsGoalValueSources = {
  /** The Dashboard portfolio value; null while any value is pending. */
  portfolioTotalInr: number | null;
  /** Holding values by asset id; null when the price is pending. */
  holdingValuesInr: ReadonlyMap<string, number | null>;
  /** Holdings left out because they are not valued in INR. */
  nonInrAssetIds: ReadonlySet<string>;
  cashBalanceInr: number;
  ppfBalancesInr: ReadonlyMap<string, number>;
  /** EPF balances by account; null when the account's balance is not known. */
  epfBalancesInr: ReadonlyMap<string, number | null>;
};

export type SavingsGoalProgress = {
  /** Current value counted toward the goal; null while any counted value is pending. */
  currentValueInr: number | null;
  /** Share of the target reached, capped at 100; null when the value is pending. */
  reachedPct: number | null;
  /** Whole months left until the target date; 0 once the date is reached. */
  monthsLeft: number;
  /**
   * Estimated monthly investment needed at the assumed return, invested at
   * each month end. 0 when the current value is projected to reach the target.
   * Null when the value is pending or the target date has passed.
   */
  requiredMonthlyInr: number | null;
  /** The current value grown at the assumed return to the target date. */
  projectedValueInr: number | null;
  status: "reached" | "inProgress" | "pastDue" | "pending";
  /** Chosen items that no longer exist (deleted holdings or accounts). */
  missingItemCount: number;
  /** Chosen holdings left out because they are not valued in INR. */
  excludedNonInrCount: number;
};

/** Whole calendar months from one date to a later one (a month counts once its day is reached). */
export function wholeMonthsBetween(from: string, to: string) {
  if (to <= from) return 0;
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.max(0, (toYear - fromYear) * 12 + (toMonth - fromMonth) - (toDay < fromDay ? 1 : 0));
}

function selectedValue(goal: SavingsGoal, sources: SavingsGoalValueSources) {
  if (goal.scope.kind === "portfolio") {
    return { excludedNonInrCount: 0, missingItemCount: 0, value: sources.portfolioTotalInr };
  }
  const values: number[] = [];
  let pending = false;
  let missingItemCount = 0;
  let excludedNonInrCount = 0;
  for (const assetId of goal.scope.assetIds) {
    if (sources.nonInrAssetIds.has(assetId)) {
      excludedNonInrCount += 1;
      continue;
    }
    if (!sources.holdingValuesInr.has(assetId)) {
      missingItemCount += 1;
      continue;
    }
    const value = sources.holdingValuesInr.get(assetId)!;
    if (value === null) pending = true;
    else values.push(value);
  }
  if (goal.scope.includeCash) values.push(sources.cashBalanceInr);
  for (const accountId of goal.scope.ppfAccountIds) {
    const balance = sources.ppfBalancesInr.get(accountId);
    if (balance === undefined) missingItemCount += 1;
    else values.push(balance);
  }
  for (const accountId of goal.scope.epfAccountIds) {
    if (!sources.epfBalancesInr.has(accountId)) {
      missingItemCount += 1;
      continue;
    }
    const balance = sources.epfBalancesInr.get(accountId)!;
    if (balance === null) pending = true;
    else values.push(balance);
  }
  return {
    excludedNonInrCount,
    missingItemCount,
    value: pending ? null : normalizeMoney(sumFinancialValues(values)),
  };
}

/**
 * Progress toward one goal on `today` (YYYY-MM-DD). The monthly amount solves
 * target = value x (1 + m)^n + payment x ((1 + m)^n - 1) / m, where m is the
 * monthly rate equivalent to the assumed yearly return and n the whole months
 * left. Nominal rupees: no inflation adjustment.
 */
export function calculateSavingsGoalProgress(
  goal: SavingsGoal,
  sources: SavingsGoalValueSources,
  today: string,
): SavingsGoalProgress {
  const { excludedNonInrCount, missingItemCount, value } = selectedValue(goal, sources);
  const monthsLeft = wholeMonthsBetween(today, goal.targetDate);
  const base = { excludedNonInrCount, missingItemCount, monthsLeft };
  if (value === null) {
    return { ...base, currentValueInr: null, projectedValueInr: null, reachedPct: null, requiredMonthlyInr: null, status: "pending" };
  }
  const target = decimal(goal.targetAmountInr);
  const ratio = decimal(Math.max(value, 0)).dividedBy(target).times(100);
  const reachedPct = normalizePercentage(ratio.greaterThan(100) ? 100 : ratio);
  if (decimal(value).greaterThanOrEqualTo(target)) {
    return { ...base, currentValueInr: value, projectedValueInr: value, reachedPct: 100, requiredMonthlyInr: 0, status: "reached" };
  }
  if (goal.targetDate <= today || monthsLeft === 0) {
    return { ...base, currentValueInr: value, projectedValueInr: value, reachedPct, requiredMonthlyInr: null, status: "pastDue" };
  }
  // The monthly rate that compounds to the yearly assumption.
  const monthlyRate = Math.pow(1 + goal.assumedAnnualReturnPct / 100, 1 / 12) - 1;
  const growth = decimal(Math.pow(1 + monthlyRate, monthsLeft));
  const projected = decimal(value).times(growth);
  const shortfall = target.minus(projected);
  const required = shortfall.lessThanOrEqualTo(0)
    ? decimal(0)
    : monthlyRate === 0
      ? shortfall.dividedBy(monthsLeft)
      : shortfall.times(monthlyRate).dividedBy(growth.minus(1));
  return {
    ...base,
    currentValueInr: value,
    projectedValueInr: normalizeMoney(projected),
    reachedPct,
    requiredMonthlyInr: normalizeMoney(required),
    status: "inProgress",
  };
}

/** Goals that count at least one of the same holdings or accounts as another goal. */
export function overlappingSavingsGoalIds(goals: readonly SavingsGoal[]) {
  const keys = (goal: SavingsGoal) => goal.scope.kind === "portfolio"
    ? ["portfolio"]
    : [
        ...goal.scope.assetIds.map((id) => `asset:${id}`),
        ...(goal.scope.includeCash ? ["cash"] : []),
        ...goal.scope.ppfAccountIds.map((id) => `ppf:${id}`),
        ...goal.scope.epfAccountIds.map((id) => `epf:${id}`),
      ];
  const owners = new Map<string, Set<string>>();
  for (const goal of goals) {
    for (const key of keys(goal)) {
      const set = owners.get(key) ?? new Set<string>();
      set.add(goal.id);
      owners.set(key, set);
    }
  }
  const overlapping = new Set<string>();
  const portfolioGoals = owners.get("portfolio") ?? new Set<string>();
  // A whole-portfolio goal counts everything another goal counts.
  if (portfolioGoals.size > 0 && goals.length > 1) {
    for (const goal of goals) overlapping.add(goal.id);
    return overlapping;
  }
  for (const set of owners.values()) {
    if (set.size > 1) for (const id of set) overlapping.add(id);
  }
  return overlapping;
}
