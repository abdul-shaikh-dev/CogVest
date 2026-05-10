import {
  buildCoinGeckoSearchUrl,
  buildYahooSearchUrl,
  mapCoinGeckoCoinToLookupResult,
  mapYahooQuoteToLookupResult,
  searchAssetLookupResults,
} from "@/src/services/assetLookup";

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
      name: "HDFC Bank Limited",
      provider: "yahoo",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices",
      sourceLabel: "Yahoo Finance",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
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
      sectorType: "diversified",
      symbol: "NIFTYBEES",
      ticker: "NIFTYBEES.NS",
    });
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
      name: "Bitcoin",
      provider: "coingecko",
      quoteSourceId: "bitcoin",
      sectorType: "digitalAsset",
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
