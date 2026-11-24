import { allocationTargetClasses } from "@/src/domain/allocationTargets";
import { parseDecimalInput } from "@/src/domain/decimalInput";
import { decimal, normalizePercentage, sumFinancialValues } from "@/src/domain/precision";
import type { AllocationTargets } from "@/src/types";

export type TargetClass = (typeof allocationTargetClasses)[number];
export type TargetDraft = Record<TargetClass, string>;
export type TargetDraftErrors = Partial<Record<TargetClass | "total", string>>;

export function targetDraftFrom(targets: AllocationTargets | undefined): TargetDraft {
  return {
    cash: targets ? String(targets.cash) : "",
    crypto: targets ? String(targets.crypto) : "",
    debt: targets ? String(targets.debt) : "",
    equity: targets ? String(targets.equity) : "",
  };
}

/** An empty field counts as 0%, so a mix without Crypto needs no typing. */
function parseTarget(text: string) {
  return text.trim() === "" ? 0 : parseDecimalInput(text);
}

/** The running total of the fields that parse, for the "left to assign" line. */
export function targetDraftTotal(draft: TargetDraft): number | null {
  const values = allocationTargetClasses.map((key) => parseTarget(draft[key]));
  return values.every(Number.isFinite) ? normalizePercentage(sumFinancialValues(values)) : null;
}

export function targetTotalText(total: number | null) {
  if (total === null) return "Enter numbers only.";
  if (total === 100) return "Total 100%";
  const gap = normalizePercentage(decimal(100).minus(total));
  return gap > 0 ? `Total ${total}% · ${gap}% left to assign` : `Total ${total}% · ${-gap}% over 100%`;
}

/** Builds targets the store will accept, or the errors to show (#764). */
export function buildAllocationTargets(
  draft: TargetDraft,
): { ok: true; targets: AllocationTargets } | { ok: false; errors: TargetDraftErrors } {
  const errors: TargetDraftErrors = {};
  const targets = {} as AllocationTargets;
  for (const key of allocationTargetClasses) {
    const value = parseTarget(draft[key]);
    if (!Number.isFinite(value) || value > 100 || !decimal(value).times(10).isInteger()) {
      errors[key] = "Use 0 to 100, with at most one decimal place.";
    } else {
      targets[key] = value;
    }
  }
  if (Object.keys(errors).length) return { errors, ok: false };
  const total = targetDraftTotal(draft);
  if (total !== 100) return { errors: { total: "Make the targets add up to 100% to save them." }, ok: false };
  return { ok: true, targets };
}
