import {
  formatExcludedHoldingsNote,
  formatPendingPricesLabel,
  formatSignedINR,
  formatUnsignedPercentage,
  getAllocationWidth,
  getDisplayAllocationLabel,
  getMonthlyActivitySummary,
  getQuoteStatus,
} from "@/src/features/dashboard/dashboardViewModel";
import type { QuoteFreshnessSummary } from "@/src/services/quotes";

function freshness(
  overrides: Partial<QuoteFreshnessSummary>,
): QuoteFreshnessSummary {
  return {
    current: 2,
    manual: 0,
    missing: 0,
    stale: 0,
    status: "current",
    total: 2,
    ...overrides,
  };
}

function quoteStatus(
  overrides: Partial<Parameters<typeof getQuoteStatus>[0]> = {},
) {
  return getQuoteStatus({
    hasFutures: false,
    isRefreshing: false,
    quoteFailed: 0,
    quoteFreshness: freshness({}),
    quoteTimedOut: 0,
    ...overrides,
  });
}

describe("dashboard quote status (#717)", () => {
  it("shows a failed quote save prominently", () => {
    const status = quoteStatus({ quoteFailed: 1, refreshError: "Prices were fetched but not saved." });
    expect(status).toMatchObject({ prominent: true, title: "Prices not saved" });
    expect(status.detail).toContain("Prices were fetched but not saved.");
  });
});

describe("dashboard value formatting", () => {
  it("signs gains but not losses or zero", () => {
    expect(formatSignedINR(1500)).toMatch(/^\+/);
    expect(formatSignedINR(0)).not.toMatch(/^\+/);
    expect(formatSignedINR(-1500)).not.toMatch(/^\+/);
  });

  it("drops the plus sign from allocation shares", () => {
    expect(formatUnsignedPercentage(42.5)).toBe("42.50%");
  });

  it("labels the reporting equity class as Equity", () => {
    expect(getDisplayAllocationLabel("equity")).toBe("Equity");
  });
});

describe("dashboard allocation bar width", () => {
  it("shares a positive value against the positive total", () => {
    expect(getAllocationWidth(250, 1000)).toBe("25%");
  });

  it("draws no bar for a liability or an empty total", () => {
    expect(getAllocationWidth(-250, 1000)).toBe("0%");
    expect(getAllocationWidth(250, 0)).toBe("0%");
  });
});

describe("dashboard quote status", () => {
  it("reports current prices quietly", () => {
    expect(quoteStatus()).toMatchObject({
      prominent: false,
      title: "Prices up to date",
    });
  });

  it("puts a refresh in progress ahead of other states", () => {
    expect(quoteStatus({ isRefreshing: true, quoteFailed: 1 }).title).toBe(
      "Refreshing quotes...",
    );
  });

  it("keeps existing prices after a partial refresh", () => {
    const status = quoteStatus({ quoteFailed: 1, quoteTimedOut: 1 });

    expect(status.title).toBe("Refresh partially completed");
    expect(status.detail).toContain("1 failed · 1 timed out");
    expect(status.detail).toContain("Existing prices remain available.");
    expect(status.prominent).toBe(false);
  });

  it("flags a failed refresh with no usable prices", () => {
    const status = quoteStatus({
      quoteFailed: 2,
      quoteFreshness: freshness({ current: 0, missing: 2, status: "missing" }),
    });

    expect(status.title).toBe("Quote refresh failed");
    expect(status.prominent).toBe(true);
  });

  it("separates Futures review when no spot prices are needed", () => {
    const empty = freshness({ current: 0, status: "empty", total: 0 });

    expect(quoteStatus({ quoteFreshness: empty }).title).toBe(
      "No market prices needed",
    );
    expect(
      quoteStatus({ hasFutures: true, quoteFreshness: empty }).title,
    ).toBe("No spot prices needed");
  });

  it("names older and manual prices", () => {
    expect(
      quoteStatus({
        quoteFreshness: freshness({ manual: 1, stale: 1, status: "stale" }),
      }).title,
    ).toBe("Using older and manual prices");
    expect(
      quoteStatus({
        quoteFreshness: freshness({ manual: 1, status: "manual" }),
      }).title,
    ).toBe("Using manual prices");
  });

  it("flags missing prices as needing attention", () => {
    expect(
      quoteStatus({ quoteFreshness: freshness({ missing: 1, status: "missing" }) }),
    ).toMatchObject({ prominent: true, title: "Price coverage needs attention" });
  });
});

describe("Dashboard glance text (#782)", () => {
  it("names one excluded holding with what was invested", () => {
    expect(formatExcludedHoldingsNote([{ invested: 20000, name: "Tata Motors" }], false))
      .toBe("Of priced holdings · excludes Tata Motors (₹20K invested)");
  });

  it("counts several excluded holdings and adds their invested amounts", () => {
    expect(formatExcludedHoldingsNote([
      { invested: 100000, name: "A" }, { invested: 15000, name: "B" }, { invested: 5000, name: "C" },
    ], false)).toBe("Of priced holdings · excludes 3 holdings (₹1.2L invested)");
  });

  it("leaves the invested amount out while values are masked", () => {
    expect(formatExcludedHoldingsNote([{ invested: 20000, name: "Tata Motors" }], true))
      .toBe("Of priced holdings · excludes Tata Motors");
  });

  it("counts holdings that need a price", () => {
    expect(formatPendingPricesLabel(1)).toBe("1 holding needs a price");
    expect(formatPendingPricesLabel(3)).toBe("3 holdings need a price");
  });

  it("summarises the month, with a sign on the Cash change", () => {
    expect(getMonthlyActivitySummary({ cashChange: 0, investment: 0 })).toEqual({ cash: null, invested: null });
    expect(getMonthlyActivitySummary({ cashChange: -5000, investment: 25000 })).toEqual({ cash: "-₹5K", invested: "₹25K" });
    expect(getMonthlyActivitySummary({ cashChange: 10000, investment: 0 })).toEqual({ cash: "+₹10K", invested: null });
  });
});
