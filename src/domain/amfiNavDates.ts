const utcDay = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};

/**
 * Funds that price every calendar day (liquid and overnight funds) have their
 * weekend NAVs published by AMFI in advance: on a Friday, Saturday's and
 * Sunday's, and Monday's before a holiday (#755). Such a NAV, dated up to this
 * many days after the reference date, is still the current NAV.
 */
export const AMFI_NAV_MAX_DAYS_AHEAD = 3;

/** True when an AMFI NAV dated after the reference date is one published ahead. */
export function isAmfiNavPublishedAhead(navDate: string, referenceDate: string) {
  const ahead = utcDay(navDate) - utcDay(referenceDate);
  return ahead > 0 && ahead <= AMFI_NAV_MAX_DAYS_AHEAD;
}
