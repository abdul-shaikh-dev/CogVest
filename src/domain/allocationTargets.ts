import type { AllocationTargets } from "@/src/types";

import type { ReportingAllocationClass } from "./calculations/reportingAllocation";
import { decimal, normalizeMoney, normalizePercentage, sumFinancialValues } from "./precision";

/** The Dashboard's four allocation classes, in display order (#764). */
export const allocationTargetClasses = ["equity", "debt", "crypto", "cash"] as const satisfies readonly ReportingAllocationClass[];

/**
 * Problems with a set of targets: each is 0–100 with at most one decimal
 * place, and together they make exactly 100.
 */
export function allocationTargetProblems(targets: AllocationTargets): string[] {
  const problems: string[] = [];
  for (const assetClass of allocationTargetClasses) {
    const value = targets[assetClass];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100 ||
        !decimal(value).times(10).isInteger()) {
      problems.push(`${assetClass}: use 0 to 100, with at most one decimal place.`);
    }
  }
  if (problems.length === 0 && !sumFinancialValues(allocationTargetClasses.map((key) => targets[key])).equals(100)) {
    problems.push("Targets must add up to 100%.");
  }
  return problems;
}

export type AllocationActual = { assetClass: ReportingAllocationClass; value: number; percentage: number | null };

export type AllocationDriftRow = {
  assetClass: ReportingAllocationClass;
  actualPct: number;
  targetPct: number;
  /** Actual minus target, in percentage points. */
  gapPts: number;
  /** New money this class would take to reach its target without selling. */
  newMoneyInr: number;
};

export type AllocationDrift =
  | {
      status: "available";
      rows: AllocationDriftRow[];
      /** Total new money that brings every class to its target without selling; null when that cannot be done. */
      newMoneyInr: number | null;
      /** Why new money alone cannot reach the targets. */
      newMoneyBlockedBy: ReportingAllocationClass[];
    }
  | { status: "unavailable" };

/**
 * Target against actual for the full Dashboard allocation (#764). Drift needs
 * every class valued and none negative, so callers pass only a complete
 * allocation. New money alone cannot reach the targets while a class with a
 * 0% target still holds money.
 */
export function calculateAllocationDrift(
  allocation: readonly AllocationActual[],
  targets: AllocationTargets,
): AllocationDrift {
  if (allocationTargetProblems(targets).length > 0) return { status: "unavailable" };
  const byClass = new Map(allocation.map((item) => [item.assetClass, item]));
  const items = allocationTargetClasses.map((assetClass) => byClass.get(assetClass));
  if (items.some((item) => !item || item.percentage === null || !Number.isFinite(item.value) || item.value < 0)) {
    return { status: "unavailable" };
  }
  const values = items.map((item) => decimal(item!.value));
  const total = sumFinancialValues(values);
  if (!total.greaterThan(0)) return { status: "unavailable" };

  const blocked = allocationTargetClasses.filter((assetClass, index) => targets[assetClass] === 0 && values[index].greaterThan(0));
  // The smallest total at which no class is above its target.
  const neededTotal = blocked.length ? null : allocationTargetClasses.reduce((largest, assetClass, index) => {
    const share = decimal(targets[assetClass]).dividedBy(100);
    if (share.isZero()) return largest;
    const required = values[index].dividedBy(share);
    return required.greaterThan(largest) ? required : largest;
  }, total);

  const rows = allocationTargetClasses.map((assetClass, index) => {
    const actualPct = normalizePercentage(values[index].dividedBy(total).times(100));
    const targetPct = targets[assetClass];
    const toAdd = neededTotal === null ? decimal(0)
      : neededTotal.times(targetPct).dividedBy(100).minus(values[index]);
    return {
      actualPct,
      assetClass,
      gapPts: normalizePercentage(decimal(actualPct).minus(targetPct)),
      newMoneyInr: toAdd.greaterThan(0) ? normalizeMoney(toAdd) : 0,
      targetPct,
    };
  });
  return {
    newMoneyBlockedBy: blocked,
    newMoneyInr: neededTotal === null ? null : normalizeMoney(neededTotal.minus(total)),
    rows,
    status: "available",
  };
}
