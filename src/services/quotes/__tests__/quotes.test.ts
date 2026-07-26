import {
  fetchCoinGeckoQuote,
  fetchYahooQuote,
  refreshQuotes,
  resolveQuote,
} from "@/src/services/quotes";
import type { Asset, Quote } from "@/src/types";

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

const ppf: Asset = {
  assetClass: "debt",
  currency: "INR",
  id: "asset-ppf",
  instrumentType: "ppf",
  name: "Public Provident Fund",
  quoteSourceId: "PPF",
  sectorType: "fixedIncome",
  symbol: "PPF",
  ticker: "PPF",
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

afterEach(() => {
  jest.useRealTimers();
});

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
                currency: "INR",
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

  it("rejects a Yahoo price whose provider currency is not INR", async () => {
    const result = await fetchYahooQuote({
      asset: reliance,
      fetcher: jest.fn().mockResolvedValue(
        response({
          chart: {
            result: [
              {
                meta: {
                  currency: "USD",
                  regularMarketPrice: 101,
                },
              },
            ],
          },
        }),
      ),
    });

    expect(result).toEqual({
      error: "Yahoo quote currency was not INR; the price was not accepted.",
      ok: false,
    });
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

  it("uses the cached manual quote directly for debt assets", async () => {
    const fetcher = jest.fn();
    const cachedQuote: Quote = {
      assetId: ppf.id,
      asOf: "2026-04-20T10:00:00.000Z",
      currency: "INR",
      price: 1,
      source: "manual",
    };

    const result = await resolveQuote({
      asset: ppf,
      cachedQuote,
      fetcher,
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      quote: cachedQuote,
    });
  });

  it("preserves a cached CoinGecko quote when CoinGecko fails", async () => {
    const cachedQuote: Quote = {
      assetId: bitcoin.id,
      asOf: "2026-04-20T10:00:00.000Z",
      currency: "INR",
      dayChangeAbs: -45000,
      dayChangePct: -0.78,
      price: 5700000,
      source: "coingecko",
    };
    const result = await resolveQuote({
      asset: bitcoin,
      cachedQuote,
      fetcher: jest.fn().mockResolvedValue(response({}, false)),
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(result).toEqual({
      error: "CoinGecko quote request failed with status 500.",
      fallbackQuote: cachedQuote,
      ok: false,
    });
  });

  it("preserves Yahoo provenance and timestamp when provider fetch fails", async () => {
    const cachedQuote: Quote = {
      assetId: reliance.id,
      asOf: "2026-04-20T10:00:00.000Z",
      currency: "INR",
      dayChangeAbs: 25,
      dayChangePct: 0.9,
      price: 2800,
      source: "yahoo",
    };
    const result = await resolveQuote({
      asset: reliance,
      cachedQuote,
      fetcher: jest.fn().mockResolvedValue(response({}, false)),
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(result).toEqual({
      error: "Yahoo quote request failed with status 500.",
      fallbackQuote: cachedQuote,
      ok: false,
    });
  });

  it("preserves a genuine manual quote and its original timestamp", async () => {
    const cachedQuote: Quote = {
      assetId: reliance.id,
      asOf: "2026-04-19T09:30:00.000Z",
      currency: "INR",
      price: 2750,
      source: "manual",
    };

    const result = await resolveQuote({
      asset: reliance,
      cachedQuote,
      fetcher: jest.fn().mockResolvedValue(response({}, false)),
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(result).toMatchObject({
      fallbackQuote: cachedQuote,
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

    const staleRelianceQuote: Quote = {
      assetId: reliance.id,
      asOf: "2026-04-17T10:00:00.000Z",
      currency: "INR",
      price: 95,
      source: "yahoo",
    };
    const cachedQuote: Quote = {
      assetId: niftyBees.id,
      asOf: "2026-04-18T10:00:00.000Z",
      currency: "INR",
      dayChangeAbs: 2,
      dayChangePct: 0.8,
      price: 250,
      source: "yahoo",
    };
    const result = await refreshQuotes({
      assets: [reliance, niftyBees],
      cachedQuotes: {
        [reliance.id]: staleRelianceQuote,
        [niftyBees.id]: cachedQuote,
      },
      fetcher,
      now: () => "2026-04-26T10:00:00.000Z",
    });

    expect(result.quoteCache[reliance.id]).toMatchObject({
      asOf: "2026-04-26T10:00:00.000Z",
      price: 101,
      source: "yahoo",
    });
    expect(result.quoteCache[niftyBees.id]).toEqual(cachedQuote);
    expect(result.updated).toEqual([reliance.id]);
    expect(result.failed).toEqual([
      {
        assetId: niftyBees.id,
        error: "Yahoo quote request failed with status 500.",
      },
    ]);
    expect(result.timedOut).toEqual([]);
  });

  it("times out a hung provider without discarding its cached quote", async () => {
    jest.useFakeTimers();
    const cachedQuote: Quote = {
      assetId: reliance.id,
      asOf: "2026-04-20T10:00:00.000Z",
      currency: "INR",
      price: 2800,
      source: "yahoo",
    };
    const refreshPromise = refreshQuotes({
      assets: [reliance],
      cachedQuotes: { [reliance.id]: cachedQuote },
      fetcher: jest.fn().mockReturnValue(new Promise(() => {})),
    });

    await jest.advanceTimersByTimeAsync(10_000);
    const result = await refreshPromise;

    expect(result).toEqual({
      failed: [],
      quoteCache: { [reliance.id]: cachedQuote },
      timedOut: [
        {
          assetId: reliance.id,
          error: "Quote provider did not respond within 10 seconds.",
        },
      ],
      updated: [],
    });
  });

  it("keeps successful updates when another provider attempt times out", async () => {
    jest.useFakeTimers();
    const cachedEtfQuote: Quote = {
      assetId: niftyBees.id,
      asOf: "2026-04-20T10:00:00.000Z",
      currency: "INR",
      price: 250,
      source: "yahoo",
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          chart: {
            result: [
              {
                meta: {
                  currency: "INR",
                  regularMarketPrice: 101,
                },
              },
            ],
          },
        }),
      )
      .mockReturnValueOnce(new Promise(() => {}));
    const refreshPromise = refreshQuotes({
      assets: [reliance, niftyBees],
      cachedQuotes: { [niftyBees.id]: cachedEtfQuote },
      fetcher,
      now: () => "2026-04-26T10:00:00.000Z",
    });

    await jest.advanceTimersByTimeAsync(10_000);
    const result = await refreshPromise;

    expect(result.updated).toEqual([reliance.id]);
    expect(result.quoteCache[reliance.id]).toMatchObject({
      price: 101,
      source: "yahoo",
    });
    expect(result.quoteCache[niftyBees.id]).toEqual(cachedEtfQuote);
    expect(result.timedOut).toEqual([
      {
        assetId: niftyBees.id,
        error: "Quote provider did not respond within 10 seconds.",
      },
    ]);
  });

  it("does not let a late provider completion change a timed-out result", async () => {
    jest.useFakeTimers();
    let finishRequest!: (value: Response) => void;
    const fetcher = jest.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        finishRequest = resolve;
      }),
    );
    const refreshPromise = refreshQuotes({
      assets: [reliance],
      fetcher,
    });

    await jest.advanceTimersByTimeAsync(10_000);
    const result = await refreshPromise;

    finishRequest(
      response({
        chart: {
          result: [
            {
              meta: {
                currency: "INR",
                regularMarketPrice: 3000,
              },
            },
          ],
        },
      }),
    );
    await Promise.resolve();

    expect(result.updated).toEqual([]);
    expect(result.quoteCache).toEqual({});
    expect(result.timedOut).toHaveLength(1);
  });

  it("cancels active attempts without accepting late provider values", async () => {
    const controller = new AbortController();
    let finishRequest!: (value: Response) => void;
    const cachedQuote: Quote = {
      assetId: reliance.id,
      asOf: "2026-04-20T10:00:00.000Z",
      currency: "INR",
      price: 2800,
      source: "yahoo",
    };
    const fetcher = jest.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        finishRequest = resolve;
      }),
    );
    const refreshPromise = refreshQuotes({
      assets: [reliance],
      cachedQuotes: { [reliance.id]: cachedQuote },
      fetcher,
      signal: controller.signal,
    });

    controller.abort();
    const result = await refreshPromise;

    finishRequest(
      response({
        chart: {
          result: [
            {
              meta: {
                currency: "INR",
                regularMarketPrice: 3000,
              },
            },
          ],
        },
      }),
    );
    await Promise.resolve();

    expect(result).toEqual({
      failed: [
        {
          assetId: reliance.id,
          error: "Quote refresh was cancelled.",
        },
      ],
      quoteCache: { [reliance.id]: cachedQuote },
      timedOut: [],
      updated: [],
    });
  });

  it("refreshes at most four provider assets concurrently", async () => {
    const providerAssets = Array.from({ length: 5 }, (_, index) => ({
      ...reliance,
      id: `asset-${index}`,
      ticker: `ASSET${index}.NS`,
    }));
    const resolvers: Array<(value: Response) => void> = [];
    const fetcher = jest.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const refreshPromise = refreshQuotes({
      assets: providerAssets,
      fetcher,
      now: () => "2026-04-26T10:00:00.000Z",
    });

    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(4);

    resolvers[0](
      response({
        chart: {
          result: [
            {
              meta: {
                currency: "INR",
                regularMarketPrice: 101,
              },
            },
          ],
        },
      }),
    );
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(fetcher).toHaveBeenCalledTimes(5);

    for (const resolve of resolvers.slice(1)) {
      resolve(
        response({
          chart: {
            result: [
              {
                meta: {
                  currency: "INR",
                  regularMarketPrice: 101,
                },
              },
            ],
          },
        }),
      );
    }

    const result = await refreshPromise;

    expect(result.updated).toEqual(providerAssets.map((asset) => asset.id));
    expect(result.failed).toEqual([]);
    expect(result.timedOut).toEqual([]);
  });
});
