import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import {
  assetSearchQaFixtureCounts,
  assetSearchQaMixedNameCandidates,
  assetSearchQaProviderCandidates,
  assetSearchQaSavedAssets,
  createAssetSearchQaLookup,
  seedAssetSearchQaStore,
} from "@/src/testing/assetSearchFixture";

describe("asset search QA fixture", () => {
  it("keeps its synthetic saved assets in the injected memory-backed store", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    seedAssetSearchQaStore(store);

    expect(assetSearchQaSavedAssets).toHaveLength(
      assetSearchQaFixtureCounts.savedAssets,
    );
    expect(store.getState().assets).toHaveLength(
      assetSearchQaFixtureCounts.savedAssets,
    );
    expect(store.getState().assets.find((asset) => asset.symbol === "SAVED0420"))
      .toMatchObject({ name: "Synthetic saved asset 0420" });
  });

  it("prepares all 200 provider candidates through the production lookup pipeline", () => {
    const results = createAssetSearchQaLookup("CAND0042");

    expect(assetSearchQaProviderCandidates).toHaveLength(
      assetSearchQaFixtureCounts.providerCandidates,
    );
    expect(results).toHaveLength(100);
    expect(results[0]).toMatchObject({ symbol: "CAND0042" });
  });

  it("provides a deterministic mixed-name set without changing identity metadata", () => {
    const results = createAssetSearchQaLookup("HDFC");

    expect(results).toHaveLength(assetSearchQaMixedNameCandidates.length);
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ exchange: "NSE", instrumentType: "stock", ticker: "HDFCBANK.NS" }),
      expect.objectContaining({ exchange: "BSE", instrumentType: "stock", ticker: "HDFCBANK.BO" }),
      expect.objectContaining({ exchange: "NSE", instrumentType: "etf", ticker: "HDFCNIFETF.NS" }),
      expect.objectContaining({ exchange: "CRYPTO", instrumentType: "crypto", quoteSourceId: "hdfc-bank-rstock" }),
    ]));
    expect(assetSearchQaSavedAssets[0]).toMatchObject({
      instrumentType: "mutualFund",
      name: "HDFC Balanced Advantage Fund - Direct Plan - Growth",
    });
  });
});
