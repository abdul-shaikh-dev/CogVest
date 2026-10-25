import {
  formatSignedINR,
  formatUnsignedPercentage,
  getAllocationWidth,
  getDisplayAllocationLabel,
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
