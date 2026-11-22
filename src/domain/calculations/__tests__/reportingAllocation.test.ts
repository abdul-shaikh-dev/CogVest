import { calculatePricedReportingAllocation, calculateReportingAllocation } from "../reportingAllocation";
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

describe("allocation of priced holdings (#782)", () => {
  const unpriced = { ...holdings[0], asset: { ...asset, id: "eth", name: "Ether" }, currentValue: null,
    currentPrice: null, calculationBasis: undefined, totalInvested: 20000,
    valuation: { ...holdings[0].valuation, status: "pending" as const } };

  it("leaves unpriced holdings out and lists each with what was invested", () => {
    const result = calculatePricedReportingAllocation({ ...input, holdings: [...holdings, unpriced] });
    expect(result?.allocation).toEqual(calculateReportingAllocation(input));
    expect(result?.excluded).toEqual([{ assetId: "eth", name: "Ether", invested: 20000 }]);
  });

  it("matches the full allocation when every holding is priced", () => {
    expect(calculatePricedReportingAllocation(input)).toEqual({ allocation: calculateReportingAllocation(input), excluded: [] });
  });

  it("never counts a missing value as zero", () => {
    const missingValue = { ...holdings[0], asset: { ...asset, id: "sol", name: "Sol" }, currentValue: null, calculationBasis: undefined };
    expect(calculatePricedReportingAllocation({ ...input, holdings: [...holdings, missingValue] })?.excluded
      .map(item => item.assetId)).toEqual(["sol"]);
  });

  it.each([null, -1])("stays unavailable when Futures equity is %s, whatever the prices", futuresEquityInr => {
    expect(calculatePricedReportingAllocation({ ...input, holdings: [...holdings, unpriced], futuresEquityInr })).toBeNull();
  });

  it("stays unavailable when the EPF balance is unknown", () => {
    expect(calculatePricedReportingAllocation({ ...input, epfRecordedBalance: null })).toBeNull();
  });
});
