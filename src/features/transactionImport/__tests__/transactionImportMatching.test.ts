import { parseZerodhaTradebook } from "@/src/domain/zerodhaTradebook";
import { compatibleTransactionCandidate, exactTradebookSuggestion } from "../transactionImportMatching";
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
