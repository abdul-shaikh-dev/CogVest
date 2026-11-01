import { summariseXirr } from "@/src/domain/xirrSummary";
import { assetXirrSummary } from "@/src/features/holdings/assetXirr";
import type { Asset, BuyTrade, Quote } from "@/src/types";

const stock: Asset = { id: "stock", name: "Synthetic Bank", symbol: "SYN", ticker: "SYN.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };
const buy: BuyTrade = { id: "buy", assetId: "stock", type: "buy", date: "2025-01-01", quantity: 100, pricePerUnit: 100, totalValue: 10000 };
const quote = (price: number, asOf = "2026-01-01T10:00:00Z"): Quote =>
  ({ assetId: "stock", price, currency: "INR", asOf, source: "yahoo" } as Quote);
const state = (overrides = {}) => ({
  assets: [stock], trades: [buy], openingPositions: [], distributions: [],
  distributionCoverage: [{ assetId: "stock", from: "2025-01-01", confirmedAt: "x" }],
  quoteCache: { stock: quote(110) }, ...overrides,
});
const today = new Date("2026-01-01T12:00:00");

describe("XIRR summary", () => {
  it.each([[110, 0.1], [100, 0], [90, -0.1]])("a one-year holding valued at %d per unit returns %d", (price, rate) => {
    const summary = assetXirrSummary(state({ quoteCache: { stock: quote(price) } }), "stock", today);
    expect(summary.status).toBe("rate");
    if (summary.status !== "rate") return;
    expect(summary.rate).toBeCloseTo(rate, 9);
    expect(summary).toMatchObject({ startDate: "2025-01-01", endDate: "2026-01-01", days: 365, shortPeriod: false, valueAsOf: "2026-01-01" });
    expect(summary.flows.map((flow) => [flow.source, flow.amountInr])).toEqual([["trade", "-10000"], ["terminal", String(price * 100)]]);
  });

  it("counts a payout and marks a short period", () => {
    const summary = assetXirrSummary(state({
      trades: [{ ...buy, date: "2025-07-01" }],
      distributionCoverage: [{ assetId: "stock", from: "2025-07-01", confirmedAt: "x" }],
      distributions: [{ id: "div", assetId: "stock", paidOn: "2025-10-01", grossAmount: 200, taxWithheld: 20, treatment: "paidOutside", recordedAt: "x" }],
    }), "stock", today);
    expect(summary).toMatchObject({ status: "rate", days: 184, shortPeriod: true });
    expect(summary.status === "rate" && summary.flows.map((flow) => flow.source)).toEqual(["trade", "distribution", "terminal"]);
  });

  it("blocks on a stale holding price but only notes missing payouts", () => {
    expect(assetXirrSummary(state({ distributionCoverage: [], quoteCache: { stock: quote(110, "2025-12-01T00:00:00Z") } }), "stock", today))
      .toMatchObject({ status: "unavailable", messages: ["Price is older than 7 days."] });
    const noPayouts = assetXirrSummary(state({ distributionCoverage: [] }), "stock", today);
    expect(noPayouts.status === "rate" && noPayouts.notes).toEqual(["Dividends aren't recorded for 1 holding, so the return may be understated."]);
    expect(assetXirrSummary(state({ openingPositions: [{ id: "o", assetId: "stock", quantity: 1, averageCostPrice: 1, date: null }] }), "stock", today))
      .toMatchObject({ status: "unavailable", messages: ["Purchase history before the opening position isn't recorded."] });
  });

  it("groups every reason with what it applies to, counting trades by record and the rest by holding", () => {
    const summary = summariseXirr({ status: "unavailable", reasons: [
      { assetId: "b", reason: "distributions-not-recorded" },
      { assetId: "portfolio", reason: "no-measurement-basis" },
      { assetId: "a", reason: "trade-funding-unknown", recordId: "t1" },
      { assetId: "a", reason: "trade-funding-unknown", recordId: "t2" },
      { assetId: "b", reason: "trade-funding-unknown", recordId: "t3" },
      { assetId: "a", reason: "distributions-not-recorded" },
      { assetId: "a", reason: "distributions-not-recorded" },
    ] });
    expect(summary.status === "unavailable" && summary.blockers).toEqual([
      { reason: "no-measurement-basis", message: "Save a month-end snapshot in Progress, or set a start date, to measure the return.", unit: null, count: 0, assetIds: [] },
      { reason: "distributions-not-recorded", message: "Dividends or payouts aren't recorded for this period.", unit: "holdings", count: 2, assetIds: ["b", "a"] },
      { reason: "trade-funding-unknown", message: "Link this trade to Cash or mark its funding as external.", unit: "trades", count: 3, assetIds: ["a", "b"] },
    ]);
  });

  it("reports solver failures in one sentence and passes limitations through as notes", () => {
    expect(summariseXirr({ status: "ready", flows: [{ date: "2025-01-01", amountInr: "-1", source: "trade", id: "a" }, { date: "2025-01-01", amountInr: "2", source: "terminal", id: "a" }],
      startDate: "2025-01-01", endDate: "2025-01-01", valueAsOf: null, limitations: [], includedAssetIds: ["a"] }))
      .toMatchObject({ status: "unavailable", messages: ["All activity is on one day, so there is no period to annualise."],
        blockers: [{ reason: "calculation", unit: null, count: 0, assetIds: [] }] });
    const summary = assetXirrSummary(state({ quoteCache: { stock: { ...quote(110), source: "manual" } } }), "stock", today);
    expect(summary.status === "rate" && summary.notes).toEqual(["1 holding uses a manually entered price."]);
  });
});
