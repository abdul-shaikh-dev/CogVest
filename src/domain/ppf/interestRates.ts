import type { PpfInterestRatePeriod } from "@/src/types";

export const ppfInterestRateScheduleVersion = "dea-2026-q2";

// The schedule is deliberately bounded by the latest verified notification.
// A later month must remain unavailable until a newer official period is added.
export const ppfInterestRateSchedule: readonly PpfInterestRatePeriod[] = [
  {
    annualRatePct: 7.1,
    effectiveFrom: "2020-04-01",
    effectiveTo: "2026-09-30",
    notificationDate: "2026-06-30",
    sourceLabel: "DEA small-savings rates through Q2 FY 2026-27",
    sourceUrl:
      "https://dea.gov.in/budget-division/revision-interest-rates-small-savings-schemes-reg",
  },
];

export function findPpfInterestRate(
  date: string,
  schedule: readonly PpfInterestRatePeriod[] = ppfInterestRateSchedule,
) {
  return schedule.find(
    (period) => date >= period.effectiveFrom && date <= period.effectiveTo,
  );
}
