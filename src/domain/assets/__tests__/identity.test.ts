import {
  findCanonicalAsset,
  hasCanonicalAssetConflict,
} from "@/src/domain/assets";
import type { Asset } from "@/src/types";

const hdfc: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-hdfc",
  instrumentType: "stock",
  name: "HDFC Bank",
  quoteSourceId: "HDFCBANK.NS",
  sectorType: "financialServices",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

describe("canonical asset identity", () => {
  it("prefers a stable ID before provider identity", () => {
    const sameId = { ...hdfc, quoteSourceId: "UPDATED.NS" };

    expect(findCanonicalAsset([hdfc], sameId)).toBe(hdfc);
  });

  it("matches provider identity before normalized exchange and ticker", () => {
    const providerMatch = { ...hdfc, id: "asset-provider" };
    const tickerMatch = {
      ...hdfc,
      id: "asset-ticker",
      quoteSourceId: "OTHER.NS",
    };
    const candidate = {
      ...hdfc,
      id: "candidate",
      quoteSourceId: " hdfcbank.ns ",
      ticker: tickerMatch.ticker,
    };

    expect(findCanonicalAsset([tickerMatch, providerMatch], candidate)).toBe(
      providerMatch,
    );
  });

  it("falls back to normalized exchange and ticker", () => {
    const candidate = {
      ...hdfc,
      id: "candidate",
      quoteSourceId: undefined,
      ticker: " hdfcbank.ns ",
    };

    expect(findCanonicalAsset([hdfc], candidate)).toBe(hdfc);
    expect(hasCanonicalAssetConflict([hdfc], candidate)).toBe(true);
  });

  it("does not merge the same ticker across different exchanges", () => {
    const candidate = {
      ...hdfc,
      exchange: "BSE" as const,
      id: "candidate",
      quoteSourceId: undefined,
      ticker: "HDFCBANK.NS",
    };

    expect(findCanonicalAsset([hdfc], candidate)).toBeUndefined();
  });
});
