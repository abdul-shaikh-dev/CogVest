import type { Asset } from "@/src/types";

import {
  isFundLike,
  looksLikeListedEtf,
  suggestAssetClassification,
  suggestFundSector,
  suggestPortfolioClassifications,
  withSuggestedFundSector,
} from "../fundClassification";

function asset(overrides: Partial<Asset>): Asset {
  return {
    assetClass: "stock",
    currency: "INR",
    id: "a1",
    instrumentType: "mutualFund",
    name: "Fund",
    sectorType: "other",
    symbol: "FUND",
    ticker: "FUND",
    ...overrides,
  };
}

const sectorOf = (name: string, ticker = "") => suggestFundSector({ name, symbol: ticker, ticker });

describe("suggestFundSector", () => {
  it.each([
    ["Nippon India ETF Nifty IT", "technology"],
    ["ICICI Prudential Nifty IT Index Fund - Direct Growth", "technology"],
    ["Motilal Oswal Nasdaq 100 Fund of Fund", "technology"],
    ["Nippon India ETF Nifty Bank BeES", "financialServices"],
    ["Kotak Nifty Financial Services Index Fund", "financialServices"],
    ["Nippon India ETF Gold BeES", "commodities"],
    ["ICICI Prudential Silver ETF", "commodities"],
    ["Nippon India Pharma Fund", "healthcare"],
    ["Nippon India ETF Nifty Auto", "consumer"],
    ["ICICI Prudential FMCG Fund", "consumer"],
    ["CPSE ETF", "diversified"],
    ["UTI Nifty 50 Index Fund", "diversified"],
    ["Parag Parikh Flexi Cap Fund", "diversified"],
    ["Mirae Asset ELSS Tax Saver Fund", "diversified"],
    ["Quant Infrastructure Fund", "industrial"],
    ["Nippon India ETF Nifty 1D Rate Liquid BeES", "liquidity"],
    ["Kotak Equity Arbitrage Fund", "liquidity"],
    ["HDFC Overnight Fund", "liquidity"],
    ["SBI Magnum Gilt Fund", "fixedIncome"],
    ["Bharat Bond ETF April 2030", "fixedIncome"],
    ["Aditya Birla Sun Life Banking & PSU Debt Fund", "fixedIncome"],
    ["ICICI Prudential Nifty Metal ETF", "materials"],
    ["Nippon India ETF Nifty Realty", "realEstate"],
  ] as const)("%s → %s", (name, sector) => {
    expect(sectorOf(name)).toBe(sector);
  });

  it("reads IT only as a capitalised whole word", () => {
    expect(sectorOf("Quant Infrastructure Fund")).not.toBe("technology");
    expect(sectorOf("Edelweiss Small Cap Fund - it grows")).toBe("diversified");
    expect(sectorOf("HDFC Balanced Advantage Fund")).toBe("diversified");
  });

  it("does not read a fund house's name as a sector", () => {
    expect(sectorOf("Bank of India Large & Mid Cap Equity Fund")).toBe("diversified");
    expect(sectorOf("Baroda BNP Paribas Multi Cap Fund")).toBe("diversified");
  });

  it("falls back to the exchange ticker when the name says nothing", () => {
    expect(sectorOf("ITBEES", "ITBEES.NS")).toBe("technology");
    expect(sectorOf("GOLDBEES", "GOLDBEES")).toBe("commodities");
    expect(sectorOf("PSUBNKBEES", "PSUBNKBEES")).toBe("financialServices");
    expect(sectorOf("Something", "XYZ")).toBeUndefined();
  });
});

describe("looksLikeListedEtf", () => {
  const listed = (overrides: Partial<Asset>) => asset({ exchange: "NSE", instrumentType: "stock", ...overrides });

  it("finds an exchange ETF saved as a company share", () => {
    expect(looksLikeListedEtf(listed({ name: "Nippon India ETF Nifty IT", ticker: "ITBEES.NS" }))).toBe(true);
    expect(looksLikeListedEtf(listed({ name: "ITBEES", symbol: "ITBEES", ticker: "ITBEES.NS" }))).toBe(true);
  });

  it("leaves company shares, funds of funds and unlisted records alone", () => {
    expect(looksLikeListedEtf(listed({ name: "Bank of Baroda", symbol: "BANKBARODA", ticker: "BANKBARODA.NS" }))).toBe(false);
    expect(looksLikeListedEtf(listed({ name: "Motilal Oswal Nasdaq 100 ETF Fund of Fund" }))).toBe(false);
    expect(looksLikeListedEtf(listed({ exchange: undefined, name: "Gold ETF" }))).toBe(false);
    expect(looksLikeListedEtf(listed({ instrumentType: "mutualFund", name: "Gold ETF" }))).toBe(false);
    expect(looksLikeListedEtf(listed({ isin: "INE028A01039", name: "Some ETF Holdings Ltd" }))).toBe(false);
    expect(looksLikeListedEtf(listed({ isin: "INF204KB17I5", name: "Nippon India ETF Gold BeES" }))).toBe(true);
  });
});

