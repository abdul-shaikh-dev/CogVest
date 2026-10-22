import type { HoldingReviewItem } from "@/src/features/holdings/holdingsReview";
import {
  formatHoldingWeight,
  formatQuantity,
  formatSignedCompactINR,
  getFilterCounts,
  getFilterLabel,
  getHoldingRowAccessibilityLabel,
  getHoldingRowIdentity,
  getHoldingsSubtitle,
  getQuoteStatus,
  isRawIsin,
} from "@/src/features/holdings/holdingsViewModel";
import type { QuoteFreshnessSummary } from "@/src/services/quotes";
import type { Asset } from "@/src/types";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset",
  instrumentType: "stock",
  name: "Example Industries",
  symbol: "EXAMPLE",
  ticker: "EXAMPLE.NS",
};

function reviewItem({
  allocationPct = 10,
  pnl = 20,
}: { allocationPct?: number; pnl?: number | null } = {}): HoldingReviewItem {
  return {
    allocationPct,
    initialAllocationPct: allocationPct,
    holding: {
      asset,
      averageCostPrice: 100,
      currentPrice: 120,
      currentValue: 1200,
      totalInvested: 1000,
      totalUnits: 10,
      unrealisedPnL: pnl,
      unrealisedPnLPct: pnl === null ? null : pnl / 10,
      valuation: {
        asOf: "2026-08-01T00:00:00.000Z",
        currency: "INR",
        price: 120,
        source: "yahoo",
        status: "fetched",
      },
    },
  };
}

const freshness = (
  overrides: Partial<QuoteFreshnessSummary> = {},
): QuoteFreshnessSummary => ({
  current: 2,
  manual: 0,
  missing: 0,
  stale: 0,
  status: "current",
  total: 2,
  ...overrides,
});

describe("holdings subtitle", () => {
  it("counts market positions and adds PPF and EPF only when present", () => {
    expect(
      getHoldingsSubtitle({ epfAccounts: 0, marketPositions: 1, ppfRecords: 0 }),
    ).toBe("1 market position");
    expect(
      getHoldingsSubtitle({ epfAccounts: 2, marketPositions: 3, ppfRecords: 1 }),
    ).toBe("3 market positions · PPF 1 · EPF 2");
  });
});

describe("quote status", () => {
  it("reports a partial refresh while saved prices remain usable", () => {
    const status = getQuoteStatus({
      failed: 1,
      isRefreshing: false,
      quoteFreshness: freshness({ current: 1, missing: 1 }),
      timedOut: 1,
    });
    expect(status.title).toBe("Refresh partially completed");
    expect(status.detail).toContain("1 failed · 1 timed out");
    expect(status.prominent).toBe(true);
  });

  it("reports a failed refresh when no usable price exists", () => {
    const status = getQuoteStatus({
      failed: 2,
      isRefreshing: false,
      quoteFreshness: freshness({ current: 0, missing: 2 }),
      timedOut: 0,
    });
    expect(status.title).toBe("Quote refresh failed");
    expect(status.detail).toContain("No usable prices are available.");
  });

  it("separates current, saved and missing coverage", () => {
    const base = { failed: 0, isRefreshing: false, timedOut: 0 };
    expect(getQuoteStatus({ ...base, quoteFreshness: freshness() }).title).toBe(
      "Prices up to date",
    );
    expect(
      getQuoteStatus({ ...base, quoteFreshness: freshness({ status: "stale" }) })
        .title,
    ).toBe("Using saved prices");
    expect(
      getQuoteStatus({ ...base, quoteFreshness: freshness({ missing: 1 }) }),
    ).toMatchObject({ prominent: true, title: "Price coverage needs attention" });
    expect(
      getQuoteStatus({ ...base, quoteFreshness: freshness({ status: "empty" }) })
        .title,
    ).toBe("No holdings to price");
    expect(
      getQuoteStatus({ ...base, isRefreshing: true, quoteFreshness: freshness() })
        .title,
    ).toBe("Refreshing quotes...");
  });
});

describe("holding filters", () => {
  it("counts break-even as a winner and hides high allocation without prices", () => {
    const items = [
      reviewItem({ allocationPct: 60, pnl: 0 }),
      reviewItem({ allocationPct: 5, pnl: -10 }),
      reviewItem({ allocationPct: 35, pnl: null }),
    ];
    expect(getFilterCounts(items, true)).toEqual({
      all: 3,
      "high-allocation": 2,
      losers: 1,
      winners: 1,
    });
    expect(getFilterCounts(items, false)["high-allocation"]).toBe(0);
  });

  it("labels filters for display", () => {
    expect(getFilterLabel("high-allocation")).toBe("High allocation");
    expect(getFilterLabel("winners")).toBe("Winners");
  });
});

describe("holding row formatting", () => {
  it("formats quantities, signed amounts and small weights", () => {
    expect(formatQuantity(12)).toBe("12");
    expect(formatQuantity(1.25)).toBe("1.25");
    expect(formatSignedCompactINR(500)).toMatch(/^\+/);
    expect(formatSignedCompactINR(-500)).not.toMatch(/^\+/);
    expect(formatHoldingWeight(0.04)).toBe("<0.1%");
    expect(formatHoldingWeight(12.345)).toBe("12.3%");
  });

  it("hides raw ISIN symbols from the row identity", () => {
    expect(isRawIsin("ine000a01011")).toBe(true);
    expect(isRawIsin("EXAMPLE")).toBe(false);
    expect(getHoldingRowIdentity({ ...asset, symbol: "INE000A01011" })).not.toContain(
      "INE000A01011",
    );
    expect(getHoldingRowIdentity(asset)).toContain("EXAMPLE");
  });

  it("keeps masked values out of the row accessibility label", () => {
    const label = getHoldingRowAccessibilityLabel({
      identity: "EXAMPLE · Stock",
      item: reviewItem(),
      masked: true,
      minimal: false,
      weightAvailable: true,
    });
    expect(label).toContain("Current value hidden");
    expect(label).toContain("Invested value hidden");
    expect(label).not.toMatch(/1,200|1,000/);
    expect(label).toContain("Weight 10.0%");
  });

  it("leaves invested and P and L out in minimal mode", () => {
    const label = getHoldingRowAccessibilityLabel({
      identity: "EXAMPLE · Stock",
      item: reviewItem(),
      masked: false,
      minimal: true,
      weightAvailable: false,
    });
    expect(label).not.toContain("Invested");
    expect(label).not.toContain("P and L");
    expect(label).toContain("Weight unavailable");
  });
});
