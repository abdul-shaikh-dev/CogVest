import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import {
  assetSearchQaFixtureCounts,
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
});