describe("suggestAssetClassification", () => {
  it("never suggests a sector for a company share", () => {
    const share = asset({ exchange: "NSE", instrumentType: "stock", name: "Bank of Baroda", ticker: "BANKBARODA.NS" });
    expect(isFundLike(share)).toBe(false);
    expect(suggestAssetClassification(share)).toBeUndefined();
  });

  it("replaces only a default sector", () => {
    expect(suggestAssetClassification(asset({ name: "Nifty IT Index Fund", sectorType: "healthcare" }))).toBeUndefined();
    expect(suggestAssetClassification(asset({ name: "Nifty IT Index Fund", sectorType: undefined }))?.next.sectorType).toBe("technology");
    expect(suggestAssetClassification(asset({ assetClass: "etf", instrumentType: "etf", name: "Nippon India ETF Nifty IT", sectorType: "diversified" })))
      .toMatchObject({ next: { sectorType: "technology" }, reclassifyAsEtf: false, sectorChanged: true });
  });

  it("keeps a mutual fund's chosen Diversified", () => {
    expect(suggestAssetClassification(asset({ name: "Nifty IT Index Fund", sectorType: "diversified" }))).toBeUndefined();
  });

  it("moves a listed ETF to the ETF class with its sector", () => {
    const suggestion = suggestAssetClassification(asset({
      exchange: "NSE", instrumentType: "stock", name: "Nippon India ETF Nifty IT", ticker: "ITBEES.NS",
    }));
    expect(suggestion).toMatchObject({
      current: { assetClass: "stock", instrumentType: "stock", sectorType: "other" },
      next: { assetClass: "etf", instrumentType: "etf", sectorType: "technology" },
      reclassifyAsEtf: true,
      sectorChanged: true,
    });
  });

  it("moves a listed ETF even when its name gives no sector", () => {
    const suggestion = suggestAssetClassification(asset({
      exchange: "NSE", instrumentType: "stock", name: "Some ETF", symbol: "SOMEETF", ticker: "SOMEETF.NS",
    }));
    expect(suggestion).toMatchObject({ next: { assetClass: "etf", sectorType: "other" }, sectorChanged: false });
  });

  it("leaves demerger-linked records and already-right records alone", () => {
    expect(suggestAssetClassification(asset({
      demerger: { childAssetId: "c", eventId: "e" } as unknown as Asset["demerger"], name: "Nifty IT Index Fund",
    }))).toBeUndefined();
    expect(suggestAssetClassification(asset({ name: "Nifty IT Index Fund", sectorType: "technology" }))).toBeUndefined();
    expect(suggestAssetClassification(asset({ name: "Unnamed scheme" }))).toBeUndefined();
  });

  it("lists suggestions for a portfolio", () => {
    expect(suggestPortfolioClassifications([
      asset({ id: "it", name: "Nifty IT Index Fund" }),
      asset({ exchange: "NSE", id: "bob", instrumentType: "stock", name: "Bank of Baroda" }),
      asset({ id: "gold", name: "Gold ETF Fund of Fund" }),
    ]).map((suggestion) => [suggestion.assetId, suggestion.next.sectorType])).toEqual([["it", "technology"], ["gold", "commodities"]]);
  });
});

describe("withSuggestedFundSector", () => {
  it("fills a default sector on a fund being created", () => {
    expect(withSuggestedFundSector(asset({ assetClass: "etf", instrumentType: "etf", name: "Gold BeES", sectorType: "diversified" })).sectorType)
      .toBe("commodities");
    expect(withSuggestedFundSector(asset({ name: "Nifty Bank Index Fund" })).sectorType).toBe("financialServices");
  });

  it("keeps a chosen sector and leaves shares alone", () => {
    expect(withSuggestedFundSector(asset({ name: "Nifty Bank Index Fund", sectorType: "technology" })).sectorType).toBe("technology");
    expect(withSuggestedFundSector(asset({ instrumentType: "stock", name: "HDFC Bank" })).sectorType).toBe("other");
  });
});
