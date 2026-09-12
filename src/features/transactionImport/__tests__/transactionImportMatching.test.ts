import { parseZerodhaTradebook } from "@/src/domain/zerodhaTradebook";
import { assetFromCasScheme, casFundAllocationCandidates, compatibleTransactionCandidate, exactTradebookSuggestion, inferCasFundAllocation } from "../transactionImportMatching";
import type { Asset } from "@/src/types";

const rows = parseZerodhaTradebook("symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time\nEXAMPLE,INE000000001,2024-01-02,NSE,EQ,EQ,buy,false,1,100,one,order-one,2024-01-02T10:00:00").rows;
const asset: Asset = { id: "example", name: "Example", symbol: "EXAMPLE", ticker: "EXAMPLE.NS", exchange: "NSE", currency: "INR", assetClass: "stock" };

describe("Tradebook match suggestions", () => {
  it("suggests only one exact symbol/exchange/currency match", () => {
    expect(exactTradebookSuggestion(rows, [asset])).toEqual(asset);
    expect(exactTradebookSuggestion(rows, [asset, { ...asset, id: "other" }])).toBeUndefined();
  });
  it.each([
    { exchange: "BSE" }, { symbol: "EXAMPLE2" }, { currency: "USD" },
    { isin: "INE000000002" }, { assetClass: "crypto" },
  ])("does not batch-accept a mismatched listing: %j", (change) => {
    expect(exactTradebookSuggestion(rows, [{ ...asset, ...change } as Asset])).toBeUndefined();
  });
  it("does not hide an identity change across source rows", () => {
    expect(exactTradebookSuggestion([...rows, { ...rows[0], symbol: "RENAMED" }], [asset])).toBeUndefined();
  });
  it("excludes cryptocurrency lookup noise from Tradebooks", () => {
    expect(compatibleTransactionCandidate({ ...asset, assetClass: "crypto" }, rows[0])).toBe(false);
  });
});

describe("CAS scheme identities", () => {
  it.each([
    ["Sample Equity Fund - Direct Growth", "stock", "mutualFund", "other"],
    ["Sample Liquid Fund - Direct Growth", "debt", "liquidFund", "liquidity"],
  ] as const)("creates a classified local holding for %s", (name, assetClass, instrumentType, sectorType) => {
    expect(assetFromCasScheme({
      closingUnits: "10",
      events: [],
      folioLabel: "Folio 1",
      importableTransactions: 1,
      isin: " inf000000001 ",
      name,
      openingUnits: "0",
      registrar: "CAMS",
    })).toEqual({
      assetClass,
      currency: "INR",
      id: "cas:INF000000001",
      instrumentType,
      isin: "INF000000001",
      name,
      sectorType,
      symbol: "INF000000001",
      ticker: "INF000000001",
    });
  });

  it("requires an allocation choice for hybrid and unclear funds", () => {
    const scheme = {
      closingUnits: "10",
      events: [],
      folioLabel: "Folio 1",
      importableTransactions: 1,
      isin: "INF000000001",
      name: "Sample Arbitrage Fund - Direct Growth",
      openingUnits: "0",
      registrar: "CAMS" as const,
    };

    expect(inferCasFundAllocation(scheme.name)).toBeUndefined();
    expect(inferCasFundAllocation("Sample Index Fund")).toBeUndefined();
    expect(inferCasFundAllocation("Sample Gold Index Fund")).toBeUndefined();
    expect(inferCasFundAllocation("Sample Nifty IT Index Fund")).toBe("equity");
    expect(assetFromCasScheme(scheme)).toBeUndefined();
    expect(casFundAllocationCandidates(scheme).map((candidate) => ({
      assetClass: candidate.assetClass,
      id: candidate.id,
      instrumentType: candidate.instrumentType,
    }))).toEqual([
      { assetClass: "stock", id: "cas:INF000000001", instrumentType: "arbitrageFund" },
      { assetClass: "debt", id: "cas:INF000000001", instrumentType: "arbitrageFund" },
    ]);
  });
});
