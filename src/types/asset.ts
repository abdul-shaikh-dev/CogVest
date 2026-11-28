import type { StockSplitEvent } from "./stockSplit";
import type { DemergerLink } from "./demerger";

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
  /** Gold and silver funds and ETFs (#823). */
  | "commodities"
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

/**
 * Where an asset's sector came from (#823). Absent on records saved before
 * it was kept, and on records whose sector was never set.
 */
export type SectorBasis =
  /** The price provider's sector. */
  | "provider"
  /** The price provider was asked and had none, so the sector stays Unknown. */
  | "providerHadNone"
  /** A fund or ETF name rule, such as "Nifty IT" for Technology. */
  | "schemeName"
  /** Chosen by the user. */
  | "user";

export type Asset = {
  assetClass: AssetClass;
  currency: Currency;
  demerger?: DemergerLink;
  exchange?: AssetExchange;
  id: string;
  instrumentType?: InstrumentType;
  /** Holds mostly securities listed outside India, such as a Nasdaq 100 fund (#823). */
  international?: boolean;
  /** Normalized 12-character International Securities Identification Number. */
  isin?: string;
  isTaxEligible?: boolean;
  logoUrl?: string;
  name: string;
  quoteSourceId?: string;
  sectorBasis?: SectorBasis;
  sectorType?: SectorType;
  stockSplits?: StockSplitEvent[];
  symbol: string;
  ticker: string;
};
