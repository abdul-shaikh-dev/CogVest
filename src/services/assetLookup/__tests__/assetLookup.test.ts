import {
  assetLookupPageSize,
  buildCoinGeckoSearchUrl,
  buildYahooSearchUrl,
  getAssetLookupResultsPage,
  mapCoinGeckoCoinToLookupResult,
  maxAssetLookupResults,
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
      "https://query2.finance.yahoo.com/v1/finance/search?q=hdfc+bank&quotesCount=100&newsCount=0",
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

  function makeResult({
    exchange = "NSE",
    id,
    name,
    provider = "yahoo",
    symbol,
    quoteSourceId = `${symbol}.NS`,
    ticker = `${symbol}.NS`,
  }: {
    exchange?: AssetLookupResult["exchange"];
    id: string;
    name: string;
    provider?: AssetLookupResult["provider"];
    quoteSourceId?: string;
    symbol: string;
    ticker?: string;
  }): AssetLookupResult {
    return {
      assetClass: "stock",
      currency: "INR",
      exchange,
      id,
      instrumentType: "stock",
      instrumentTypeConfidence: "inferred",
      metadataReviewMessage: "Review details.",
      name,
      provider,
      quoteSourceId,
      sectorType: "other",
      sectorTypeConfidence: "reviewRequired",
      sourceLabel: "Yahoo Finance",
      symbol,
      ticker,
    };
  }

  it("deduplicates canonical identities, ranks exact provider fields, and caps results", () => {
    const exact = makeResult({ id: "exact", name: "HDFC Bank", symbol: "HDFCBANK" });
    const duplicate = { ...exact, id: "duplicate" };
    const others = Array.from({ length: 9 }, (_, index) =>
      makeResult({ id: `other-${index}`, name: `Other ${index}`, symbol: `OTHER${index}` }),
    );

    const results = prepareAssetLookupResults("HDFCBANK", [
      ...others,
      duplicate,
      exact,
    ]);

    expect(results).toHaveLength(10);
    expect(results[0]?.symbol).toBe("HDFCBANK");
    expect(
      results.filter((result) => result.quoteSourceId === "HDFCBANK.NS"),
    ).toHaveLength(1);
  });

  it("ranks exact symbol, ticker, and quote-source matches ahead of name matches", () => {
    const results = prepareAssetLookupResults("HDFC.NS", [
      makeResult({ id: "name", name: "HDFC.NS Holdings", symbol: "HOLDINGS" }),
      makeResult({ id: "source", name: "Source match", quoteSourceId: " hdfc.ns ", symbol: "SOURCE" }),
      makeResult({ id: "ticker", name: "Ticker match", quoteSourceId: "ticker-provider", symbol: "TICKER", ticker: "HDFC.NS" }),
      makeResult({ id: "symbol", name: "Symbol match", quoteSourceId: "symbol-provider", symbol: "HDFC.NS", ticker: "SYMBOL.NS" }),
    ]);

    expect(results.slice(0, 3).map((result) => result.id)).toEqual([
      "source",
      "symbol",
      "ticker",
    ]);
    expect(results[3]?.id).toBe("name");
  });

  it("does not conflate exchange-specific securities or crypto sharing a symbol", () => {
    const results = prepareAssetLookupResults("ABC", [
      makeResult({ id: "nse", name: "ABC NSE", quoteSourceId: "ABC.NS", symbol: "ABC" }),
      makeResult({ exchange: "BSE", id: "bse", name: "ABC BSE", quoteSourceId: "ABC.BO", symbol: "ABC", ticker: "ABC.BO" }),
      makeResult({ exchange: "CRYPTO", id: "coin-a", name: "Alpha Coin", provider: "coingecko", quoteSourceId: "alpha-coin", symbol: "ABC", ticker: "alpha-coin" }),
      makeResult({ exchange: "CRYPTO", id: "coin-b", name: "Beta Coin", provider: "coingecko", quoteSourceId: "beta-coin", symbol: "ABC", ticker: "beta-coin" }),
    ]);

    expect(results.map((result) => result.id)).toEqual([
      "bse",
      "nse",
      "coin-a",
      "coin-b",
    ]);
  });

  it("deduplicates same-exchange tickers even when quote-source IDs differ", () => {
    const first = makeResult({
      id: "first",
      name: "First listing",
      quoteSourceId: "first-provider-id",
      symbol: "ABC",
      ticker: "ABC.NS",
    });
    const duplicate = makeResult({
      id: "duplicate",
      name: "Duplicate listing",
      quoteSourceId: "different-provider-id",
      symbol: "ABC",
      ticker: " abc.ns ",
    });

    expect(prepareAssetLookupResults("ABC", [first, duplicate])).toEqual([first]);
  });

  it("returns 20-result pages without allowing a page beyond the 100-result cap", () => {
    const results = Array.from({ length: 125 }, (_, index) =>
      makeResult({ id: `asset-${index}`, name: `Asset ${index}`, quoteSourceId: `asset-${index}.NS`, symbol: `ASSET${index}` }),
    );
    const prepared = prepareAssetLookupResults("asset", results);

    expect(prepared).toHaveLength(maxAssetLookupResults);
    expect(getAssetLookupResultsPage(prepared)).toHaveLength(assetLookupPageSize);
    expect(getAssetLookupResultsPage(prepared, 4)).toHaveLength(assetLookupPageSize);
    expect(getAssetLookupResultsPage(results, 4)).toHaveLength(assetLookupPageSize);
    expect(getAssetLookupResultsPage(results, 5)).toEqual([]);
  });

  it("keeps canonical identity and result caps under 200-provider-candidate stress", () => {
    const candidates = Array.from({ length: 200 }, (_, index) =>
      makeResult({ id: `candidate-${index}`, name: `Candidate ${index}`, quoteSourceId: `candidate-${index}.NS`, symbol: `CANDIDATE${index}` }),
    );
    const exact = makeResult({ id: "exact", name: "Exact candidate", quoteSourceId: "MATCH.NS", symbol: "MATCH" });
    const duplicate = { ...exact, id: "duplicate" };
    const results = prepareAssetLookupResults("match", [...candidates, duplicate, exact]);

    expect(results).toHaveLength(maxAssetLookupResults);
    expect(results[0]?.id).toBe("duplicate");
    expect(results.filter((result) => result.quoteSourceId === "MATCH.NS")).toHaveLength(1);
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

  it("forwards an optional abort signal to both provider requests", async () => {
    const fetcher = jest.fn().mockResolvedValue(response({}));
    const controller = new AbortController();

    await searchAssetLookupResults({
      fetcher,
      query: "bitcoin",
      signal: controller.signal,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      { signal: controller.signal },
    );
  });
});
