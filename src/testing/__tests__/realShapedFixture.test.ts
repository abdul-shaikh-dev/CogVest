import { calculateHoldings, calculateInternationalShare } from "@/src/domain/calculations/holdings";
import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import { buildAssetXirrInput } from "@/src/domain/xirrInputs";
import { summariseXirr } from "@/src/domain/xirrSummary";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import {
  createRealShapedFixture,
  monthAt,
  realShapedFunds,
  realShapedIds,
  realShapedSplitRatio,
  realShapedStocks,
  syntheticPrice,
} from "../realShapedFixture";

const now = new Date("2026-11-15T06:00:00.000Z");
const fixture = createRealShapedFixture(now);
const { portfolio, quoteCache } = fixture.payload;
const holdings = calculateHoldings({
  assets: portfolio.assets, now, openingPositions: portfolio.openingPositions, quoteCache, trades: portfolio.trades,
});
const holding = (id: string) => holdings.find((item) => item.asset.id === id)!;

function sipUnits(key: string) {
  const spec = realShapedFunds.find((item) => item.key === key)!;
  let units = 0;
  for (let month = spec.from; month <= spec.to; month += 1) {
    units += Math.round((spec.sip / syntheticPrice(spec.baseNav, spec.annualRate, month)) * 1000) / 1000;
  }
  return units;
}

describe("real-shaped synthetic portfolio (#843)", () => {
  it("restores as a valid backup with the expected shape", () => {
    expect(() => validateBackupPayload(fixture.payload)).not.toThrow();
    expect(portfolio.assets).toHaveLength(realShapedFunds.length + realShapedStocks.length + 2);
    expect(portfolio.assets.filter((asset) => asset.instrumentType === "mutualFund").length).toBeGreaterThanOrEqual(18);
    expect(portfolio.trades.length).toBeGreaterThan(1200);
    expect(portfolio.ppfAccounts).toHaveLength(1);
    expect(portfolio.ppfLedgerEntries).toHaveLength(15);
    expect(portfolio.epf.accounts).toHaveLength(1);
    // One generated snapshot per completed month, December 2018 (the PPF checkpoint) to October 2026.
    expect(portfolio.monthlySnapshots.map((item) => item.month)).toEqual(
      Array.from({ length: 95 }, (_, index) => monthAt(index - 1)));
    expect(JSON.stringify(fixture.payload)).not.toMatch(/Download|@/);
  });

  it("replays SIP units, sells and the scheme merger exactly", () => {
    expect(holding(realShapedIds.fund("cedar-nifty")).totalUnits).toBeCloseTo(sipUnits("cedar-nifty"), 3);
    expect(holding(realShapedIds.fund("aster-elss")).totalUnits).toBeCloseTo(sipUnits("aster-elss") * 0.5, 2);
    // The merged scheme is empty; its units arrive in the target at the merger ratio.
    expect(holdings.find((item) => item.asset.id === realShapedIds.fund("aster-bluechip"))?.totalUnits ?? 0).toBe(0);
    const bluechip = realShapedFunds.find((item) => item.key === "aster-bluechip")!;
    const large = realShapedFunds.find((item) => item.key === "aster-large")!;
    const received = (sipUnits("aster-bluechip") * syntheticPrice(bluechip.baseNav, bluechip.annualRate, 41))
      / syntheticPrice(large.baseNav, large.annualRate, 41);
    expect(holding(realShapedIds.fund("aster-large")).totalUnits).toBeCloseTo(sipUnits("aster-large") + received, 2);
  });

  it("applies the verified split to lots bought before it", () => {
    expect(holding(realShapedIds.stock("synrail")).totalUnits).toBe((10 + 4) * realShapedSplitRatio + 20);
  });

  it("keeps the manual value of a holding with no purchase date as entered", () => {
    const manual = holding(realShapedIds.manual);
    expect(manual.currentValue).toBe(200 * 410);
  });

  it("reports the international share from the marked international fund", () => {
    const total = holdings.reduce((sum, item) => sum + (item.currentValue ?? 0), 0);
    const us = holding(realShapedIds.fund("elm-us")).currentValue!;
    expect(calculateInternationalShare(holdings)).toBeCloseTo((us / total) * 100, 1);
  });

  it("gives a SIP fund an XIRR close to its growth rate", () => {
    const spec = realShapedFunds.find((item) => item.key === "banyan-flexi")!;
    const id = realShapedIds.fund(spec.key);
    const summary = summariseXirr(buildAssetXirrInput({
      asset: portfolio.assets.find((asset) => asset.id === id), assetId: id, assets: portfolio.assets,
      coverage: portfolio.distributionCoverage.find((item) => item.assetId === id),
      distributions: portfolio.distributions, endDate: "2026-11-15", openingPositions: portfolio.openingPositions,
      quote: quoteCache[id], trades: portfolio.trades,
    }));
    expect(summary.status).toBe("rate");
    if (summary.status === "rate") expect(Math.abs(summary.rate - spec.annualRate)).toBeLessThan(0.02);
  });

  it("grows the generated snapshots with the records", () => {
    const first = portfolio.monthlySnapshots[0];
    const last = portfolio.monthlySnapshots.at(-1)!;
    expect(last.investedValue).toBeGreaterThan(first.investedValue * 10);
    expect(last.portfolioValue).toBeGreaterThan(last.investedValue);
    expect(last.debtValue).toBeGreaterThan(0);
    expect(last.cashValue).toBeGreaterThan(0);
  });

  it("stores a partial daily history with weekend and provider gaps", () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const [entry] = fixture.dailyPriceEntries;
    expect(entry.complete).toBe(false);
    expect(entry.points.some((point) => point.date === "2023-03-06")).toBe(false);
    expect(cache.write(entry).status).toBe("stored");
  });
});
