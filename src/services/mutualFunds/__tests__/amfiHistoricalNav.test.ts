import type { Asset } from "@/src/types";

import {
  buildAmfiHistoricalNavUrl,
  clearAmfiHistoricalNavCacheForTests,
  fetchAmfiHistoricalNav,
  parseAmfiFundHouseIds,
  parseAmfiHistoricalNav,
} from "../amfiHistoricalNav";
import { clearAmfiSchemeCatalogCacheForTests } from "../amfiSchemeCatalog";

const asset: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "axis-arbitrage",
  instrumentType: "arbitrageFund",
  isin: "INF846K01PZ1",
  name: "Axis Arbitrage Fund",
  symbol: "INF846K01PZ1",
  ticker: "INF846K01PZ1",
};

const currentCatalog = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
  "Open Ended Schemes(Hybrid Schemes - Arbitrage Fund)",
  "Axis Mutual Fund",
  "130773;INF846K01PZ1;-;Axis Arbitrage Fund;Direct Plan;Growth Option;21.9580;18-Sep-2026",
].join("\n");

const historical = [
  "Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date",
  "130773;Axis Arbitrage Fund;Direct Plan;Growth Option;INF846K01PZ1;;20.1;28-Aug-2026",
  "130773;Axis Arbitrage Fund;Direct Plan;Growth Option;INF846K01PZ1;;20.2;31-Aug-2026",
].join("\n");

describe("AMFI historical NAV", () => {
  afterEach(() => {
    clearAmfiHistoricalNavCacheForTests();
    clearAmfiSchemeCatalogCacheForTests();
  });

  it("parses fund-house ids from AMFI's escaped page payload", () => {
    expect(parseAmfiFundHouseIds('{\\"mfId\\":\\"53\\",\\"mfName\\":\\"Axis Mutual Fund\\"}')).toEqual({
      "Axis Mutual Fund": "53",
    });
  });

  it("selects the latest NAV for the exact ISIN", () => {
    expect(parseAmfiHistoricalNav(historical, asset.isin!)).toEqual({
      asOf: "2026-08-31T00:00:00.000Z",
      nav: 20.2,
    });
  });

  it("rejects conflicting NAVs for the same ISIN and date", () => {
    expect(
      parseAmfiHistoricalNav(
        `${historical}\n130773;Axis Arbitrage Fund;Direct Plan;Growth Option;INF846K01PZ1;;99;31-Aug-2026`,
        asset.isin!,
      ),
    ).toBeUndefined();
  });

  it("requests a bounded official history window", () => {
    const url = buildAmfiHistoricalNavUrl("53", "2026-08");
    expect(url).toContain("mf=53");
    expect(url).toContain("frmdt=22-Aug-2026");
    expect(url).toContain("todt=31-Aug-2026");
  });

  it("resolves historical NAV by verified ISIN and fund house", async () => {
    const fetcher = jest.fn(async (url: string) => {
      if (url.includes("NAVAll.txt")) return new Response(currentCatalog);
      if (url.includes("nav-download")) return new Response('{\\"mfId\\":\\"53\\",\\"mfName\\":\\"Axis Mutual Fund\\"}');
      return new Response(historical);
    });
    const result = await fetchAmfiHistoricalNav({
      asset,
      fetcher,
      now: () => "2026-09-19T00:00:00.000Z",
      targetMonth: "2026-08",
    });
    expect(result).toEqual({
      ok: true,
      quote: {
        assetId: asset.id,
        asOfMonth: "2026-08",
        basis: "historical-close",
        currency: "INR",
        fetchedAt: "2026-09-19T00:00:00.000Z",
        price: 20.2,
        source: "amfi",
      },
    });
    await fetchAmfiHistoricalNav({ asset: { ...asset, id: "same-house" }, fetcher, targetMonth: "2026-08" });
    expect(
      fetcher.mock.calls.filter(([url]) =>
        url.includes("DownloadNAVHistoryReport"),
      ),
    ).toHaveLength(1);
  });
});
