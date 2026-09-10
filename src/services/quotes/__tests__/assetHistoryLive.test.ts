import { fetchAssetHistory } from "../assetHistoryProvider";

const live = process.env.COGVEST_HISTORY_LIVE === "1" ? it : it.skip;

live("probes public Yahoo and CoinGecko daily history without portfolio data", async () => {
  const to = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const from = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
  for (const identity of [
    { provider: "yahoo" as const, providerId: "NIFTYBEES.NS", currency: "INR" as const },
    { provider: "coingecko" as const, providerId: "bitcoin", currency: "USD" as const },
  ]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const result = await fetchAssetHistory({ ...identity, basis: "close", from, to }, controller.signal);
      expect(result.points.length).toBeGreaterThan(1);
      expect(result.currency).toBe(identity.currency);
      console.info("[history-live]", identity.provider, result.points.length, result.complete, result.points[0].date, result.points.at(-1)?.date);
    } finally { clearTimeout(timer); }
  }
}, 30000);
