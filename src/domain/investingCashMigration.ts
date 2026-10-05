import type { CashEntry, MonthlySnapshot } from "@/src/types";

type LegacyCashEntry = Omit<CashEntry, "purpose"> & {
  purpose?: CashEntry["purpose"] | "income";
};
type LegacySnapshot = MonthlySnapshot & { salary?: number; monthlyExpense?: number };

/** Retire household metadata without rounding or reconstructing financial records. */
export function migrateInvestingCashEntry(entry: LegacyCashEntry): CashEntry {
  if (entry.purpose === "income" && (entry.type !== "addition" || entry.linkedTradeId || entry.linkedFutures || entry.linkedEpf)) {
    throw new Error("Legacy income must be a Cash addition.");
  }
  return {
    ...entry,
    purpose: entry.purpose === "income"
      ? "capitalContribution"
      : entry.purpose ?? (entry.type === "withdrawal" ? "withdrawal" : "legacyUncategorized"),
  };
}

export function migrateInvestingSnapshot(snapshot: LegacySnapshot): MonthlySnapshot {
  const { salary: _salary, monthlyExpense: _expense, ...investingSnapshot } = snapshot;
  return investingSnapshot;
}
