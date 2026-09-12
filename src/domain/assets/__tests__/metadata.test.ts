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

    expect(
      normalizeAssetMetadata({
        ...baseAsset,
        isin: " ine040a01034 ",
      }),
    ).toMatchObject({ isin: "INE040A01034" });
  });

  it("does not invent a quote provider identity for local mutual funds", () => {
    expect(normalizeAssetMetadata({
      assetClass: "debt",
      currency: "INR",
      id: "cas:INF000000001",
      instrumentType: "mutualFund",
      isin: "INF000000001",
      name: "Sample Fund",
      symbol: "INF000000001",
      ticker: "INF000000001",
    })).not.toHaveProperty("quoteSourceId");
    expect(normalizeAssetMetadata({
      assetClass: "stock",
      currency: "INR",
      id: "cas:INF000000002",
      instrumentType: "mutualFund",
      isin: "INF000000002",
      name: "Sample Equity Fund",
      symbol: "INF000000002",
      ticker: "INF000000002",
    })).not.toHaveProperty("quoteSourceId");
  });

  it("uses user-facing labels and class-specific choices", () => {
    expect(instrumentTypeLabel("fixedDeposit")).toBe("Fixed Deposit");
    expect(sectorTypeLabel("other")).toBe("Unknown");
    expect(equitySectorTypeOptions).toContain("communicationServices");
    expect(equitySectorTypeOptions).not.toContain("digitalAsset");
    expect(getInstrumentTypeOptions("stock")).toContain("mutualFund");
    expect(getInstrumentTypeOptions("debt")).toContain("ppf");
  });
});
