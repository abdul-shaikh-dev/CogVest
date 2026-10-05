import { calculateReportingAllocation } from "../reportingAllocation";
import { calculateHoldings } from "../holdings";
import type { Asset } from "@/src/types";

const asset: Asset = { id: "btc", name: "Bitcoin", symbol: "BTC", ticker: "bitcoin",
  assetClass: "crypto", currency: "INR", instrumentType: "crypto", exchange: "CRYPTO" };
const holdings = calculateHoldings({ assets: [asset], openingPositions: [],
  trades: [{ id: "buy", assetId: "btc", type: "buy", date: "2026-01-01", quantity: 1,
    pricePerUnit: 100000, totalValue: 100000 }],
  quoteCache: { btc: { assetId: "btc", currency: "INR", price: 100000,
    asOf: "2026-10-05T12:00:00Z", source: "coingecko" } }, now: new Date("2026-10-05T12:00:00Z") });
const input = { holdings, cashBalance: 10000, ppfConfirmedBalance: 50000, futuresEquityInr: 340000 };

describe("reporting allocation", () => {
  it("groups spot plus converted net Futures equity and PPF under Debt without mutating records", () => {
    const before = JSON.stringify(input);
    const result = calculateReportingAllocation(input);
    expect(result.find(row => row.assetClass === "crypto")).toEqual({ assetClass: "crypto",
      value: 440000, percentage: 88, cryptoBreakdown: { spot: 100000, futures: 340000 } });
    expect(result.find(row => row.assetClass === "debt")?.value).toBe(50000);
    expect(result.reduce((sum, row) => sum + row.value, 0)).toBe(500000);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("retains a closed-position wallet even without spot holdings", () => {
    expect(calculateReportingAllocation({ ...input, holdings: [] })
      .find(row => row.assetClass === "crypto")?.cryptoBreakdown).toEqual({ spot: 0, futures: 340000 });
  });
  it.each([null, -1, NaN, Infinity])("withholds incomplete or negative Futures equity %s", futuresEquityInr => {
    expect(calculateReportingAllocation({ ...input, futuresEquityInr })).toEqual([]);
  });
  it("adds PPF to other Debt and never to Cash", () => {
    const debtHoldings = holdings.map(holding => ({ ...holding, asset: { ...holding.asset, assetClass: "debt" as const } }));
    const result = calculateReportingAllocation({ ...input, holdings: debtHoldings, futuresEquityInr: 0 });
    expect(result.find(row => row.assetClass === "debt")?.value).toBe(150000);
    expect(result.find(row => row.assetClass === "cash")?.value).toBe(10000);
  });
  it("keeps negative Cash signed, suppressing percentages for nonpositive net wealth", () => {
    const result = calculateReportingAllocation({ ...input, cashBalance: -500000 });
    expect(result.every(row => row.percentage === null)).toBe(true);
    expect(result.find(row => row.assetClass === "cash")?.value).toBe(-500000);
  });
  it("does not manufacture zero for a missing holding value", () => {
    expect(calculateReportingAllocation({ ...input,
      holdings: holdings.map(holding => ({ ...holding, currentValue: null, calculationBasis: undefined })),
    })).toEqual([]);
  });
});
