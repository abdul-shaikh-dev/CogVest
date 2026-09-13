import { clearAmfiSchemeCatalogCacheForTests } from "@/src/services/mutualFunds/amfiSchemeCatalog";
import { refreshQuotes, resolveQuote } from "@/src/services/quotes";
import type { Asset, Quote } from "@/src/types";

const equityFund: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "cas:INF000000001",
  instrumentType: "mutualFund",
  isin: "INF000000001",
  name: "Example Equity Fund",
  sectorType: "other",
  symbol: "INF000000001",
  ticker: "INF000000001",
};

const liquidFund: Asset = {
  ...equityFund,
  assetClass: "debt",
  id: "cas:INF000000002",
  instrumentType: "liquidFund",
  isin: "INF000000002",
  name: "Example Liquid Fund",
  sectorType: "liquidity",
  symbol: "INF000000002",
  ticker: "INF000000002",
};

const arbitrageFund: Asset = {
  ...equityFund,
  id: "cas:INF000000003",
  instrumentType: "arbitrageFund",
  isin: "INF000000003",
  name: "Example Arbitrage Fund",
  symbol: "INF000000003",
  ticker: "INF000000003",
};

const fixture = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
  "Open Ended Schemes(Equity Scheme - Large Cap Fund)",
  "100001;INF000000001;-;Example Equity Fund;Direct Plan;Growth;123.4567;11-Sep-2026",
  "Open Ended Schemes(Debt Scheme - Liquid Fund)",
  "100002;INF000000002;-;Example Liquid Fund;Direct Plan;Growth;45.6789;11-Sep-2026",
  "Open Ended Schemes(Hybrid Scheme - Arbitrage Fund)",
  "100003;INF000000003;-;Example Arbitrage Fund;Direct Plan;Growth;67.89;11-Sep-2026",
].join("\n");

function amfiResponse(ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    text: jest.fn().mockResolvedValue(fixture),
  } as unknown as Response;
}

describe("AMFI current NAV quotes", () => {
  afterEach(clearAmfiSchemeCatalogCacheForTests);

  it("resolves an Equity mutual fund by exact ISIN without a market ticker", async () => {
    const result = await resolveQuote({
      asset: equityFund,
      fetcher: jest.fn().mockResolvedValue(amfiResponse()),
    });

    expect(result).toEqual({
      ok: true,
      quote: {
        assetId: equityFund.id,
        asOf: "2026-09-11T00:00:00.000Z",
        currency: "INR",
        price: 123.4567,
        source: "amfi",
      },
    });
  });

  it("refreshes Equity, Debt, liquid, and arbitrage funds from one catalogue download", async () => {
    const fetcher = jest.fn().mockResolvedValue(amfiResponse());
    const result = await refreshQuotes({
      assets: [equityFund, liquidFund, arbitrageFund],
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.failed).toEqual([]);
    expect(result.updated).toEqual([
      equityFund.id,
      liquidFund.id,
      arbitrageFund.id,
    ]);
    expect(result.quoteCache[liquidFund.id]).toMatchObject({
      price: 45.6789,
      source: "amfi",
    });
    expect(result.quoteCache[arbitrageFund.id]).toMatchObject({
      price: 67.89,
      source: "amfi",
    });
  });

  it("preserves a cached manual value when AMFI is unavailable", async () => {
    const cachedQuote: Quote = {
      assetId: liquidFund.id,
      asOf: "2026-09-10T10:00:00.000Z",
      currency: "INR",
      price: 44,
      source: "manual",
    };
    const result = await resolveQuote({
      asset: liquidFund,
      cachedQuote,
      fetcher: jest.fn().mockResolvedValue(amfiResponse(false)),
    });

    expect(result).toMatchObject({
      fallbackQuote: cachedQuote,
      ok: false,
    });
  });

  it("fails closed when the fund has no valid exact-ISIN NAV", async () => {
    const result = await resolveQuote({
      asset: { ...equityFund, isin: "INF000000099" },
      fetcher: jest.fn().mockResolvedValue(amfiResponse()),
    });

    expect(result).toEqual({
      error: "AMFI did not provide a valid current NAV for this ISIN.",
      ok: false,
    });
  });
});
