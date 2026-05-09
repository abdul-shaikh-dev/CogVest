export type AssetClass = "crypto" | "debt" | "stock" | "etf" | "cash";

export type Currency = "INR" | "USD";

export type AssetExchange = "NSE" | "BSE" | "CRYPTO";

export type Asset = {
  assetClass: AssetClass;
  currency: Currency;
  exchange?: AssetExchange;
  id: string;
  isTaxEligible?: boolean;
  logoUrl?: string;
  name: string;
  symbol: string;
  ticker: string;
};
