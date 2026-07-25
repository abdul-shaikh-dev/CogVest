import {
  buildCoinGeckoSearchUrl,
  buildYahooSearchUrl,
  mapCoinGeckoCoinToLookupResult,
  mapYahooQuoteToLookupResult,
  mapYahooSectorToSectorType,
  prepareAssetLookupResults,
  searchAssetLookupResults,
} from "@/src/services/assetLookup";
import type { AssetLookupResult } from "@/src/services/assetLookup";

function response(payload: unknown, ok = true): Response {
  return {
    json: jest.fn().mockResolvedValue(payload),
    ok,
    status: ok ? 200 : 500,
  } as unknown as Response;
}

describe("asset lookup service", () => {
  it("builds provider search URLs", () => {
    expect(buildYahooSearchUrl("hdfc bank")).toBe(
      "https://query2.finance.yahoo.com/v1/finance/search?q=hdfc+bank&quotesCount=8&newsCount=0",
    );
    expect(buildCoinGeckoSearchUrl("bitcoin")).toBe(
      "https://api.coingecko.com/api/v3/search?query=bitcoin",
    );
  });

  it("maps NSE Yahoo equity search results to INR stock metadata", () => {
    expect(
      mapYahooQuoteToLookupResult({
        exchange: "NSI",
        longname: "HDFC Bank Limited",
        quoteType: "EQUITY",
        shortname: "HDFC Bank",
        symbol: "HDFCBANK.NS",
      }),
    ).toEqual({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "yahoo:HDFCBANK.NS",
      instrumentType: "stock",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage:
        "Sector is unknown. Add it only if it helps your portfolio review.",
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "other",
      sectorTypeConfidence: "reviewRequired",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
  });

  it("accepts only supported Yahoo quote types", () => {
    for (const quoteType of ["INDEX", "MUTUALFUND", "FUTURE", "OPTION"]) {
      expect(
        mapYahooQuoteToLookupResult({
          quoteType,
          shortname: "Unsupported",
          symbol: "TEST.NS",
        }),
      ).toBeUndefined();
    }
  });

  it("normalizes reliable Yahoo sector aliases and leaves unknown values unset", () => {
    expect(mapYahooSectorToSectorType("Financial Services")).toBe(
      "financialServices",
    );
    expect(mapYahooSectorToSectorType("Basic Materials")).toBe("materials");
    expect(mapYahooSectorToSectorType("Communication Services")).toBe(
      "communicationServices",
    );
    expect(mapYahooSectorToSectorType("Unmapped Sector")).toBeUndefined();
    expect(mapYahooSectorToSectorType(undefined)).toBeUndefined();

    expect(
      mapYahooQuoteToLookupResult({
        quoteType: "EQUITY",
        sectorDisp: "Technology",
        shortname: "Tech Company",
        symbol: "TECH.NS",
      }),
    ).toMatchObject({
      sectorType: "technology",
      sectorTypeConfidence: "provider",
    });
  });

  it("deduplicates, ranks, and caps combined provider results", () => {
    const makeResult = (
      id: string,
      name: string,
      symbol: string,
    ): AssetLookupResult => ({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id,
      instrumentType: "stock",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Review details.",
      name,
      provider: "yahoo",
      quoteSourceId: `${symbol}.NS`,
      sectorType: "other",
      sectorTypeConfidence: "reviewRequired",
      sourceLabel: "Yahoo Finance",
      symbol,
      ticker: `${symbol}.NS`,
    });
    const exact = makeResult("exact", "HDFC Bank", "HDFCBANK");
    const duplicate = { ...exact, id: "duplicate" };
    const others = Array.from({ length: 9 }, (_, index) =>
      makeResult(`other-${index}`, `Other ${index}`, `OTHER${index}`),
    );

    const results = prepareAssetLookupResults("HDFCBANK", [
      ...others,
      duplicate,
      exact,
    ]);

    expect(results).toHaveLength(8);
    expect(results[0]?.symbol).toBe("HDFCBANK");
    expect(
      results.filter((result) => result.quoteSourceId === "HDFCBANK.NS"),
    ).toHaveLength(1);
  });

  it("maps ETF-like Yahoo search results to ETF metadata", () => {
    expect(
      mapYahooQuoteToLookupResult({
        exchange: "NSI",
        quoteType: "ETF",
        shortname: "Nippon India ETF Nifty Bees",
        symbol: "NIFTYBEES.NS",
      }),
    ).toMatchObject({
      assetClass: "etf",
      instrumentType: "etf",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Provider details look ready. Confirm before saving.",
      sectorType: "diversified",
      sectorTypeConfidence: "inferred",
      symbol: "NIFTYBEES",
      ticker: "NIFTYBEES.NS",
    });
  });

  it("rejects foreign Yahoo results from the INR-only V1 lookup", () => {
    expect(
      mapYahooQuoteToLookupResult({
        exchange: "NMS",
        quoteType: "EQUITY",
        shortname: "Apple Inc.",
        symbol: "AAPL",
      }),
    ).toBeUndefined();
  });

  it("maps CoinGecko coins to crypto metadata with coin ID as quote source", () => {
    expect(
      mapCoinGeckoCoinToLookupResult({
        id: "bitcoin",
        name: "Bitcoin",
        symbol: "btc",
      }),
    ).toEqual({
      assetClass: "crypto",
      currency: "INR",
      exchange: "CRYPTO",
      id: "coingecko:bitcoin",
      instrumentType: "crypto",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Provider details look ready. Confirm before saving.",
      name: "Bitcoin",
      provider: "coingecko",
      quoteSourceId: "bitcoin",
      sectorType: "digitalAsset",
      sectorTypeConfidence: "inferred",
      sourceLabel: "CoinGecko",
      symbol: "BTC",
      ticker: "bitcoin",
    });
  });

  it("returns partial results when one provider fails", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response({}, false))
      .mockResolvedValueOnce(
        response({
          coins: [
            {
              id: "bitcoin",
              name: "Bitcoin",
              symbol: "btc",
            },
          ],
        }),
      );

    const result = await searchAssetLookupResults({ fetcher, query: "bitcoin" });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      provider: "coingecko",
      quoteSourceId: "bitcoin",
    });
    expect(result.failures).toEqual([
      "Yahoo lookup request failed with status 500.",
    ]);
  });
});
