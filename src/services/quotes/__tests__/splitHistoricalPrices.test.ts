import { fetchYahooHistoricalPrice } from "../historicalPrices";
import {
  bonusShareCatalog,
  withVerifiedStockSplits,
} from "@/src/domain/stockSplitCatalog";
import type { Asset } from "@/src/types";

const asset: Asset = { id: "test", assetClass: "stock", currency: "INR", name: "Synthetic", symbol: "TEST", ticker: "TEST.NS", exchange: "NSE" };
it("does not stretch an old non-split price request to the current date", async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [{
    meta: { currency: "INR" }, timestamp: [Date.parse("2025-01-31T10:00:00Z") / 1000],
    indicators: { quote: [{ close: [50] }] },
    events: { splits: { later: { date: Date.parse("2025-02-01T10:00:00Z") / 1000 } } },
  }] } }) });
  const result = await fetchYahooHistoricalPrice({ asset, targetMonth: "2025-01", now: () => "2025-03-01T00:00:00Z", fetcher });
  expect(result).toMatchObject({ ok: false });
  expect(fetcher.mock.calls[0][0]).toContain("events=splits");
  expect(fetcher.mock.calls[0][0]).toContain(`period2=${Date.parse("2025-02-01T00:00:00Z") / 1000}`);
});

const relianceBonus = bonusShareCatalog.find(
  (event) => event.id === "RELIANCE-2024-10-28-bonus-v1",
)!;
const reliance: Asset = {
  ...asset,
  id: "reliance",
  isin: relianceBonus.newIsin,
  stockSplits: [relianceBonus],
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

it("converts a provider-adjusted close back to verified pre-bonus units", async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [{
    meta: { currency: "INR" }, timestamp: [Date.parse("2024-09-30T10:00:00Z") / 1000],
    indicators: { quote: [{ close: [1475] }] },
    events: { splits: { bonus: {
      date: Date.parse("2024-10-28T03:45:00Z") / 1000,
      denominator: 1,
      numerator: 2,
    } } },
  }] } }) });

  const result = await fetchYahooHistoricalPrice({
    asset: reliance,
    targetMonth: "2024-09",
    now: () => "2024-11-01T00:00:00Z",
    fetcher,
  });

  expect(result).toEqual({
    ok: true,
    quote: expect.objectContaining({
      assetId: reliance.id,
      asOfMonth: "2024-09",
      basis: "reconciled-historical-close",
      price: 2950,
    }),
  });
});

it("uses the verified ratio when provider ratio metadata is lossy", async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [{
    meta: { currency: "INR" }, timestamp: [Date.parse("2024-09-30T10:00:00Z") / 1000],
    indicators: { quote: [{ close: [1475] }] },
    events: { splits: { mismatch: {
      date: Date.parse("2024-10-28T03:45:00Z") / 1000,
      denominator: 1,
      numerator: 3,
    } } },
  }] } }) });

  const result = await fetchYahooHistoricalPrice({
    asset: reliance,
    targetMonth: "2024-09",
    now: () => "2024-11-01T00:00:00Z",
    fetcher,
  });

  expect(result).toEqual({
    ok: true,
    quote: expect.objectContaining({
      basis: "reconciled-historical-close",
      price: 2950,
    }),
  });
});

it("reconciles an aggregated same-day split and bonus chain", async () => {
  const easyTrip = withVerifiedStockSplits({
    ...asset,
    id: "easy-trip",
    isin: "INE07O001026",
    symbol: "EASEMYTRIP",
    ticker: "EASEMYTRIP.NS",
  });
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [{
    meta: { currency: "INR" }, timestamp: [Date.parse("2022-10-31T10:00:00Z") / 1000],
    indicators: { quote: [{ close: [50] }] },
    events: { splits: { combined: {
      date: Date.parse("2022-11-21T03:45:00Z") / 1000,
      denominator: 1,
      numerator: 4,
    } } },
  }] } }) });

  const result = await fetchYahooHistoricalPrice({
    asset: easyTrip,
    targetMonth: "2022-10",
    now: () => "2023-01-01T00:00:00Z",
    fetcher,
  });

  expect(result).toEqual({
    ok: true,
    quote: expect.objectContaining({
      basis: "reconciled-historical-close",
      price: 400,
    }),
  });
});

it("rejects a missing provider adjustment for a verified later event", async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [{
    meta: { currency: "INR" }, timestamp: [Date.parse("2024-09-30T10:00:00Z") / 1000],
    indicators: { quote: [{ close: [1475] }] },
  }] } }) });

  const result = await fetchYahooHistoricalPrice({
    asset: reliance,
    targetMonth: "2024-09",
    now: () => "2024-11-01T00:00:00Z",
    fetcher,
  });

  expect(result.ok).toBe(false);
});

it("rejects an unknown provider adjustment date", async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [{
    meta: { currency: "INR" }, timestamp: [Date.parse("2024-09-30T10:00:00Z") / 1000],
    indicators: { quote: [{ close: [1475] }] },
    events: { splits: { unknown: {
      date: Date.parse("2024-10-29T03:45:00Z") / 1000,
      denominator: 1,
      numerator: 2,
    } } },
  }] } }) });

  const result = await fetchYahooHistoricalPrice({
    asset: reliance,
    targetMonth: "2024-09",
    now: () => "2024-11-01T00:00:00Z",
    fetcher,
  });

  expect(result.ok).toBe(false);
});
