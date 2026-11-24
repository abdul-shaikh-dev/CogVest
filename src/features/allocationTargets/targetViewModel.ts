import { MASKED_INR_VALUE } from "@/src/components/common";
import type { AllocationDrift } from "@/src/domain/allocationTargets";
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
function wholeRupees(value: number) {
  return formatINR(Math.ceil(value)).replace(/\.00$/u, "");
}

/** Neutral wording for the new money that would reach the targets without selling. */
export function newMoneySummary(drift: Extract<AllocationDrift, { status: "available" }>, masked: boolean) {
  if (drift.newMoneyInr === null) {
    const labels = drift.newMoneyBlockedBy.map(allocationLabel);
    const blocked = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];
    const plural = drift.newMoneyBlockedBy.length > 1;
    return `${blocked} ${plural ? "hold" : "holds"} money but ${plural ? "have" : "has"} a 0% target, so new money alone cannot match these targets.`;
  }
  if (drift.newMoneyInr < 1) return "Every class is at its target.";
  const amount = masked ? MASKED_INR_VALUE : wholeRupees(drift.newMoneyInr);
  return `About ${amount} of new money would bring every class to its target without selling. By class:`;
}
