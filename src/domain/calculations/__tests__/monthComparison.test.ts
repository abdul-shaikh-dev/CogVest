import { percentageChange, snapshotAssetClassValues } from "@/src/domain/calculations";
import type { MonthlySnapshot } from "@/src/types";

function snapshot(month: string, values: Partial<MonthlySnapshot>): MonthlySnapshot {
  return {
    cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: 0, id: month, investedValue: 0,
    month, monthlyInvestment: 0, portfolioValue: 0, ...values,
  } as MonthlySnapshot;
}

describe("month comparison (#666)", () => {
  it("measures change against the size of the previous value", () => {
    expect(percentageChange(110, 100)).toBe(10);
    expect(percentageChange(-50, -100)).toBe(50);
    expect(percentageChange(0.3, 0.1)).toBe(200);
  });

  it("has no percentage without a non-zero previous value", () => {
    expect(percentageChange(100, undefined)).toBeNull();
    expect(percentageChange(100, 0)).toBeNull();
  });

  it("pairs each asset class with the previous month's value", () => {
    const current = snapshot("2026-03", { cashValue: 4, cryptoValue: 3, debtValue: 2, equityValue: 1 });
    const previous = snapshot("2026-02", { cashValue: 40, cryptoValue: 30, debtValue: 20, equityValue: 10 });

    expect(snapshotAssetClassValues(current, previous)).toEqual([
      { assetClass: "stock", current: 1, previous: 10 },
      { assetClass: "debt", current: 2, previous: 20 },
      { assetClass: "crypto", current: 3, previous: 30 },
      { assetClass: "cash", current: 4, previous: 40 },
    ]);
    expect(snapshotAssetClassValues(current, undefined).map((value) => value.previous))
      .toEqual([undefined, undefined, undefined, undefined]);
  });
});
