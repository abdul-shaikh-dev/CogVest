import { act, renderHook } from "@testing-library/react-native";

import { useQuoteRefresh } from "@/src/services/quotes";
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

function response(payload: unknown): Response {
  return {
    json: jest.fn().mockResolvedValue(payload),
    ok: true,
    status: 200,
  } as unknown as Response;
}

describe("useQuoteRefresh", () => {
  it("refreshes quotes and exposes quote cache and failures", async () => {
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
    const { result } = renderHook(() =>
      useQuoteRefresh({
        assets: [reliance],
        fetcher,
        now: () => "2026-04-26T10:00:00.000Z",
      }),
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.failures).toEqual([]);
    expect(result.current.quoteCache[reliance.id]).toEqual({
      assetId: reliance.id,
      asOf: "2026-04-26T10:00:00.000Z",
      currency: "INR",
      dayChangeAbs: 1,
      dayChangePct: 1,
      price: 101,
      source: "yahoo",
    });
  });
});
