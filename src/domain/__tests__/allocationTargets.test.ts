import { allocationTargetProblems, calculateAllocationDrift, type AllocationActual } from "../allocationTargets";

const actual = (values: Record<"equity" | "debt" | "crypto" | "cash", number>): AllocationActual[] => {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return (["equity", "debt", "crypto", "cash"] as const).map((assetClass) => ({
    assetClass, percentage: total > 0 ? (values[assetClass] / total) * 100 : null, value: values[assetClass],
  }));
};

describe("allocation targets (#764)", () => {
  it("accepts targets that add up to exactly 100 with at most one decimal place", () => {
    expect(allocationTargetProblems({ cash: 10, crypto: 5, debt: 25, equity: 60 })).toEqual([]);
    expect(allocationTargetProblems({ cash: 0.1, crypto: 0.2, debt: 33.3, equity: 66.4 })).toEqual([]);
    expect(allocationTargetProblems({ cash: 10, crypto: 5, debt: 25, equity: 59.9 })).toEqual(["Targets must add up to 100%."]);
    expect(allocationTargetProblems({ cash: 0, crypto: 0, debt: 0, equity: 100.05 })).toHaveLength(1);
    expect(allocationTargetProblems({ cash: -10, crypto: 0, debt: 10, equity: 100 })).toHaveLength(1);
    expect(allocationTargetProblems({ cash: Number.NaN, crypto: 0, debt: 0, equity: 100 })).toHaveLength(1);
  });

  it("gives each class's gap in points and the new money that reaches every target without selling", () => {
    const drift = calculateAllocationDrift(
      actual({ cash: 100_000, crypto: 50_000, debt: 150_000, equity: 700_000 }),
      { cash: 10, crypto: 5, debt: 25, equity: 60 },
    );
    expect(drift.status).toBe("available");
    if (drift.status !== "available") return;
    expect(drift.rows.map(({ assetClass, actualPct, gapPts }) => [assetClass, actualPct, gapPts])).toEqual([
      ["equity", 70, 10], ["debt", 15, -10], ["crypto", 5, 0], ["cash", 10, 0],
    ]);
    // Equity is the most over target: the total must grow to 7,00,000 / 60% = 11,66,666.67.
    expect(drift.newMoneyInr).toBe(166_666.67);
    expect(drift.rows.map((row) => row.newMoneyInr)).toEqual([0, 141_666.67, 8_333.33, 16_666.67]);
    expect(drift.newMoneyBlockedBy).toEqual([]);
  });

  it("needs no new money when the mix already matches", () => {
    const drift = calculateAllocationDrift(actual({ cash: 0, crypto: 0, debt: 400, equity: 600 }), { cash: 0, crypto: 0, debt: 40, equity: 60 });
    expect(drift).toMatchObject({ newMoneyInr: 0, status: "available" });
  });

  it("says new money alone cannot reach the targets while a 0% class holds money", () => {
    const drift = calculateAllocationDrift(actual({ cash: 0, crypto: 10, debt: 40, equity: 50 }), { cash: 0, crypto: 0, debt: 50, equity: 50 });
    expect(drift).toMatchObject({ newMoneyBlockedBy: ["crypto"], newMoneyInr: null, status: "available" });
    if (drift.status === "available") expect(drift.rows.every((row) => row.newMoneyInr === 0)).toBe(true);
  });

  it("is unavailable for an incomplete, negative or empty allocation, or invalid targets", () => {
    const targets = { cash: 10, crypto: 0, debt: 30, equity: 60 };
    expect(calculateAllocationDrift([], targets).status).toBe("unavailable");
    expect(calculateAllocationDrift(actual({ cash: -5, crypto: 0, debt: 30, equity: 60 }), targets).status).toBe("unavailable");
    expect(calculateAllocationDrift(actual({ cash: 0, crypto: 0, debt: 0, equity: 0 }), targets).status).toBe("unavailable");
    expect(calculateAllocationDrift(actual({ cash: 1, crypto: 0, debt: 3, equity: 6 }), { ...targets, cash: 11 }).status).toBe("unavailable");
  });
});
