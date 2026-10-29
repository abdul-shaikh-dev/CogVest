import { calculateXirr, type XirrCashFlow } from "../xirr";
import { buildAssetXirrInput, buildInvestmentsXirrInput } from "../xirrInputs";
import type { Asset, BuyTrade, Quote, SellTrade } from "@/src/types";

/**
 * Oracle values: Microsoft's documented XIRR example, plus 50-digit decimal
 * bisection of the same 365-day equation (Python `decimal`, independent of this
 * solver). Declared tolerance: 1e-9 against the decimal oracle; 1e-8 against
 * Excel's published 9-digit result, which carries Excel's own stopping tolerance.
 */
const TOLERANCE = 1e-9;
const flow = (date: string, amountInr: number | string): XirrCashFlow => ({ date, amountInr: String(amountInr) });
const monthly = (startYear: number, months: number, amount: number) =>
  Array.from({ length: months }, (_, i) => flow(
    `${startYear + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, amount));
const rateOf = (flows: XirrCashFlow[]) => {
  const result = calculateXirr(flows);
  if (result.status !== "rate") throw new Error(`expected a rate, got ${result.reason}`);
  return result.rate;
};
const reasonOf = (flows: XirrCashFlow[]) => {
  const result = calculateXirr(flows);
  return result.status === "unavailable" ? result.reason : `rate ${result.rate}`;
};

describe("XIRR solver", () => {
  it("returns exact one-year rates", () => {
    expect(rateOf([flow("2025-01-01", -10000), flow("2026-01-01", 11000)])).toBeCloseTo(0.1, 12);
    expect(rateOf([flow("2025-01-01", -10000), flow("2026-01-01", 10000)])).toBeCloseTo(0, 12);
    expect(rateOf([flow("2025-01-01", -10000), flow("2026-01-01", 9000)])).toBeCloseTo(-0.1, 12);
  });

  it("matches Microsoft's documented example", () => {
    const flows = [flow("2008-01-01", -10000), flow("2008-03-01", 2750), flow("2008-10-30", 4250),
      flow("2009-02-15", 3250), flow("2009-04-01", 2750)];
    expect(Math.abs(rateOf(flows) - 0.373362535)).toBeLessThan(1e-8);
    expect(Math.abs(rateOf(flows) - 0.373362533518832)).toBeLessThan(TOLERANCE);
  });

  it.each([
    ["irregular contributions, a partial withdrawal and a leap day", [
      flow("2023-03-15", -5000), flow("2023-11-02", -2500), flow("2024-02-29", 1200),
      flow("2024-07-19", -3000), flow("2025-06-30", 11800)], 0.138446618582298],
    ["regular monthly contributions", [...monthly(2023, 24, -1000), flow("2025-01-01", 27000)], 0.117067288357439],
    ["a zero ending balance after earlier proceeds", [
      flow("2024-01-01", -1000), flow("2024-07-01", 600), flow("2025-01-01", 550)], 0.209842244675073],
  ])("matches the decimal oracle for %s", (_name, flows, expected) => {
    expect(Math.abs(rateOf(flows) - expected)).toBeLessThan(TOLERANCE);
  });

  it("does not depend on input order and combines same-day flows", () => {
    const flows = [flow("2023-03-15", -5000), flow("2023-11-02", -2500), flow("2024-02-29", 1200),
      flow("2024-07-19", -3000), flow("2025-06-30", 11800)];
    const reversed = rateOf([...flows].reverse());
    expect(reversed).toBe(rateOf(flows));
    const split = [flow("2023-03-15", -2000), flow("2023-03-15", -3000), ...flows.slice(1, 4),
      flow("2025-06-30", 11000), flow("2025-06-30", 800)];
    expect(Math.abs(rateOf(split) - 0.138446618582298)).toBeLessThan(TOLERANCE);
  });

  it("stays accurate for very large and very small amounts", () => {
    expect(rateOf([flow("2020-01-01", -1e12), flow("2022-01-01", 2e12)])).toBeCloseTo(2 ** (365 / 731) - 1, 10);
    expect(rateOf([flow("2021-01-01", "-0.01"), flow("2023-01-01", "0.02")])).toBeCloseTo(Math.SQRT2 - 1, 10);
  });

  it("solves a forty-year monthly history within a bounded budget", () => {
    const flows = [...monthly(1985, 480, -500), flow("2025-01-01", 1_750_000)];
    const started = performance.now();
    const rate = rateOf(flows);
    expect(performance.now() - started).toBeLessThan(250);
    expect(Math.abs(rate - 0.082780908911274)).toBeLessThan(TOLERANCE);
  });

  it("annualises a short period and flags it instead of hiding it", () => {
    const result = calculateXirr([flow("2025-01-01", -1000), flow("2025-03-01", 1030)]);
    expect(result).toMatchObject({ status: "rate", days: 59, shortPeriod: true, startDate: "2025-01-01", endDate: "2025-03-01" });
    expect(result.status === "rate" && Math.abs(result.rate - 0.200650840175374)).toBeLessThan(TOLERANCE);
    expect(calculateXirr([flow("2025-01-01", -1000), flow("2026-01-01", 1100)])).toMatchObject({ days: 365, shortPeriod: false });
  });

  it("refuses to pick one of several valid rates", () => {
    // -1000, +2300, -1320 a year apart has both 10% and 20% as exact roots.
    expect(reasonOf([flow("2025-01-01", -1000), flow("2026-01-01", 2300), flow("2027-01-01", -1320)])).toBe("multiple-rates");
  });

  it("gives up within budget when a root only touches zero", () => {
    // -1, +2, -1 a year apart is -(1 - v)^2: a double root at 0% that never changes sign.
    const started = performance.now();
    expect(reasonOf([flow("2025-01-01", -1), flow("2026-01-01", 2), flow("2027-01-01", -1)])).toBe("undetermined");
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("reports when no rate exists in range", () => {
    expect(reasonOf([flow("2025-01-01", -1000), flow("2026-01-01", 3000), flow("2027-01-01", -2500)])).toBe("no-rate-in-range");
    expect(reasonOf([flow("2025-01-01", -1000), flow("2026-01-01", "0.01")])).toBe("no-rate-in-range");
    expect(reasonOf([flow("2025-01-01", -1), flow("2025-01-02", 1e9)])).toBe("no-rate-in-range");
  });

  it("solves a near-total loss inside the range", () => {
    expect(rateOf([flow("2025-01-01", -1000), flow("2026-01-01", 1)])).toBeCloseTo(-0.999, 10);
  });

  it("separates missing-sign and invalid inputs from mathematical failures", () => {
    expect(reasonOf([flow("2025-01-01", -1000), flow("2026-01-01", 0)])).toBe("no-positive-flow");
    expect(reasonOf([flow("2025-01-01", 1000), flow("2026-01-01", 10)])).toBe("no-negative-flow");
    // Same-day flows net first, so +100 on one date has no investment to measure.
    expect(reasonOf([flow("2025-01-01", -1000), flow("2025-01-01", 1100)])).toBe("no-negative-flow");
    expect(reasonOf([])).toBe("no-negative-flow");
    expect(reasonOf([flow("2025-02-30", -1), flow("2026-01-01", 2)])).toBe("invalid-flow");
    expect(reasonOf([flow("2025-01-01", "abc"), flow("2026-01-01", 2)])).toBe("invalid-flow");
    expect(reasonOf([flow("2025-01-01", "Infinity"), flow("2026-01-01", 2)])).toBe("invalid-flow");
    expect(reasonOf([flow("1850-01-01", -1), flow("2025-01-01", 2)])).toBe("undetermined");
  });

  it("does not mutate its input", () => {
    const flows = [flow("2026-01-01", 1100), flow("2025-01-01", -1000)];
    const before = JSON.stringify(flows);
    calculateXirr(flows);
    expect(JSON.stringify(flows)).toBe(before);
  });
});

describe("XIRR from built inputs", () => {
  const btc: Asset = { id: "btc", name: "Bitcoin", symbol: "BTC", ticker: "bitcoin", currency: "INR", assetClass: "crypto" };
  const eth: Asset = { ...btc, id: "eth", name: "Ether", symbol: "ETH", ticker: "ethereum" };
  const quote = (assetId: string, price: number): Quote => ({ assetId, asOf: "2026-01-01", currency: "INR", price, source: "coingecko" });
  const buy = (id: string, assetId: string, date: string, totalValue: number): BuyTrade =>
    ({ id, assetId, type: "buy", date, quantity: 1, pricePerUnit: totalValue, totalValue });
  const sell: SellTrade = { id: "eth-sell", assetId: "eth", type: "sell", date: "2025-07-01", quantity: 1, pricePerUnit: 1300, totalValue: 1300 };
  const trades = [buy("btc-buy", "btc", "2025-01-01", 1000), buy("eth-buy", "eth", "2025-01-01", 1000), sell];
  const endDate = "2026-01-01";

  it("calculates per-asset rates for a held and a fully sold asset", () => {
    const held = buildAssetXirrInput({ asset: btc, assetId: "btc", assets: [btc, eth], trades, openingPositions: [], quote: quote("btc", 1210), distributions: [], coverage: undefined, endDate });
    const sold = buildAssetXirrInput({ asset: eth, assetId: "eth", assets: [btc, eth], trades, openingPositions: [], quote: undefined, distributions: [], coverage: undefined, endDate });
    expect(held.status === "ready" && rateOf(held.flows)).toBeCloseTo(0.21, 10);
    expect(sold.status === "ready" && calculateXirr(sold.flows)).toMatchObject({ status: "rate", shortPeriod: true, days: 181 });
  });

  it("calculates the portfolio rate from combined flows, not an average of asset rates", () => {
    const quotes = { btc: quote("btc", 1210) };
    const portfolio = buildInvestmentsXirrInput({
      assets: [btc, eth], trades, openingPositions: [], quotes, distributions: [], distributionCoverage: [],
      hasPpfAccounts: false, hasEpfAccounts: false, hasFuturesAccounts: false, endDate,
    });
    if (portfolio.status !== "ready") throw new Error("expected ready input");
    const combined = rateOf(portfolio.flows);
    const btcRate = 0.21;
    const ethRate = rateOf([flow("2025-01-01", -1000), flow("2025-07-01", 1300)]);
    // -2000 on day 0, +1300 on day 181, +1210 on day 365: solved, not averaged.
    expect(Math.abs(combined - rateOf([flow("2025-01-01", -2000), flow("2025-07-01", 1300), flow("2026-01-01", 1210)]))).toBe(0);
    expect(Math.abs(combined - (btcRate + ethRate) / 2)).toBeGreaterThan(0.05);
  });
});
