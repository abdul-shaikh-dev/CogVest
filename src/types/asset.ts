export type AssetClass = "crypto" | "debt" | "stock" | "etf" | "cash";

export type Currency = "INR" | "USD";

export type AssetExchange = "NSE" | "BSE" | "CRYPTO";

export type InstrumentType =
  | "bond"
  | "cash"
  | "crypto"
  | "debt"
  | "etf"
  | "fixedDeposit"
  | "mutualFund"
  | "other"
  | "stock";

export type SectorType =
  | "consumer"
  | "digitalAsset"
  | "diversified"
  | "energy"
  | "financialServices"
  | "fixedIncome"
  | "healthcare"
  | "industrial"
  | "liquidity"
  | "other"
  | "technology";

export type Asset = {
  assetClass: AssetClass;
  currency: Currency;
  exchange?: AssetExchange;
  id: string;
  instrumentType?: InstrumentType;
  isTaxEligible?: boolean;
  logoUrl?: string;
  name: string;
  quoteSourceId?: string;
  sectorType?: SectorType;
  symbol: string;
  ticker: string;
};
