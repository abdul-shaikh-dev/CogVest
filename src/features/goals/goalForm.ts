import { parseDecimalInput } from "@/src/domain/decimalInput";
import { savingsGoalProblems } from "@/src/domain/savingsGoals";
import type { SavingsGoalInput } from "@/src/store";
import type { SavingsGoal } from "@/src/types";

/** The goal editor's text fields and choices (#767). */
export type GoalDraft = {
  name: string;
  targetAmount: string;
  targetDate: string;
  assumedReturn: string;
  scopeKind: "portfolio" | "selected";
  assetIds: string[];
  includeCash: boolean;
  ppfAccountIds: string[];
  epfAccountIds: string[];
};

export type GoalDraftErrors = Partial<Record<"name" | "targetAmount" | "targetDate" | "assumedReturn" | "scope", string>>;

export function goalDraftFrom(goal: SavingsGoal | undefined): GoalDraft {
  if (!goal) {
    return {
      assetIds: [], assumedReturn: "", epfAccountIds: [], includeCash: false, name: "",
      ppfAccountIds: [], scopeKind: "portfolio", targetAmount: "", targetDate: "",
    };
  }
  const selected = goal.scope.kind === "selected" ? goal.scope : null;
  return {
    assetIds: selected?.assetIds ?? [],
    assumedReturn: String(goal.assumedAnnualReturnPct),
    epfAccountIds: selected?.epfAccountIds ?? [],
    includeCash: selected?.includeCash ?? false,
    name: goal.name,
    ppfAccountIds: selected?.ppfAccountIds ?? [],
    scopeKind: goal.scope.kind,
    targetAmount: String(goal.targetAmountInr),
    targetDate: goal.targetDate,
  };
}

/**
 * Builds the store input, or the errors to show. A new or changed target date
 * must be after today; an unchanged past date stays editable.
 */
export function buildGoalInput(
  draft: GoalDraft,
  { id, savedTargetDate, today }: { id: string; savedTargetDate?: string; today: string },
): { ok: true; input: SavingsGoalInput } | { ok: false; errors: GoalDraftErrors } {
  const input: SavingsGoalInput = {
    assumedAnnualReturnPct: draft.assumedReturn.trim() === "" ? Number.NaN : parseDecimalInput(draft.assumedReturn),
    id,
    name: draft.name.trim(),
    scope: draft.scopeKind === "portfolio"
      ? { kind: "portfolio" }
      : {
          assetIds: draft.assetIds,
          epfAccountIds: draft.epfAccountIds,
          includeCash: draft.includeCash,
          kind: "selected",
          ppfAccountIds: draft.ppfAccountIds,
        },
    targetAmountInr: parseDecimalInput(draft.targetAmount),
    targetDate: draft.targetDate,
  };
  const problems = savingsGoalProblems({ ...input, createdAt: "", updatedAt: "" });
  const errors: GoalDraftErrors = {
    ...(problems.name ? { name: problems.name } : {}),
    ...(problems.targetAmountInr ? { targetAmount: problems.targetAmountInr } : {}),
    ...(problems.targetDate ? { targetDate: problems.targetDate } : {}),
    ...(problems.assumedAnnualReturnPct ? { assumedReturn: problems.assumedAnnualReturnPct } : {}),
    ...(problems.scope ? { scope: problems.scope } : {}),
  };
  if (!errors.targetDate && draft.targetDate !== savedTargetDate && draft.targetDate <= today) {
    errors.targetDate = "Choose a date after today.";
  }
  return Object.keys(errors).length > 0 ? { errors, ok: false } : { input, ok: true };
}

export function toggleId(ids: readonly string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
