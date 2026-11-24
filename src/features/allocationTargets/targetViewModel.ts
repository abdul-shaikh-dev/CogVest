import type { AllocationDrift, AllocationDriftRow } from "@/src/domain/allocationTargets";
import type { ReportingAllocationClass } from "@/src/domain/calculations/reportingAllocation";
import { formatINR } from "@/src/domain/formatters";

const names: Record<ReportingAllocationClass, string> = { cash: "Cash", crypto: "Crypto", debt: "Debt", equity: "Equity" };

export function allocationLabel(assetClass: ReportingAllocationClass) {
  return names[assetClass];
}

/** The gap in words, so it never relies on colour (#764). */
export function gapText(gapPts: number) {
  if (gapPts === 0) return "on target";
  const size = Math.abs(gapPts);
  return `${size} ${size === 1 ? "point" : "points"} ${gapPts > 0 ? "above" : "below"}`;
}

/** Whole rupees: the amount is a guide, not an order. */
export function wholeRupees(value: number) {
  return formatINR(Math.ceil(value)).replace(/\.00$/u, "");
}

/** What a screen reader says for one class row. */
export function rowAccessibilityLabel(row: AllocationDriftRow) {
  return `${allocationLabel(row.assetClass)}, ${row.actualPct}% now, target ${row.targetPct}%, ${gapText(row.gapPts)}`;
}

/** The line under the new-money amount, or in its place when there is none (#764). */
export function newMoneyNote(drift: Extract<AllocationDrift, { status: "available" }>) {
  if (drift.newMoneyInr === null) {
    const labels = drift.newMoneyBlockedBy.map(allocationLabel);
    const blocked = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];
    const plural = drift.newMoneyBlockedBy.length > 1;
    return `${blocked} ${plural ? "hold" : "holds"} money but ${plural ? "have" : "has"} a 0% target, so new money alone cannot match these targets.`;
  }
  if (drift.newMoneyInr < 1) return "Every class is at its target.";
  return "An estimate, without selling. By class:";
}
