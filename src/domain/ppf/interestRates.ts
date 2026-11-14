import type { PpfInterestRatePeriod } from "@/src/types";

export const ppfInterestRateScheduleVersion = "dea-2026-q3";

// The schedule is deliberately bounded by the latest verified notification.
// A later month has no rate until a newer official period is added: estimates
// stop there and the PPF screen says the rate is not yet notified.
//
// Update it each quarter, after the Department of Economic Affairs notifies the
// next quarter's small-savings rates (normally on the last working day of the
// quarter before): add one period with its notification date and source, and
// bump the version. The release checklist in
// docs/release/android-release-process.md includes this check.
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
  {
    annualRatePct: 7.1,
    effectiveFrom: "2026-10-01",
    effectiveTo: "2026-12-31",
    notificationDate: "2026-09-30",
    sourceLabel: "DEA small-savings rates for Q3 FY 2026-27",
    sourceUrl: "https://dea.gov.in/budget-division/475",
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
