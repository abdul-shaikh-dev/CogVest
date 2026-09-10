import { fetchAssetHistory, getAssetHistoryRequest } from "@/src/services/quotes/assetHistoryProvider";
import type { Asset } from "@/src/types";

const now = new Date("2026-01-10T12:00:00.000Z");
const stock: Asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "stock",
  name: "Stock", quoteSourceId: "STOCK.NS", symbol: "STOCK", ticker: "STOCK.NS",
};
const crypto: Asset = {
  assetClass: "crypto", currency: "USD", exchange: "CRYPTO", id: "crypto",
  name: "Crypto", quoteSourceId: "bitcoin", symbol: "BTC", ticker: "bitcoin",
};

function response(payload: unknown, status = 200): Response {
  return {
    headers: { get: () => null }, text: jest.fn().mockResolvedValue(JSON.stringify(payload)), ok: status >= 200 && status < 300, status,
  } as unknown as Response;
}

describe("getAssetHistoryRequest", () => {
  it("maps supported INR Yahoo and native-currency CoinGecko assets", () => {
    expect(getAssetHistoryRequest(stock, "2026-01-01", "2026-01-02"))
      .toMatchObject({ provider: "yahoo", providerId: "STOCK.NS", currency: "INR", basis: "close" });
    expect(getAssetHistoryRequest(crypto, "2026-01-01", "2026-01-02"))
      .toMatchObject({ provider: "coingecko", providerId: "bitcoin", currency: "USD" });
  });

  it("excludes unsupported instruments, currencies, missing crypto ids, and invalid ranges", () => {
    expect(getAssetHistoryRequest({ ...stock, currency: "USD" }, "2026-01-01", "2026-01-02")).toBeNull();
    expect(getAssetHistoryRequest({ ...stock, instrumentType: "mutualFund" }, "2026-01-01", "2026-01-02")).toBeNull();
    expect(getAssetHistoryRequest({ ...crypto, quoteSourceId: undefined }, "2026-01-01", "2026-01-02")).toBeNull();
    expect(getAssetHistoryRequest({ ...crypto, quoteSourceId: " bitcoin " }, "2026-01-01", "2026-01-02")).toBeNull();
    expect(getAssetHistoryRequest(stock, "bad", "2026-01-02")).toBeNull();
    expect(getAssetHistoryRequest(stock, "2010-01-01", "2020-01-02")).toBeNull();
  });
});

describe("fetchAssetHistory", () => {
  it("uses Yahoo close values in exchange-calendar order and forwards the signal", async () => {
    const request = getAssetHistoryRequest(stock, "2026-01-01", "2026-01-03")!;
    const signal = new AbortController().signal;
    const fetcher = jest.fn().mockResolvedValue(response({
      chart: { result: [{
        meta: { currency: "INR", exchangeTimezoneName: "Asia/Kolkata" },
        indicators: { quote: [{ close: [101, null, 100] }] },
        timestamp: [1767398400, 1767312000, 1767225600],
      }] },
    }));

    const entry = await fetchAssetHistory(request, signal, fetcher, now);

    expect(fetcher.mock.calls[0][1]).toEqual({ signal });
    expect(fetcher.mock.calls[0][0]).toContain("events=splits");
    expect(fetcher.mock.calls[0][0]).toContain("period2=1768089600");
    expect(entry.complete).toBe(false);
    expect(entry.points).toEqual([
      { close: 100, date: "2026-01-01" },
      { close: 101, date: "2026-01-03" },
    ]);
  });

  it("omits conflicting Yahoo duplicate dates and rejects corporate-action history", async () => {
    const request = getAssetHistoryRequest(stock, "2026-01-01", "2026-01-03")!;
    const conflict = await fetchAssetHistory(request, undefined, jest.fn().mockResolvedValue(response({
      chart: { result: [{
        meta: { currency: "INR", gmtoffset: 0 },
        indicators: { quote: [{ close: [100, 101, 102] }] },
        timestamp: [1767225600, 1767229200, 1767398400],
      }] },
    })), now);
    expect(conflict.complete).toBe(false);
    expect(conflict.points).toEqual([{ close: 102, date: "2026-01-03" }]);

    await expect(fetchAssetHistory(request, undefined, jest.fn().mockResolvedValue(response({
      chart: { result: [{
        events: { splits: { split: { date: 1767484800 } } },
        meta: { currency: "INR" }, indicators: { quote: [{ close: [100] }] }, timestamp: [1767225600],
      }] },
    })), now)).rejects.toMatchObject({ kind: "corporate-action" });
  });

  it("maps only CoinGecko midnight observations to the preceding UTC date", async () => {
    const request = getAssetHistoryRequest(crypto, "2026-01-01", "2026-01-03")!;
    const fetcher = jest.fn().mockResolvedValue(response({
      prices: [
        [1767398400000, 11], [1767312000000, 10], [1767484800000, 12],
      ],
    }));
    const entry = await fetchAssetHistory(request, undefined, fetcher, now);

    expect(entry.currency).toBe("USD");
    expect(entry.complete).toBe(true);
    expect(entry.points).toEqual([
      { close: 10, date: "2026-01-01" },
      { close: 11, date: "2026-01-02" },
      { close: 12, date: "2026-01-03" },
    ]);
    expect(fetcher.mock.calls[0][0]).toContain("interval=daily");
    expect(fetcher.mock.calls[0][0]).toContain("from=1767312000");
    expect(fetcher.mock.calls[0][0]).toContain("to=1767484801");
  });

  it("skips non-midnight crypto observations and omits conflicting daily data", async () => {
    const request = getAssetHistoryRequest(crypto, "2026-01-01", "2026-01-03")!;
    const entry = await fetchAssetHistory(request, undefined, jest.fn().mockResolvedValue(response({
      prices: [
        [1767312000000, 10], [1767398400000, 11], [1767398400000, 12],
        [1767484800000, 13], [1767441600000, 99],
      ],
    })), now);
    expect(entry.complete).toBe(false);
    expect(entry.points.map((point) => point.date)).toEqual(["2026-01-01", "2026-01-03"]);

    await expect(fetchAssetHistory({ ...request, basis: "adjusted-close" }, undefined, jest.fn(), now))
      .rejects.toMatchObject({ kind: "unsupported" });
  });

  it("returns typed provider failures for rate limits, invalid payloads, and offline fetches", async () => {
    const request = getAssetHistoryRequest(stock, "2026-01-01", "2026-01-03")!;
    await expect(fetchAssetHistory(request, undefined, jest.fn().mockResolvedValue(response({}, 429)), now))
      .rejects.toMatchObject({ kind: "rate-limited" });
    await expect(fetchAssetHistory(request, undefined, jest.fn().mockResolvedValue(response({}, 500)), now))
      .rejects.toMatchObject({ kind: "provider-error" });
    await expect(fetchAssetHistory(request, undefined, jest.fn().mockResolvedValue(response({ chart: { result: [] } })), now))
      .rejects.toMatchObject({ kind: "invalid-data" });
    await expect(fetchAssetHistory(request, undefined, jest.fn().mockResolvedValue(response({
      chart: { result: [{ meta: { currency: "USD" } }] },
    })), now)).rejects.toMatchObject({ kind: "invalid-data" });
    await expect(fetchAssetHistory(request, undefined, jest.fn().mockRejectedValue(new Error("offline")), now))
      .rejects.toMatchObject({ kind: "offline" });
  });
});
