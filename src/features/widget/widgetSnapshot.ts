import type { WidgetSnapshot } from "@/modules/cogvest-widget";
import { formatCompactINR, formatDayMonthYear, formatPercentage } from "@/src/domain/formatters";
import type { Quote } from "@/src/types";

import { formatSignedCompactINR } from "../dashboard/dashboardViewModel";
import type { DashboardState } from "../dashboard/useDashboard";

export type WidgetPrivacy = {
  appLockEnabled: boolean;
  maskWealthValues: boolean;
  /** The Settings opt-in, off by default. */
  showWidgetValue: boolean;
};

/**
 * The widget shows a value only after the user opts in, and never while
 * masking or App lock is on (#786).
 */
export function isWidgetHidden({ appLockEnabled, maskWealthValues, showWidgetValue }: WidgetPrivacy) {
  return !showWidgetValue || appLockEnabled || maskWealthValues;
}

export type WidgetDashboard = Pick<
  DashboardState,
  "dayChange" | "hasPortfolioRecords" | "holdings" | "quoteFreshness" | "totalValue"
>;

/**
 * The widget's text, built from the Dashboard's own state and formatters so
 * it can never show a value computed differently (#786):
 * - the value is the hero's compact total;
 * - the change is the hero's day change at saved quotes, shown only when the
 *   Dashboard shows it;
 * - the time is when the newest price in use was fetched, with a note when
 *   older or missing prices are in use.
 */
export function buildWidgetSnapshot({
  dashboard,
  hasCompleteValuation,
  now,
  privacy,
  quoteCache,
}: {
  dashboard: WidgetDashboard;
  hasCompleteValuation: boolean;
  now: Date;
  privacy: WidgetPrivacy;
  quoteCache: Record<string, Quote | undefined>;
}): WidgetSnapshot {
  if (isWidgetHidden(privacy)) return { kind: "hidden" };
  if (!dashboard.hasPortfolioRecords) return { kind: "empty" };

  const updated = describePrices(dashboard, quoteCache, now);
  if (dashboard.totalValue === null) return { kind: "pending", updated };

  const showChange = hasCompleteValuation && dashboard.quoteFreshness.total > 0;
  return {
    change: showChange
      ? `${formatSignedCompactINR(dashboard.dayChange.absolute)} (${formatPercentage(dashboard.dayChange.percentage)}) at saved quotes`
      : null,
    kind: "value",
    updated,
    value: formatCompactINR(dashboard.totalValue),
  };
}

function describePrices(dashboard: WidgetDashboard, quoteCache: Record<string, Quote | undefined>, now: Date) {
  const fetched = dashboard.holdings
    .map((holding) => quoteCache[holding.asset.id])
    .map((quote) => (quote ? Date.parse(quote.fetchedAt ?? quote.asOf) : Number.NaN))
    .filter((time) => Number.isFinite(time));
  const base = fetched.length > 0
    ? `Prices ${formatWhen(new Date(Math.max(...fetched)), now)}`
    : "No market prices in use";
  const { missing, stale } = dashboard.quoteFreshness;
  return stale > 0 || missing > 0 ? `${base} · older prices in use` : base;
}

/** "today, 4:05 pm" or "22 Nov, 9:15 am", in the phone's local time. */
export function formatWhen(time: Date, now: Date) {
  const hours = time.getHours();
  const clock = `${hours % 12 === 0 ? 12 : hours % 12}:${String(time.getMinutes()).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
  const sameDay = time.getFullYear() === now.getFullYear()
    && time.getMonth() === now.getMonth()
    && time.getDate() === now.getDate();
  if (sameDay) return `today, ${clock}`;
  // "22 Nov 2026" without the year.
  const day = formatDayMonthYear(time, { padDay: false }).replace(/ \d{4}$/, "");
  return `${day}, ${clock}`;
}
