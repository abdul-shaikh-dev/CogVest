import type { Asset } from "@/src/types";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { searchSavedAssets } from "../assetDiscovery";
import { clearRecentAssetSearches, readRecentAssetSearches, recentAssetSearchesKey, saveRecentAssetSearch } from "../recentAssetSearches";

describe("asset discovery", () => {
  it("ranks the exact asset first across 500 saved assets and filters exchange without conflating listings", () => {
    const assets: Asset[] = Array.from({ length: 500 }, (_, i) => ({
      id: `asset-${i}`, name: `Stock ${i}`, symbol: `STOCK${i}`, ticker: `STOCK${i}.NS`,
      assetClass: "stock", currency: "INR", exchange: i % 2 ? "BSE" : "NSE",
    }));
    expect(searchSavedAssets(assets, "STOCK49")[0].id).toBe("asset-49");
    expect(searchSavedAssets(assets, "stock", "NSE")).toHaveLength(250);
    expect(searchSavedAssets(assets, "stock", "crypto")).toEqual([]);
    expect(searchSavedAssets(assets, "")).toHaveLength(500);
  });

  it("keeps five recent selected searches locally, deduplicated and clearable", () => {
    const storage = createMemoryJsonStorage();
    for (let i = 0; i < 7; i++) saveRecentAssetSearch(`Stock ${i}`, storage);
    expect(readRecentAssetSearches(storage)).toHaveLength(5);
    saveRecentAssetSearch("stock 4", storage);
    expect(readRecentAssetSearches(storage)[0]).toBe("stock 4");
    expect(readRecentAssetSearches(storage)).toHaveLength(5);
    clearRecentAssetSearches(storage);
    expect(storage.getRawItem(recentAssetSearchesKey)).toBeNull();
  });

  it("ignores malformed convenience history without blocking asset entry", () => {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(recentAssetSearchesKey, "{");
    expect(readRecentAssetSearches(storage)).toEqual([]);
    storage.setItem(recentAssetSearchesKey, [null, "x", "valid", 12, "a".repeat(101)]);
    expect(readRecentAssetSearches(storage)).toEqual(["valid"]);
  });
});
