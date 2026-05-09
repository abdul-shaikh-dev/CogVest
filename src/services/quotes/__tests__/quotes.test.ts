import {
  fetchCoinGeckoQuote,
  fetchYahooQuote,
  refreshQuotes,
  resolveQuote,
} from "@/src/services/quotes";
import type { Asset } from "@/src/types";

const reliance: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-reliance",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const niftyBees: Asset = {
  assetClass: "etf",
  currency: "INR",
  exchange: "NSE",
  id: "asset-niftybees",
  name: "Nippon India ETF Nifty Bees",
  symbol: "NIFTYBEES",
  ticker: "NIFTYBEES.NS",
};

const bitcoin: Asset = {
  assetClass: "crypto",
  currency: "INR",
  exchange: "CRYPTO",
  id: "asset-btc",
  name: "Bitcoin",
  symbol: "BTC",
  ticker: "bitcoin",
};

function response(payload: unknown, ok = true): Response {
  return {
    json: jest.fn().mockResolvedValue(payload),
    ok,
    status: ok ? 200 : 500,
  } as unknown as Response;
}

describe("Yahoo quote service", () => {
  it("maps a Yahoo chart response to an INR quote", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        chart: {
          result: [
            {
              meta: {
                chartPreviousClose: 2850,
                currency: "INR",
                regularMarketPrice: 2910,
              },
            },
          ],
        },
      }),
    );

    const result = await fetchYahooQuote({
      asset: reliance,
      fetcher,
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?range=1d&interval=1d",
    );
    expect(result).toEqual({
      ok: true,
      quote: {
        assetId: reliance.id,
        asOf: "2026-04-26T10:00:00.000Z",
        currency: "INR",
        dayChangeAbs: 60,
        dayChangePct: 2.11,
        price: 2910,
        source: "yahoo",
      },
    });
  });

  it("returns an error result instead of throwing on Yahoo failure", async () => {
    const result = await fetchYahooQuote({
      asset: reliance,
      fetcher: jest.fn().mockResolvedValue(response({}, false)),
    });

    expect(result.ok).toBe(false);
  });

  it("uses quote source ID when it differs from display ticker", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 101,
              },
            },
          ],
        },
      }),
    );

    await fetchYahooQuote({
      asset: { ...reliance, quoteSourceId: "RELIANCE.BO" },
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.BO?range=1d&interval=1d",
    );
  });
});

describe("CoinGecko quote service", () => {
  it("maps a CoinGecko simple price response to an INR quote", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        bitcoin: {
          inr: 5800000,
          inr_24h_change: 1.234,
        },
      }),
    );

    const result = await fetchCoinGeckoQuote({
      asset: bitcoin,
      fetcher,
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=inr&include_24hr_change=true",
    );
    expect(result).toEqual({
      ok: true,
      quote: {
        assetId: bitcoin.id,
        asOf: "2026-04-26T10:00:00.000Z",
        currency: "INR",
        dayChangePct: 1.23,
        price: 5800000,
        source: "coingecko",
      },
    });
  });

  it("uses crypto quote source ID when it differs from ticker", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        ethereum: {
          inr: 320000,
        },
      }),
    );

    const result = await fetchCoinGeckoQuote({
      asset: { ...bitcoin, quoteSourceId: "ethereum" },
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=inr&include_24hr_change=true",
    );
    expect(result.ok && result.quote.price).toBe(320000);
  });
});

describe("quote resolver", () => {
  it("chooses Yahoo for stocks and ETFs", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        chart: {
          result: [
            {
              meta: {
                chartPreviousClose: 100,
                currency: "INR",
                regularMarketPrice: 101,
              },
            },
          ],
        },
      }),
    );

    const stockResult = await resolveQuote({ asset: reliance, fetcher });
    const etfResult = await resolveQuote({ asset: niftyBees, fetcher });

    expect(stockResult.ok).toBe(true);
    expect(etfResult.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("chooses CoinGecko for crypto", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        bitcoin: {
          inr: 5800000,
        },
      }),
    );

    const result = await resolveQuote({ asset: bitcoin, fetcher });

    expect(result.ok).toBe(true);
    expect(result.ok && result.quote.source).toBe("coingecko");
  });

  it("uses manual fallback when provider fetch fails", async () => {
    const result = await resolveQuote({
      asset: reliance,
      fetcher: jest.fn().mockResolvedValue(response({}, false)),
      manualPrice: 2800,
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(result).toEqual({
      error: "Yahoo quote request failed with status 500.",
      fallbackQuote: {
        assetId: reliance.id,
        asOf: "2026-04-26T10:00:00.000Z",
        currency: "INR",
        price: 2800,
        source: "manual",
      },
      ok: false,
    });
  });

  it("refreshes multiple quotes and separates failures from quote cache", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          chart: {
            result: [
              {
                meta: {
                  chartPreviousClose: 100,
                  currency: "INR",
                  regularMarketPrice: 101,
                },
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(response({}, false));

    const result = await refreshQuotes({
      assets: [reliance, niftyBees],
      fetcher,
      manualPrices: {
        [niftyBees.id]: 250,
      },
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(result.quoteCache[reliance.id]?.source).toBe("yahoo");
    expect(result.quoteCache[niftyBees.id]?.source).toBe("manual");
    expect(result.failures).toEqual([
      {
        assetId: niftyBees.id,
        error: "Yahoo quote request failed with status 500.",
      },
    ]);
  });
});
