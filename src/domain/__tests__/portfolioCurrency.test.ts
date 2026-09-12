import { getV1AssetCurrencyIssue } from "../portfolioCurrency";

describe("V1 portfolio currency support", () => {
  it("does not require an exchange listing for an INR equity mutual fund", () => {
    expect(getV1AssetCurrencyIssue({
      assetClass: "stock",
      currency: "INR",
      id: "cas:INF000000001",
      instrumentType: "mutualFund",
      isin: "INF000000001",
      name: "Sample Equity Fund",
      symbol: "INF000000001",
      ticker: "INF000000001",
    })).toBeUndefined();
  });

  it("still requires NSE or BSE identity for a stock", () => {
    expect(getV1AssetCurrencyIssue({
      assetClass: "stock",
      currency: "INR",
      id: "local-stock",
      instrumentType: "stock",
      name: "Sample Stock",
      symbol: "SAMPLE",
      ticker: "SAMPLE",
    })).toMatch(/not linked/u);
  });
});
