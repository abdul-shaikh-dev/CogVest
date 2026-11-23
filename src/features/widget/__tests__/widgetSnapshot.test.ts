import type { Holding, Quote } from "@/src/types";

import { buildWidgetSnapshot, formatWhen, isWidgetHidden, type WidgetDashboard } from "../widgetSnapshot";

const now = new Date(2026, 10, 23, 16, 5);
const shown = { appLockEnabled: false, maskWealthValues: false, showWidgetValue: true };
const holding = { asset: { id: "asset-a" } } as Holding;
const quote = (fetchedAt: string): Quote => ({
  asOf: fetchedAt, assetId: "asset-a", currency: "INR", fetchedAt, price: 10, source: "yahoo",
});

function dashboard(overrides: Partial<WidgetDashboard> = {}): WidgetDashboard {
  return {
    dayChange: { absolute: 2100, percentage: 0.15 },
    hasPortfolioRecords: true,
    holdings: [holding],
    quoteFreshness: { current: 1, manual: 0, missing: 0, stale: 0, status: "current", total: 1 },
    totalValue: 1_390_000,
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildWidgetSnapshot>[0]> = {}) {
  return buildWidgetSnapshot({
    dashboard: dashboard(),
    hasCompleteValuation: true,
    now,
    privacy: shown,
    quoteCache: { "asset-a": quote(new Date(2026, 10, 23, 15, 40).toISOString()) },
    ...overrides,
  });
}

describe("home-screen widget snapshot (#786)", () => {
  it("is hidden until the user opts in, and while masking or App lock is on", () => {
    expect(isWidgetHidden({ ...shown, showWidgetValue: false })).toBe(true);
    expect(isWidgetHidden({ ...shown, maskWealthValues: true })).toBe(true);
    expect(isWidgetHidden({ ...shown, appLockEnabled: true })).toBe(true);
    expect(isWidgetHidden(shown)).toBe(false);
    expect(build({ privacy: { ...shown, appLockEnabled: true } })).toEqual({ kind: "hidden" });
  });

  it("shows the Dashboard hero's compact value, its saved-quote day change and the price time", () => {
    expect(build()).toEqual({
      change: "+₹2.1K (+0.15%) at saved quotes",
      kind: "value",
      updated: "Prices today, 3:40 pm",
      value: "₹13.9L",
    });
  });

  it("drops the change when the Dashboard would not show it", () => {
    expect(build({ hasCompleteValuation: false })).toMatchObject({ change: null, kind: "value" });
  });

  it("says so when older or missing prices are in use", () => {
    const stale = dashboard({ quoteFreshness: { current: 0, manual: 0, missing: 0, stale: 1, status: "stale", total: 1 } });
    expect(build({ dashboard: stale })).toMatchObject({ updated: "Prices today, 3:40 pm · older prices in use" });
  });

  it("is honest when there is nothing to value yet", () => {
    expect(build({ dashboard: dashboard({ hasPortfolioRecords: false }) })).toEqual({ kind: "empty" });
    expect(build({ dashboard: dashboard({ totalValue: null }) })).toEqual({ kind: "pending", updated: "Prices today, 3:40 pm" });
    expect(build({ quoteCache: {} })).toMatchObject({ updated: "No market prices in use" });
  });

  it("names the day for prices fetched earlier", () => {
    expect(formatWhen(new Date(2026, 10, 22, 9, 15), now)).toBe("22 Nov, 9:15 am");
    expect(formatWhen(new Date(2026, 10, 23, 0, 5), now)).toBe("today, 12:05 am");
    expect(formatWhen(new Date(2026, 10, 23, 12, 0), now)).toBe("today, 12:00 pm");
  });
});
