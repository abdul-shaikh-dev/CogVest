import {
  calculateSavingsGoalProgress,
  overlappingSavingsGoalIds,
  savingsGoalProblems,
  savingsGoalsProblems,
  wholeMonthsBetween,
  type SavingsGoalValueSources,
} from "@/src/domain/savingsGoals";
import type { SavingsGoal } from "@/src/types";

const goal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  assumedAnnualReturnPct: 12,
  createdAt: "2026-11-24T00:00:00.000Z",
  id: "goal-house",
  name: "House",
  scope: { kind: "portfolio" },
  targetAmountInr: 1_000_000,
  targetDate: "2031-11-24",
  updatedAt: "2026-11-24T00:00:00.000Z",
  ...overrides,
});

const sources = (overrides: Partial<SavingsGoalValueSources> = {}): SavingsGoalValueSources => ({
  cashBalanceInr: 20_000,
  epfBalancesInr: new Map([["epf-1", 150_000], ["epf-unknown", null]]),
  holdingValuesInr: new Map([["stock", 100_000], ["fund", 50_000], ["pending", null]]),
  nonInrAssetIds: new Set(["usd-stock"]),
  portfolioTotalInr: 400_000,
  ppfBalancesInr: new Map([["ppf-1", 80_000]]),
  ...overrides,
});

const selected = (scope: Partial<Extract<SavingsGoal["scope"], { kind: "selected" }>> = {}): SavingsGoal["scope"] => ({
  assetIds: [], epfAccountIds: [], includeCash: false, kind: "selected", ppfAccountIds: [], ...scope,
});

describe("savings goal checks (#767)", () => {
  it("accepts a complete goal and names each invalid field", () => {
    expect(savingsGoalProblems(goal())).toEqual({});
    expect(Object.keys(savingsGoalProblems(goal({
      assumedAnnualReturnPct: 31, name: " ", scope: selected(), targetAmountInr: 0, targetDate: "2031-02-30",
    }))).sort()).toEqual(["assumedAnnualReturnPct", "name", "scope", "targetAmountInr", "targetDate"]);
    expect(savingsGoalProblems(goal({ assumedAnnualReturnPct: -1 }))).toHaveProperty("assumedAnnualReturnPct");
    expect(savingsGoalProblems(goal({ assumedAnnualReturnPct: 0 }))).toEqual({});
    expect(savingsGoalProblems(goal({ targetAmountInr: 10.005 }))).toHaveProperty("targetAmountInr");
    expect(savingsGoalProblems(goal({ name: "x".repeat(61) }))).toHaveProperty("name");
    expect(savingsGoalProblems(goal({ scope: selected({ assetIds: ["a", "a"] }) }))).toHaveProperty("scope");
    expect(savingsGoalProblems(goal({ scope: selected({ includeCash: true }) }))).toEqual({});
  });

  it("rejects duplicate ids and more than twenty goals", () => {
    expect(savingsGoalsProblems([goal(), goal()])).toEqual(["Goal IDs must be unique."]);
    expect(savingsGoalsProblems(Array.from({ length: 21 }, (_, index) => goal({ id: `goal-${index}` })))).toHaveLength(1);
    expect(savingsGoalsProblems([goal()])).toEqual([]);
  });

  it("counts whole months, a month counting once its day is reached", () => {
    expect(wholeMonthsBetween("2026-11-24", "2026-12-23")).toBe(0);
    expect(wholeMonthsBetween("2026-11-24", "2026-12-24")).toBe(1);
    expect(wholeMonthsBetween("2026-11-24", "2031-11-24")).toBe(60);
    expect(wholeMonthsBetween("2026-11-24", "2026-11-01")).toBe(0);
  });
});

