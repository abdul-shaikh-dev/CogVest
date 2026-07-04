import {
  buildCoinGeckoHistoricalRangeUrl,
  buildYahooHistoricalChartUrl,
  fetchCoinGeckoHistoricalPrice,
  fetchYahooHistoricalPrice,
  resolveHistoricalPrice,
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

const cashAsset: Asset = {
  assetClass: "cash",
  currency: "INR",
  id: "asset-cash",
  name: "Cash",
  symbol: "CASH",
  ticker: "CASH",
};

const debtAsset: Asset = {
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

function response(payload: unknown, ok = true): Response {
  return {
    json: jest.fn().mockResolvedValue(payload),
    ok,
    status: ok ? 200 : 500,
  } as unknown as Response;
}

describe("historical Yahoo quote service", () => {
  it("builds Yahoo historical chart URLs around the target month end", () => {
    const url = buildYahooHistoricalChartUrl("RELIANCE.NS", "2026-07");

    expect(url).toContain(
      "https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?",
    );
    expect(url).toContain("interval=1d");
    expect(url).toContain("period1=1784332800");
    expect(url).toContain("period2=1785542400");
  });

  it("maps the latest finite close on or before month end", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        chart: {
          result: [
            {
              indicators: {
                quote: [
                  {
                    close: [2800, Number.NaN, 2910, 3000],
                  },
                ],
              },
              timestamp: [1785369600, 1785456000, 1785542399, 1785542400],
            },
          ],
        },
      }),
    );

    const result = await fetchYahooHistoricalPrice({
      asset: reliance,
      fetcher,
      now: () => "2026-08-01T04:00:00.000Z",
      targetMonth: "2026-07",
    });

    expect(result).toEqual({
      ok: true,
      quote: {
        assetId: reliance.id,
        asOfMonth: "2026-07",
        basis: "historical-close",
        currency: "INR",
        fetchedAt: "2026-08-01T04:00:00.000Z",
        price: 2910,
        source: "yahoo",
      },
    });
  });

  it("returns ok false when the response is not ok", async () => {
    const result = await fetchYahooHistoricalPrice({
      asset: reliance,
      fetcher: jest.fn().mockResolvedValue(response({}, false)),
      targetMonth: "2026-07",
    });

    expect(result).toEqual({
      error: "Yahoo historical price request failed with status 500.",
      ok: false,
    });
  });

  it("returns ok false when no usable close exists", async () => {
    const result = await fetchYahooHistoricalPrice({
      asset: reliance,
      fetcher: jest.fn().mockResolvedValue(
        response({
          chart: {
            result: [
              {
                indicators: {
                  quote: [
                    {
                      close: [undefined, Number.NaN],
                    },
                  ],
                },
                timestamp: [1785456000, 1785542400],
              },
            ],
          },
        }),
      ),
      targetMonth: "2026-07",
    });

    expect(result).toEqual({
      error: "Yahoo historical price response did not include a usable close.",
      ok: false,
    });
  });
});

describe("historical CoinGecko quote service", () => {
  it("builds CoinGecko historical range URLs in INR", () => {
    const url = buildCoinGeckoHistoricalRangeUrl("bitcoin", "2026-07");

    expect(url).toContain(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?",
    );
    expect(url).toContain("vs_currency=inr");
    expect(url).toContain("from=1785283200");
    expect(url).toContain("to=1785542400");
  });

  it("maps the latest price point on or before month end", async () => {
    const fetcher = jest.fn().mockResolvedValue(
        response({
          prices: [
            [1785456000000, 5680000.129],
            [1785542399000, 5800000.555],
            [1785542400000, 5900000],
          ],
        }),
      );

    const result = await fetchCoinGeckoHistoricalPrice({
      asset: bitcoin,
      fetcher,
      now: () => "2026-08-01T04:00:00.000Z",
      targetMonth: "2026-07",
    });

    expect(result).toEqual({
      ok: true,
      quote: {
        assetId: bitcoin.id,
        asOfMonth: "2026-07",
        basis: "historical-close",
        currency: "INR",
        fetchedAt: "2026-08-01T04:00:00.000Z",
        price: 5800000.56,
        source: "coingecko",
      },
    });
  });

  it("returns ok false on provider failure", async () => {
    const result = await fetchCoinGeckoHistoricalPrice({
      asset: bitcoin,
      fetcher: jest.fn().mockResolvedValue(response({}, false)),
      targetMonth: "2026-07",
    });

    expect(result).toEqual({
      error: "CoinGecko historical price request failed with status 500.",
      ok: false,
    });
  });

  it("returns ok false when no usable price exists", async () => {
    const result = await fetchCoinGeckoHistoricalPrice({
      asset: bitcoin,
      fetcher: jest.fn().mockResolvedValue(
        response({
          prices: [
            [1785542400000, 5900000],
            [1785542401000, Number.NaN],
          ],
        }),
      ),
      targetMonth: "2026-07",
    });

    expect(result).toEqual({
      error: "CoinGecko historical price response did not include a usable INR price.",
      ok: false,
    });
  });
});

describe("historical quote resolver", () => {
  it("chooses Yahoo for stock and ETF assets", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(
        response({
          chart: {
            result: [
              {
                indicators: {
                  quote: [
                    {
                      close: [2910],
                    },
                  ],
                },
                timestamp: [1785542399],
              },
            ],
          },
        }),
      );

    const stockResult = await resolveHistoricalPrice({
      asset: reliance,
      fetcher,
      targetMonth: "2026-07",
    });
    const etfResult = await resolveHistoricalPrice({
      asset: niftyBees,
      fetcher,
      targetMonth: "2026-07",
    });

    expect(stockResult.ok).toBe(true);
    expect(etfResult.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("chooses CoinGecko for crypto", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        prices: [[1785542399000, 5800000]],
      }),
    );

    const result = await resolveHistoricalPrice({
      asset: bitcoin,
      fetcher,
      targetMonth: "2026-07",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.quote.source).toBe("coingecko");
  });

  it("returns ok false for cash and debt assets", async () => {
    const fetcher = jest.fn();

    const cashResult = await resolveHistoricalPrice({
      asset: cashAsset,
      fetcher,
      targetMonth: "2026-07",
    });
    const debtResult = await resolveHistoricalPrice({
      asset: debtAsset,
      fetcher,
      targetMonth: "2026-07",
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(cashResult).toEqual({
      error: "Historical provider prices are not available for this asset class.",
      ok: false,
    });
    expect(debtResult).toEqual({
      error: "Historical provider prices are not available for this asset class.",
      ok: false,
    });
  });
});
