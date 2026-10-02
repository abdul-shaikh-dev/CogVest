import { calculateSnapshotInvestedComparison } from "../snapshotInvestedComparison";
import type { MonthlySnapshot } from "@/src/types";

const snapshot: MonthlySnapshot = {
  id: "month", month: "2026-01", equityValue: 100000, debtValue: 0,
  cryptoValue: 0, cashValue: 50000, portfolioValue: 150000,
  investedValue: 100000, monthlyInvestment: 0,
};

describe("historical invested comparison", () => {
  it("excludes unused cash instead of reporting a false 50% gain", () => {
    expect(calculateSnapshotInvestedComparison(snapshot)).toEqual({
      investmentValue: 100000, investedValue: 100000, difference: 0, percentage: 0,
    });
  });

  it.each([0, 25000, -1000])("is unchanged by cash deposits or withdrawals: %s", (cashValue) => {
    expect(calculateSnapshotInvestedComparison({ ...snapshot, cashValue, portfolioValue: 100000 + cashValue })?.percentage).toBe(0);
  });

  it.each([
    [120000, 20000, 20], [80000, -20000, -20], [0, -100000, -100],
  ])("compares value %s with its own recorded basis", (value, difference, percentage) => {
    expect(calculateSnapshotInvestedComparison({ ...snapshot, equityValue: value, portfolioValue: value + snapshot.cashValue })).toMatchObject({ difference, percentage });
  });

  it.each([0, -1, NaN, Infinity, undefined])("withholds invalid/nonpositive basis %s", (investedValue) => {
    expect(calculateSnapshotInvestedComparison({ ...snapshot, investedValue: investedValue as number })).toBeNull();
  });

  it.each([
    { cashValue: NaN }, { portfolioValue: Infinity }, { equityValue: undefined },
    { portfolioValue: 160000 }, { equityValue: -100, portfolioValue: 49900 },
  ])("rejects inconsistent or invalid values: %j", (values) => {
    expect(calculateSnapshotInvestedComparison({ ...snapshot, ...values } as MonthlySnapshot)).toBeNull();
  });

  it("uses decimal money/percentage rounding and does not mutate the record", () => {
    const record = Object.freeze({ ...snapshot, cashValue: 0.1, equityValue: 0.2, portfolioValue: 0.3, investedValue: 0.15 });
    expect(calculateSnapshotInvestedComparison(record)).toEqual({
      investmentValue: 0.2, investedValue: 0.15, difference: 0.05, percentage: 33.33,
    });
  });
});
