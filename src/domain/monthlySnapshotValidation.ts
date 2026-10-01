import { decimal, isWithinQuantum, moneyQuantum } from "./precision";
import type { MonthlySnapshot } from "@/src/types";

export const snapshotMoneyFields = [
  "cashValue", "cryptoValue", "debtValue", "equityValue",
  "investedValue", "monthlyInvestment", "portfolioValue",
] as const;
export type SnapshotValidationErrors = Partial<Record<(typeof snapshotMoneyFields)[number] | "month", string>>;

export function validateMonthlySnapshot(snapshot: MonthlySnapshot): SnapshotValidationErrors {
  const errors: SnapshotValidationErrors = {};
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(snapshot.month)) {
    errors.month = "Use a valid month in YYYY-MM format.";
  }
  for (const field of snapshotMoneyFields) {
    const value = snapshot[field];
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000_000) {
      errors[field] = "Enter an amount within supported financial bounds.";
    } else if (decimal(value).decimalPlaces() > 2) {
      errors[field] = "Use at most two decimal places.";
    }
  }
  if (
    snapshotMoneyFields.every((field) => !errors[field]) &&
    !isWithinQuantum(
      snapshot.portfolioValue,
      decimal(snapshot.cashValue).plus(snapshot.cryptoValue).plus(snapshot.debtValue).plus(snapshot.equityValue),
      moneyQuantum,
    )
  ) {
    errors.portfolioValue = "Portfolio value must equal Equity + Debt + Crypto + Cash.";
  }
  return errors;
}

export function assertValidMonthlySnapshot(snapshot: MonthlySnapshot) {
  const message = Object.values(validateMonthlySnapshot(snapshot))[0];
  if (message) throw new Error(message);
}

// Suggest only; callers must obtain confirmation before saving. A small gap
// is compatible with independent rounding, but is not proof of its cause.
export function suggestGeneratedSnapshotTotal(snapshot: MonthlySnapshot): number | null {
  const errors = validateMonthlySnapshot(snapshot);
  if (snapshot.generated?.source !== "auto" ||
      snapshot.generated.priceEvidence === undefined ||
      Object.keys(errors).length !== 1 || !errors.portfolioValue) return null;
  const total = decimal(snapshot.equityValue).plus(snapshot.debtValue)
    .plus(snapshot.cryptoValue).plus(snapshot.cashValue);
  const gap = total.minus(snapshot.portfolioValue).abs();
  if (gap.greaterThan(0.02)) return null;
  const candidate = { ...snapshot, portfolioValue: total.toNumber() };
  return Object.keys(validateMonthlySnapshot(candidate)).length === 0 ? candidate.portfolioValue : null;
}
