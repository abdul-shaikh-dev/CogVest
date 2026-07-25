import {
  equitySectorTypeOptions,
  getDefaultAssetMetadata,
  getInstrumentTypeOptions,
  instrumentTypeLabel,
  normalizeAssetMetadata,
  sectorTypeLabel,
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
    ["stock", "stock", "other"],
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
      sectorType: "other",
    });

    expect(
      normalizeAssetMetadata({
        ...baseAsset,
        instrumentType: "ppf",
        quoteSourceId: "custom-source",
        sectorType: "technology",
      }),
    ).toMatchObject({
      instrumentType: "ppf",
      quoteSourceId: "custom-source",
      sectorType: "technology",
    });
  });

  it("uses user-facing labels and class-specific choices", () => {
    expect(instrumentTypeLabel("fixedDeposit")).toBe("Fixed Deposit");
    expect(sectorTypeLabel("other")).toBe("Unknown");
    expect(equitySectorTypeOptions).toContain("communicationServices");
    expect(equitySectorTypeOptions).not.toContain("digitalAsset");
    expect(getInstrumentTypeOptions("stock")).toEqual(["stock"]);
    expect(getInstrumentTypeOptions("debt")).toContain("ppf");
  });
});
