import { MASKED_INR_VALUE } from "@/src/components/common";
import type { SavingsGoalProgress } from "@/src/domain/savingsGoals";
import { formatINR } from "@/src/domain/formatters";
import type { SavingsGoal } from "@/src/types";

/** An estimate in whole rupees: paise would claim more precision than an assumption has. */
export function formatEstimateINR(value: number) {
  return formatINR(Math.round(value)).replace(/\.00$/u, "");
}

/** "40% reached", spelled out so progress never relies on the bar's colour (#767). */
export function reachedText(progress: SavingsGoalProgress) {
  return progress.reachedPct === null ? "Progress unavailable while prices are pending" : `${progress.reachedPct}% reached`;
}

function formatReturn(pct: number) {
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/u, "")}% a year`;
}

/** The goal's next-step line. Monthly amounts are always labelled as estimates. */
export function goalStatusText(goal: SavingsGoal, progress: SavingsGoalProgress, masked: boolean) {
  switch (progress.status) {
    case "pending":
      return "Some counted holdings have no price yet.";
    case "reached":
      return "Target reached.";
    case "pastDue":
      return "Target date has passed.";
    case "inProgress": {
      if (progress.requiredMonthlyInr === 0) {
        return `On track without more investment · estimate at ${formatReturn(goal.assumedAnnualReturnPct)}`;
      }
      const amount = masked ? MASKED_INR_VALUE : formatEstimateINR(Math.ceil(progress.requiredMonthlyInr ?? 0));
      return `About ${amount} a month needed · estimate at ${formatReturn(goal.assumedAnnualReturnPct)}`;
    }
  }
}

export function monthsLeftText(monthsLeft: number) {
  if (monthsLeft <= 0) return "Less than a month left";
  const years = Math.floor(monthsLeft / 12);
  const months = monthsLeft % 12;
  const parts = [
    years ? `${years} ${years === 1 ? "year" : "years"}` : "",
    months ? `${months} ${months === 1 ? "month" : "months"}` : "",
  ].filter(Boolean);
  return `${parts.join(" ")} left`;
}
