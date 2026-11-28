import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { Asset, BuyTrade, CashEntry } from "@/src/types";

const now = () => new Date("2026-10-05T10:00:00Z");
const etfAsShare: Asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "itbees", instrumentType: "stock",
  name: "Nippon India ETF Nifty IT", symbol: "ITBEES", ticker: "ITBEES.NS",
};
const fund: Asset = {
  assetClass: "stock", currency: "INR", id: "fund", instrumentType: "mutualFund", isin: "INF000000001",
  name: "Nifty Bank Index Fund", symbol: "INF000000001", ticker: "INF000000001",
};
const deposit: CashEntry = { id: "deposit", amount: 5000, date: "2026-01-01", label: "Deposit", purpose: "capitalContribution", type: "addition" };
const buy: BuyTrade = { id: "buy", assetId: "itbees", type: "buy", date: "2026-01-05", quantity: 10, pricePerUnit: 40, totalValue: 400 };

function harness() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addAsset(etfAsShare);
  store.getState().addAsset(fund);
  store.getState().addCashEntry(deposit);
  store.getState().addTrade(buy);
  return { storage, store };
}

describe("applyAssetClassifications", () => {
  it("applies sector and ETF moves in one saved write, keeping quotes and month-ends", () => {
    const { storage, store } = harness();
    const before = store.getState();
    expect(store.getState().applyAssetClassifications([
      { assetClass: "etf", assetId: "itbees", instrumentType: "etf", sectorType: "technology" },
      { assetClass: "stock", assetId: "fund", instrumentType: "mutualFund", sectorType: "financialServices" },
    ])).toEqual({ applied: 2, status: "applied" });

    const assets = store.getState().assets;
    expect(assets.find((asset) => asset.id === "itbees")).toMatchObject({
      assetClass: "etf", instrumentType: "etf", quoteSourceId: "ITBEES.NS", sectorType: "technology", ticker: "ITBEES.NS",
    });
    expect(assets.find((asset) => asset.id === "fund")).toMatchObject({ instrumentType: "mutualFund", sectorType: "financialServices" });
    expect(store.getState().quoteCache).toBe(before.quoteCache);
    expect(store.getState().monthlySnapshots).toBe(before.monthlySnapshots);
    expect(store.getState().trades).toEqual(before.trades);
    // Survives a restart.
    expect(createPortfolioStore({ storage, now }).getState().assets).toEqual(assets);
  });

  it("rejects the whole batch when one change is not allowed", () => {
    const { store } = harness();
    const before = store.getState().assets;
    expect(store.getState().applyAssetClassifications([
      { assetClass: "stock", assetId: "fund", sectorType: "financialServices" },
      { assetClass: "debt", assetId: "itbees" },
    ])).toEqual({ assetId: "itbees", reason: "invalidChange", status: "rejected" });
    expect(store.getState().applyAssetClassifications([
      { assetClass: "etf", assetId: "itbees", instrumentType: "stock" },
    ])).toMatchObject({ reason: "invalidChange" });
    expect(store.getState().applyAssetClassifications([
      { assetClass: "stock", assetId: "fund", sectorType: "nonsense" as Asset["sectorType"] },
    ])).toMatchObject({ reason: "invalidChange" });
    expect(store.getState().applyAssetClassifications([
      { assetClass: "stock", assetId: "missing" },
    ])).toMatchObject({ reason: "notFound" });
    expect(store.getState().assets).toBe(before);
  });
  it("saves the sector basis and international marker, and survives a restart (#823)", () => {
    const { storage, store } = harness();
    expect(store.getState().applyAssetClassifications([
      { assetClass: "stock", assetId: "fund", international: true, sectorBasis: "schemeName", sectorType: "financialServices" },
    ])).toEqual({ applied: 1, status: "applied" });
    expect(store.getState().assets.find((asset) => asset.id === "fund"))
      .toMatchObject({ international: true, sectorBasis: "schemeName", sectorType: "financialServices" });
    expect(createPortfolioStore({ storage, now }).getState().assets.find((asset) => asset.id === "fund"))
      .toMatchObject({ international: true, sectorBasis: "schemeName" });

    // A new sector without a basis drops the old one rather than keeping a stale source.
    store.getState().applyAssetClassifications([{ assetClass: "stock", assetId: "fund", sectorType: "energy" }]);
    expect(store.getState().assets.find((asset) => asset.id === "fund")).not.toHaveProperty("sectorBasis");
    // The same sector keeps its basis.
    store.getState().applyAssetClassifications([{ assetClass: "stock", assetId: "fund", sectorBasis: "user", sectorType: "healthcare" }]);
    store.getState().applyAssetClassifications([{ assetClass: "stock", assetId: "fund", sectorType: "healthcare" }]);
    expect(store.getState().assets.find((asset) => asset.id === "fund")).toMatchObject({ sectorBasis: "user" });
  });

  it("rejects a bad basis, a basis without a sector, or a non-boolean marker", () => {
    const { store } = harness();
    const before = store.getState().assets;
    for (const change of [
      { assetClass: "stock" as const, assetId: "fund", sectorBasis: "guess" as Asset["sectorBasis"], sectorType: "energy" as const },
      { assetClass: "stock" as const, assetId: "fund", sectorBasis: "user" as const },
      { assetClass: "stock" as const, assetId: "fund", international: "yes" as unknown as boolean },
    ]) {
      expect(store.getState().applyAssetClassifications([change])).toMatchObject({ reason: "invalidChange", status: "rejected" });
    }
    expect(store.getState().assets).toBe(before);
  });
});
