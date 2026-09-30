import { validateMonthlySnapshot } from "@/src/domain/monthlySnapshotValidation";
import type { MonthlySnapshot } from "@/src/types";
const snapshot: MonthlySnapshot = { id: "snapshot", month: "2026-08", portfolioValue: 0.3, cashValue: 0.1, equityValue: 0.2, debtValue: 0, cryptoValue: 0, investedValue: 0, monthlyInvestment: 0 };
describe("snapshot invariants", () => {
  it("compares decimal totals without floating point drift", () => {
    expect(validateMonthlySnapshot(snapshot)).toEqual({});
    expect(validateMonthlySnapshot({ ...snapshot, portfolioValue: 0.31 }).portfolioValue).toMatch(/must equal/);
  });
  it.each(["2026-00", "2026-13", "2026-1", "2026-01-01"])("rejects non-calendar month %s", (month) => {
    expect(validateMonthlySnapshot({ ...snapshot, month }).month).toBeDefined();
  });
  it("reports precision and supported bounds at their fields", () => {
    expect(validateMonthlySnapshot({ ...snapshot, cashValue: 0.001, investedValue: 1e16 })).toMatchObject({ cashValue: "Use at most two decimal places.", investedValue: expect.any(String) });
  });
  it("preserves signed generated Cash totals without inventing nonnegative balances", () => {
    expect(validateMonthlySnapshot({ ...snapshot, cashValue: -0.1, portfolioValue: 0.1 })).toEqual({});
  });
});
