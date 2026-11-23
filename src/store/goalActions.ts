import { maxSavingsGoals, savingsGoalProblems } from "@/src/domain/savingsGoals";
import type { SavingsGoal } from "@/src/types";

import type { StoreContext } from "./storeContext";
import type { PortfolioStoreState, SavingsGoalInput } from "./storeTypes";
import { persistPortfolioTransition } from "./persistence";

type GoalActions = Pick<PortfolioStoreState, "saveSavingsGoal" | "deleteSavingsGoal">;

/** Savings goals (#767) are declarations: saving one never changes another record. */
export function createGoalActions({ get, now, set, storage }: StoreContext): GoalActions {
  return {
    saveSavingsGoal: (input: SavingsGoalInput) => {
      const state = get();
      const existing = state.savingsGoals.find((goal) => goal.id === input.id);
      if (!existing && state.savingsGoals.length >= maxSavingsGoals) {
        return { reason: "limit", status: "rejected" };
      }
      const timestamp = now().toISOString();
      const goal: SavingsGoal = {
        assumedAnnualReturnPct: input.assumedAnnualReturnPct,
        createdAt: existing?.createdAt ?? timestamp,
        id: input.id,
        name: input.name.trim(),
        scope: input.scope.kind === "portfolio"
          ? { kind: "portfolio" }
          : {
              assetIds: [...new Set(input.scope.assetIds)],
              epfAccountIds: [...new Set(input.scope.epfAccountIds)],
              includeCash: input.scope.includeCash,
              kind: "selected",
              ppfAccountIds: [...new Set(input.scope.ppfAccountIds)],
            },
        targetAmountInr: input.targetAmountInr,
        targetDate: input.targetDate,
        updatedAt: timestamp,
      };
      const problems = savingsGoalProblems(goal);
      if (Object.keys(problems).length > 0) return { problems, reason: "invalidEntry", status: "rejected" };
      const savingsGoals = existing
        ? state.savingsGoals.map((item) => (item.id === goal.id ? goal : item))
        : [...state.savingsGoals, goal];
      persistPortfolioTransition(storage, state, { savingsGoals });
      set({ savingsGoals });
      return { goal, status: "applied" };
    },
    deleteSavingsGoal: (goalId: string) => {
      const state = get();
      if (!state.savingsGoals.some((goal) => goal.id === goalId)) return { reason: "notFound", status: "rejected" };
      const savingsGoals = state.savingsGoals.filter((goal) => goal.id !== goalId);
      persistPortfolioTransition(storage, state, { savingsGoals });
      set({ savingsGoals });
      return { status: "applied" };
    },
  };
}
