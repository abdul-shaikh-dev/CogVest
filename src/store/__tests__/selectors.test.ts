import {
  selectAssetById,
  selectCashBalance,
  selectQuoteForAsset,
  selectTradesForAsset,
} from "@/src/store";
import type { Asset, CashEntry, Quote, Trade } from "@/src/types";

const stock: Asset = {
  assetClass: "stock",
  currency: "INR",
  id: "asset-1",
  name: "Reliance Industries",
  symbol: "RELIANCE",
  ticker: "RELIANCE.NS",
};

const crypto: Asset = {
  assetClass: "crypto",
  currency: "USD",
  id: "asset-2",
  name: "Bitcoin",
  symbol: "BTC",
  ticker: "bitcoin",
};

const trades: Trade[] = [
  {
    assetId: stock.id,
    date: "2026-04-26T00:00:00.000Z",
    id: "trade-1",
    pricePerUnit: 100,
    quantity: 2,
    totalValue: 200,
    type: "buy",
  },
  {
    assetId: crypto.id,
    date: "2026-04-26T00:00:00.000Z",
    id: "trade-2",
    pricePerUnit: 50000,
    quantity: 0.1,
    totalValue: 5000,
    type: "buy",
  },
];

const cashEntries: CashEntry[] = [
  {
    amount: 5000,
    date: "2026-04-26T00:00:00.000Z",
    id: "cash-1",
    label: "Deposit",
    type: "addition",
  },
  {
    amount: 1200,
    date: "2026-04-26T00:00:00.000Z",
    id: "cash-2",
    label: "Withdrawal",
    type: "withdrawal",
  },
];

const quote: Quote = {
  assetId: stock.id,
  asOf: "2026-04-26T10:00:00.000Z",
  currency: "INR",
  price: 110,
  source: "manual",
};

describe("portfolio selectors", () => {
  it("selects assets and trades by asset ID", () => {
    expect(selectAssetById([stock, crypto], stock.id)).toEqual(stock);
    expect(selectTradesForAsset(trades, stock.id)).toEqual([trades[0]]);
  });

  it("calculates cash balance from raw cash entries", () => {
    expect(selectCashBalance(cashEntries)).toBe(3800);
  });

  it("selects cached quote by asset ID", () => {
    expect(selectQuoteForAsset({ [stock.id]: quote }, stock.id)).toEqual(quote);
    expect(selectQuoteForAsset({ [stock.id]: quote }, crypto.id)).toBeNull();
  });
});
