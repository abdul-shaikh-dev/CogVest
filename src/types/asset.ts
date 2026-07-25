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
  | "liquidFund"
  | "mutualFund"
  | "other"
  | "ppf"
  | "arbitrageFund"
  | "stock";

export type SectorType =
  | "communicationServices"
  | "consumer"
  | "digitalAsset"
  | "diversified"
  | "energy"
  | "financialServices"
  | "fixedIncome"
  | "healthcare"
  | "industrial"
  | "liquidity"
  | "materials"
  | "other"
  | "realEstate"
  | "technology"
  | "utilities";

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