describe("savings goal progress (#767)", () => {
  it("uses the Dashboard total for a whole-portfolio goal and solves the monthly amount", () => {
    const progress = calculateSavingsGoalProgress(goal(), sources(), "2026-11-24");
    expect(progress).toMatchObject({ currentValueInr: 400_000, monthsLeft: 60, reachedPct: 40, status: "inProgress" });
    // 400,000 at 12% a year for five years: 400,000 x 1.12^5.
    expect(progress.projectedValueInr).toBeCloseTo(400_000 * Math.pow(1.12, 5), 1);
    // The payment p with p x ((1+m)^60 - 1) / m = the shortfall, m = 1.12^(1/12) - 1.
    const m = Math.pow(1.12, 1 / 12) - 1;
    const expected = (1_000_000 - 400_000 * Math.pow(1.12, 5)) * m / (Math.pow(1 + m, 60) - 1);
    expect(progress.requiredMonthlyInr).toBeCloseTo(expected, 1);
  });

  it("divides the shortfall evenly at a zero return", () => {
    const progress = calculateSavingsGoalProgress(goal({ assumedAnnualReturnPct: 0 }), sources(), "2026-11-24");
    expect(progress.requiredMonthlyInr).toBe(10_000);
    expect(progress.projectedValueInr).toBe(400_000);
  });

  it("needs nothing more when growth alone reaches the target", () => {
    const progress = calculateSavingsGoalProgress(goal({ targetAmountInr: 600_000 }), sources(), "2026-11-24");
    expect(progress).toMatchObject({ requiredMonthlyInr: 0, status: "inProgress" });
  });

  it("marks a reached goal at 100% and a passed date without a monthly amount", () => {
    expect(calculateSavingsGoalProgress(goal({ targetAmountInr: 300_000 }), sources(), "2026-11-24"))
      .toMatchObject({ reachedPct: 100, requiredMonthlyInr: 0, status: "reached" });
    expect(calculateSavingsGoalProgress(goal({ targetDate: "2026-11-24" }), sources(), "2026-11-24"))
      .toMatchObject({ reachedPct: 40, requiredMonthlyInr: null, status: "pastDue" });
    expect(calculateSavingsGoalProgress(goal({ targetDate: "2026-12-10" }), sources(), "2026-11-24"))
      .toMatchObject({ monthsLeft: 0, requiredMonthlyInr: null, status: "pastDue" });
  });

  it("is pending, never zero, while a counted value is pending", () => {
    expect(calculateSavingsGoalProgress(goal(), sources({ portfolioTotalInr: null }), "2026-11-24"))
      .toMatchObject({ currentValueInr: null, reachedPct: null, requiredMonthlyInr: null, status: "pending" });
    expect(calculateSavingsGoalProgress(goal({ scope: selected({ assetIds: ["pending"] }) }), sources(), "2026-11-24").status)
      .toBe("pending");
    expect(calculateSavingsGoalProgress(goal({ scope: selected({ epfAccountIds: ["epf-unknown"] }) }), sources(), "2026-11-24").status)
      .toBe("pending");
  });

  it("adds chosen holdings, Cash, PPF and EPF, leaving out non-INR and removed items", () => {
    const progress = calculateSavingsGoalProgress(goal({
      scope: selected({
        assetIds: ["stock", "usd-stock", "sold"], epfAccountIds: ["epf-1"], includeCash: true, ppfAccountIds: ["ppf-1", "closed"],
      }),
    }), sources(), "2026-11-24");
    expect(progress).toMatchObject({ currentValueInr: 350_000, excludedNonInrCount: 1, missingItemCount: 2 });
  });
});

describe("overlapping goals (#767)", () => {
  it("flags goals that count the same holding or account", () => {
    const a = goal({ id: "a", scope: selected({ assetIds: ["stock"] }) });
    const b = goal({ id: "b", scope: selected({ assetIds: ["stock", "fund"] }) });
    const c = goal({ id: "c", scope: selected({ includeCash: true }) });
    expect([...overlappingSavingsGoalIds([a, b, c])].sort()).toEqual(["a", "b"]);
    expect([...overlappingSavingsGoalIds([c, goal({ id: "d", scope: selected({ includeCash: true }) })])].sort()).toEqual(["c", "d"]);
  });

  it("treats a whole-portfolio goal as overlapping every other goal", () => {
    const c = goal({ id: "c", scope: selected({ includeCash: true }) });
    expect([...overlappingSavingsGoalIds([goal({ id: "p" }), c])].sort()).toEqual(["c", "p"]);
    expect(overlappingSavingsGoalIds([goal({ id: "p" })]).size).toBe(0);
  });
});
