import {
  allocationFromAmfiEvidence,
  clearAmfiSchemeCatalogCacheForTests,
  lookupAmfiSchemeClassifications,
  parseAmfiSchemeCatalog,
} from "../amfiSchemeCatalog";

const fixture = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
  "Open Ended Schemes(Equity Scheme - Large Cap Fund)",
  "Example Mutual Fund",
  "100001;INF000000001;-;Example Large Cap Fund;Direct Plan;Growth;10;11-Sep-2026",
  "Open Ended Schemes(Debt Scheme - Liquid Fund)",
  "100002;INF000000002;INF000000003;Example Liquid Fund;Direct Plan;IDCW;10;11-Sep-2026",
  "Open Ended Schemes(Hybrid Schemes - Arbitrage Fund)",
  "100003;INF000000004;-;Example Arbitrage Fund;Direct Plan;Growth;10;11-Sep-2026",
  "Open Ended Schemes(Other Scheme - Index Funds)",
  "100004;INF000000005;-;Example Nifty IT Index Fund;Direct Plan;Growth;10;11-Sep-2026",
  "100005;INF000000006;-;Example Nifty G-Sec Index Fund;Direct Plan;Growth;10;11-Sep-2026",
  "100006;INF000000007;-;Example Gold Index Fund;Direct Plan;Growth;10;11-Sep-2026",
].join("\n");

describe("AMFI scheme catalogue", () => {
  afterEach(clearAmfiSchemeCatalogCacheForTests);

  it("classifies exact ISINs from AMFI category headings", () => {
    expect(parseAmfiSchemeCatalog(fixture)).toMatchObject({
      INF000000001: { allocation: "equity", category: "Equity Scheme - Large Cap Fund" },
      INF000000002: { allocation: "debt", category: "Debt Scheme - Liquid Fund" },
      INF000000003: { allocation: "debt", category: "Debt Scheme - Liquid Fund" },
      INF000000004: { category: "Hybrid Schemes - Arbitrage Fund" },
      INF000000005: { allocation: "equity", category: "Other Scheme - Index Funds" },
      INF000000006: { allocation: "debt", category: "Other Scheme - Index Funds" },
      INF000000007: { category: "Other Scheme - Index Funds" },
    });
  });

  it("does not force mixed or non-equity categories into Equity or Debt", () => {
    expect(allocationFromAmfiEvidence("Hybrid Schemes - Arbitrage Fund", "Example Arbitrage Fund")).toBeUndefined();
    expect(allocationFromAmfiEvidence("Other Scheme - Index Funds", "Example Gold Index Fund")).toBeUndefined();
  });

  it("downloads once and returns only requested ISINs", async () => {
    const fetcher = jest.fn(async () => new Response(fixture));
    const first = await lookupAmfiSchemeClassifications({ fetcher, isins: [" inf000000001 "] });
    const second = await lookupAmfiSchemeClassifications({ fetcher, isins: ["INF000000002"] });

    expect(first.classifications.INF000000001.allocation).toBe("equity");
    expect(second.classifications.INF000000002.allocation).toBe("debt");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails closed when AMFI is unavailable", async () => {
    const result = await lookupAmfiSchemeClassifications({
      fetcher: jest.fn(async () => { throw new Error("offline"); }),
      isins: ["INF000000001"],
    });

    expect(result.classifications).toEqual({});
    expect(result.failure).toMatch(/unavailable/u);
  });
});
