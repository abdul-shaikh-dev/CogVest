import {
  getDefaultAssetMetadata,
  normalizeAssetMetadata,
} from "@/src/domain/assets";
import type { Asset } from "@/src/types";

const baseAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

describe("asset metadata", () => {
  it.each([
    ["stock", "stock", "financialServices"],
    ["etf", "etf", "diversified"],
    ["debt", "debt", "fixedIncome"],
    ["crypto", "crypto", "digitalAsset"],
    ["cash", "cash", "liquidity"],
  ] as const)("defaults %s metadata", (assetClass, instrumentType, sectorType) => {
    expect(getDefaultAssetMetadata(assetClass)).toEqual({
      instrumentType,
      sectorType,
    });
  });

  it("fills missing metadata without changing explicit values", () => {
    expect(normalizeAssetMetadata(baseAsset)).toEqual({
      ...baseAsset,
      instrumentType: "stock",
      quoteSourceId: "RELIANCE.NS",
      sectorType: "financialServices",
    });

    expect(
      normalizeAssetMetadata({
        ...baseAsset,
        instrumentType: "mutualFund",
        quoteSourceId: "custom-source",
        sectorType: "technology",
      }),
    ).toMatchObject({
      instrumentType: "mutualFund",
      quoteSourceId: "custom-source",
      sectorType: "technology",
    });
  });
});
