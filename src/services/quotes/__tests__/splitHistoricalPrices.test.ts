import { fetchYahooHistoricalPrice } from "../historicalPrices";
import type { Asset } from "@/src/types";

const asset: Asset = { id: "test", assetClass: "stock", currency: "INR", name: "Synthetic", symbol: "TEST", ticker: "TEST.NS", exchange: "NSE" };
it("rejects month-end prices adjusted by a later split and requests the adjustment horizon", async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [{
    meta: { currency: "INR" }, timestamp: [Date.parse("2025-01-31T10:00:00Z") / 1000],
    indicators: { quote: [{ close: [50] }] },
    events: { splits: { later: { date: Date.parse("2025-02-01T10:00:00Z") / 1000 } } },
  }] } }) });
  const result = await fetchYahooHistoricalPrice({ asset, targetMonth: "2025-01", now: () => "2025-03-01T00:00:00Z", fetcher });
  expect(result).toMatchObject({ ok: false });
  expect(fetcher.mock.calls[0][0]).toContain("events=splits");
  expect(fetcher.mock.calls[0][0]).toContain(`period2=${Date.parse("2025-03-01T00:00:00Z") / 1000 + 1}`);
});
