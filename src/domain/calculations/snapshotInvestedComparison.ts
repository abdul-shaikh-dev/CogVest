import { validateMonthlySnapshot } from "@/src/domain/monthlySnapshotValidation";
import { decimal, normalizeMoney, normalizePercentage } from "@/src/domain/precision";
import type { MonthlySnapshot } from "@/src/types";

// Compare the same month's non-cash value with its recorded remaining basis.
// This excludes disposed holdings and is not a cash-flow-adjusted return.
export function calculateSnapshotInvestedComparison(snapshot: MonthlySnapshot) {
  if (Object.keys(validateMonthlySnapshot(snapshot)).length || snapshot.investedValue <= 0) {
    return null;
  }
  const investmentValue = decimal(snapshot.portfolioValue).minus(snapshot.cashValue);
  if (investmentValue.isNegative()) return null;
  const difference = investmentValue.minus(snapshot.investedValue);
  return {
    investmentValue: normalizeMoney(investmentValue),
    investedValue: snapshot.investedValue,
    difference: normalizeMoney(difference),
    percentage: normalizePercentage(difference.dividedBy(snapshot.investedValue).times(100)),
  };
}
