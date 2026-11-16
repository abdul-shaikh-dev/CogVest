import type { MonthlyProgressSummary } from "@/src/domain/calculations";

import { historyYears, previousCalendarMonth, yearOverview } from "../monthlyHistoryViewModel";

const summary = (month: string, portfolioValue: number) =>
  ({ snapshot: { month, portfolioValue } }) as MonthlyProgressSummary;

describe("monthly history view model (#666)", () => {
  const summaries = [summary("2025-12", 50), summary("2026-01", 100), summary("2026-02", 25)];

  it("lists years and one year's months newest first", () => {
    expect(historyYears(summaries)).toEqual(["2026", "2025"]);
    expect(yearOverview(summaries, "2026", false).months.map((item) => item.snapshot.month))
      .toEqual(["2026-02", "2026-01"]);
    expect(previousCalendarMonth("2026-01")).toBe("2025-12");
  });

  it("scales bars to the year's largest month and hides them when masked or negative", () => {
    const overview = yearOverview(summaries, "2026", false);
    expect(overview.showValueBars).toBe(true);
    expect(overview.barWidth(25)).toBe("25%");
    expect(yearOverview(summaries, "2026", true).showValueBars).toBe(false);
    expect(yearOverview([summary("2026-01", -5), summary("2026-02", 10)], "2026", false).showValueBars).toBe(false);
  });
});
