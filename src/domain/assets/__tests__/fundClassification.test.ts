import type { Asset } from "@/src/types";

import {
  isFundLike,
  looksLikeListedEtf,
  suggestAssetClassification,
  suggestFundSector,
  suggestPortfolioClassifications,
  suggestsInternational,
  withSuggestedFundSector,
} from "../fundClassification";
import { reviewedSectorBasis, sectorBasisLabel } from "../metadata";

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

describe("international marker and sector basis (#823)", () => {
  it.each([
    "Motilal Oswal Nasdaq 100 Fund of Fund",
    "Motilal Oswal S&P 500 Index Fund",
    "Mirae Asset NYSE FANG+ ETF FoF",
    "ICICI Prudential US Bluechip Equity Fund",
    "Franklin India Feeder - Franklin U.S. Opportunities Fund",
    "PGIM India Global Equity Opportunities Fund of Fund",
    "Nippon India Japan Equity Fund",
    "Mirae Asset Hang Seng TECH ETF",
  ])("marks %s as international", (name) => {
    expect(suggestsInternational(asset({ name }))).toBe(true);
  });

  it.each([
    "Nippon India ETF Nifty IT",
    "HDFC Focused Fund",
    "SBI Contra Fund for us all",
    "Parag Parikh Flexi Cap Fund",
    "Bank of India Large & Mid Cap Fund",
  ])("leaves %s Indian", (name) => {
    expect(suggestsInternational(asset({ name }))).toBe(false);
  });

  it("reads ETF tickers that say nothing in the name", () => {
    expect(suggestsInternational(asset({ assetClass: "etf", instrumentType: "etf", name: "MON100", symbol: "MON100", ticker: "MON100.NS" }))).toBe(true);
  });

  it("suggests the marker once, with the scheme-name basis for a new sector", () => {
    const suggestion = suggestAssetClassification(asset({ name: "Motilal Oswal Nasdaq 100 Fund of Fund" }))!;
    expect(suggestion).toMatchObject({ markInternational: true, sectorChanged: true });
    expect(suggestion.next).toMatchObject({ international: true, sectorBasis: "schemeName", sectorType: "technology" });
    // A marker the user turned off stays off, and a set sector is left alone.
    expect(suggestAssetClassification(asset({ international: false, name: "Motilal Oswal Nasdaq 100 Fund of Fund", sectorType: "technology" })))
      .toBeUndefined();
  });

  it("never replaces a sector the user chose, even Unknown", () => {
    expect(suggestAssetClassification(asset({ name: "Nifty Bank Index Fund", sectorBasis: "user", sectorType: "other" }))).toBeUndefined();
    expect(withSuggestedFundSector(asset({ name: "Nifty Bank Index Fund", sectorBasis: "user", sectorType: "other" })).sectorType).toBe("other");
  });

  it("records the basis and marker when creating a record", () => {
    expect(withSuggestedFundSector(asset({ name: "Nifty Bank Index Fund" }))).toMatchObject({ sectorBasis: "schemeName", sectorType: "financialServices" });
    expect(withSuggestedFundSector(asset({ name: "Motilal Oswal S&P 500 Index Fund" }))).toMatchObject({ international: true, sectorBasis: "schemeName" });
    const unchanged = asset({ name: "Some Active Fund" });
    expect(withSuggestedFundSector(unchanged)).toBe(unchanged);
  });

  it("keeps the saved basis while the sector stays, and makes a new pick the user's", () => {
    expect(reviewedSectorBasis("technology", { sectorBasis: "schemeName", sectorType: "technology" })).toBe("schemeName");
    expect(reviewedSectorBasis("energy", { sectorBasis: "schemeName", sectorType: "technology" })).toBe("user");
    expect(reviewedSectorBasis("other", { sectorBasis: "provider", sectorType: "technology" })).toBeUndefined();
    expect(reviewedSectorBasis("energy", undefined)).toBe("user");
    expect(sectorBasisLabel("providerHadNone")).toBe("The price provider has no sector for it");
    expect(sectorBasisLabel(undefined)).toBeUndefined();
  });
});
