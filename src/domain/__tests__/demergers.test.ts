import { projectDemergers, proposeDemergers } from "@/src/domain/demergers";
import type { Asset, OpeningPosition, StockSplitEvent, Trade } from "@/src/types";

const parent: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "tmpv",
  isin: "INE155A01022",
  name: "Tata Motors Passenger Vehicles",
  quoteSourceId: "TMPV.NS",
  symbol: "TMPV",
  ticker: "TMPV.NS",
};

const child: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "tmcv",
  isin: "INE1TAE01010",
  name: "Tata Motors",
  quoteSourceId: "TMCV.NS",
  symbol: "TMCV",
  ticker: "TMCV.NS",
};

const opening: OpeningPosition = {
  assetId: parent.id,
  averageCostPrice: 100,
  id: "parent-opening",
  date: "2025-01-01",
  measuredAsOf: "2025-01-01",
  quantity: 10,
};

function linkedPortfolio({
  childAsset = child,
  openingPositions = [opening],
  parentAsset = parent,
  trades = [],
}: {
  childAsset?: Asset;
  openingPositions?: OpeningPosition[];
  parentAsset?: Asset;
  trades?: Trade[];
} = {}) {
  return {
    assets: [{ ...parentAsset, demerger: { childAssetId: childAsset.id, eventId: "TATAMOTORS-TMCV-2025-v1" } }, childAsset],
    openingPositions,
    trades,
  };
}

describe("demerger projection", () => {
  it("rejects absent source history and mismatched measured parent cost", () => {
    expect(() => projectDemergers(linkedPortfolio({ openingPositions: [] }))).toThrow(/eligibility/);
    expect(() => projectDemergers(linkedPortfolio({
      openingPositions: [{ ...opening, measuredAsOf: "2026-01-01" }],
      trades: [{ id: "source", assetId: parent.id, type: "buy", date: "2025-01-01", quantity: 10, pricePerUnit: 100, totalValue: 1000 }],
    }))).toThrow(/does not reconcile/);
  });

  it("does not propose an entitlement for a position fully sold before the event", () => {
    const assets = proposeDemergers({ assets: [parent], openingPositions: [opening],
      trades: [{ id: "sold", assetId: parent.id, type: "sell", date: "2025-02-01", quantity: 10, pricePerUnit: 100, totalValue: 1000 }],
    }, new Set([parent.id]), "2026-01-01");
    expect(assets).toEqual([parent]);
  });
  it("accepts only catalog-backed successor quote identities", () => {
    const adjustments = projectDemergers(linkedPortfolio());
    expect(adjustments).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: parent.id, kind: "retainedCost", retainedFraction: "0.6885" }),
      expect.objectContaining({ assetId: child.id, cost: "311.5", kind: "entitlement", quantity: 10 }),
    ]));

    expect(() => projectDemergers(linkedPortfolio({
      childAsset: { ...child, quoteSourceId: "UNRELATED.NS", ticker: "UNRELATED.NS" },
    }))).toThrow(/successor quote listing/i);

    expect(projectDemergers(linkedPortfolio({
      childAsset: { ...child, quoteSourceId: "TMCV.BO", ticker: "TMCV.BO" },
    }))).toHaveLength(2);
  });

  it("rejects same-day parent share adjustments until ordering is verified", () => {
    const split: StockSplitEvent = {
      effectiveDate: "2025-10-14",
      evidence: { publishedDate: "2025-10-01", url: "https://example.test/split", verifiedDate: "2025-10-02" },
      id: "same-day-split",
      kind: "split",
      newIsin: parent.isin!,
      newShares: 2,
      oldIsin: parent.isin!,
      oldShares: 1,
    };

    expect(() => projectDemergers(linkedPortfolio({
      parentAsset: { ...parent, stockSplits: [split] },
    }))).toThrow(/same-day share adjustments/i);
  });

  it("proposes a successor from a measured pre-ex parent opening without raw trades", () => {
    const assets = proposeDemergers({
      assets: [parent],
      openingPositions: [opening],
      trades: [],
    }, new Set([parent.id]), "2026-01-01");

    expect(assets.find((asset) => asset.id === parent.id)?.demerger).toEqual({
      childAssetId: "yahoo:TMCV.NS",
      eventId: "TATAMOTORS-TMCV-2025-v1",
    });
    expect(assets.find((asset) => asset.id === "yahoo:TMCV.NS")).toMatchObject({
      isin: child.isin,
      quoteSourceId: "TMCV.NS",
      ticker: "TMCV.NS",
    });
  });

  it("rejects fractional source quantities and successor activity before listing", () => {
    const fractionalTrade: Trade = {
      assetId: parent.id,
      date: "2025-01-01",
      id: "fractional-buy",
      pricePerUnit: 100,
      quantity: 1.5,
      totalValue: 150,
      type: "buy",
    };
    expect(() => projectDemergers(linkedPortfolio({
      openingPositions: [],
      trades: [fractionalTrade],
    }))).toThrow(/quantity or acquisition cost is unresolved/i);

    const prelistingChildTrade: Trade = {
      assetId: child.id,
      date: "2025-10-15",
      id: "prelisting-buy",
      pricePerUnit: 100,
      quantity: 1,
      totalValue: 100,
      type: "buy",
    };
    expect(() => projectDemergers(linkedPortfolio({
      trades: [prelistingChildTrade],
    }))).toThrow(/before its verified listing date/i);
  });
});
