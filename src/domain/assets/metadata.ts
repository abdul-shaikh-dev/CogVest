import type { Asset, InstrumentType, SectorBasis, SectorType } from "@/src/types";

import { normalizeIsin } from "./identity";

export const instrumentTypeOptions: InstrumentType[] = [
  "stock",
  "etf",
  "mutualFund",
  "debt",
  "ppf",
  "liquidFund",
  "arbitrageFund",
  "bond",
  "fixedDeposit",
  "crypto",
  "cash",
  "other",
];

export const sectorTypeOptions: SectorType[] = [
  "other",
  "financialServices",
  "technology",
  "healthcare",
  "consumer",
  "industrial",
  "energy",
  "utilities",
  "materials",
  "realEstate",
  "communicationServices",
  "diversified",
  "commodities",
  "fixedIncome",
  "digitalAsset",
  "liquidity",
];

export const equitySectorTypeOptions: SectorType[] = [
  "other",
  "financialServices",
  "technology",
  "healthcare",
  "consumer",
  "industrial",
  "energy",
  "utilities",
  "materials",
  "realEstate",
  "communicationServices",
  "diversified",
  "commodities",
];

const instrumentTypesByClass: Record<
  Asset["assetClass"],
  InstrumentType[]
> = {
  cash: ["cash"],
  crypto: ["crypto"],
  debt: [
    "debt",
    "mutualFund",
    "liquidFund",
    "arbitrageFund",
    "bond",
    "fixedDeposit",
    "ppf",
    "other",
  ],
  etf: ["etf"],
  stock: ["stock", "mutualFund", "arbitrageFund"],
};

type MetadataDefaults = {
  instrumentType: InstrumentType;
  sectorType: SectorType;
};

const defaultsByClass: Record<Asset["assetClass"], MetadataDefaults> = {
  cash: {
    instrumentType: "cash",
    sectorType: "liquidity",
  },
  crypto: {
    instrumentType: "crypto",
    sectorType: "digitalAsset",
  },
  debt: {
    instrumentType: "debt",
    sectorType: "fixedIncome",
  },
  etf: {
    instrumentType: "etf",
    sectorType: "diversified",
  },
  stock: {
    instrumentType: "stock",
    sectorType: "other",
  },
};

const instrumentTypeLabels: Record<InstrumentType, string> = {
  arbitrageFund: "Arbitrage Fund",
  bond: "Bond",
  cash: "Cash",
  crypto: "Crypto",
  debt: "Debt",
  etf: "ETF",
  fixedDeposit: "Fixed Deposit",
  liquidFund: "Liquid Fund",
  mutualFund: "Mutual Fund",
  other: "Other",
  ppf: "PPF",
  stock: "Stock",
};

const sectorTypeLabels: Record<SectorType, string> = {
  commodities: "Commodities",
  communicationServices: "Communication Services",
  consumer: "Consumer",
  digitalAsset: "Digital Asset",
  diversified: "Diversified",
  energy: "Energy",
  financialServices: "Financial Services",
  fixedIncome: "Fixed Income",
  healthcare: "Healthcare",
  industrial: "Industrials",
  liquidity: "Liquidity",
  materials: "Materials",
  other: "Unknown",
  realEstate: "Real Estate",
  technology: "Technology",
  utilities: "Utilities",
};

export function getDefaultAssetMetadata(
  assetClass: Asset["assetClass"],
): MetadataDefaults {
  return defaultsByClass[assetClass];
}

export function getInstrumentTypeOptions(assetClass: Asset["assetClass"]) {
  return instrumentTypesByClass[assetClass];
}

export function normalizeAssetMetadata(asset: Asset): Asset {
  const defaults = getDefaultAssetMetadata(asset.assetClass);
  const isin = normalizeIsin(asset.isin);
  const instrumentType = asset.instrumentType ?? defaults.instrumentType;
  const quoteSourceId = asset.quoteSourceId ?? (
    instrumentType === "stock" ||
    instrumentType === "etf" ||
    instrumentType === "crypto"
      ? asset.ticker
      : undefined
  );

  // An ISIN that is not 12 letters or digits is dropped, never saved (#712).
  const { isin: _rawIsin, ...rest } = asset;

  return {
    ...rest,
    instrumentType,
    ...(isin === undefined ? {} : { isin }),
    ...(quoteSourceId === undefined ? {} : { quoteSourceId }),
    sectorType: asset.sectorType ?? defaults.sectorType,
  };
}

export function isInstrumentType(value: string): value is InstrumentType {
  return instrumentTypeOptions.includes(value as InstrumentType);
}

export function isSectorType(value: string): value is SectorType {
  return sectorTypeOptions.includes(value as SectorType);
}

export const sectorBasisOptions: SectorBasis[] = ["provider", "providerHadNone", "schemeName", "user"];

export function isSectorBasis(value: unknown): value is SectorBasis {
  return sectorBasisOptions.includes(value as SectorBasis);
}

/** Where the sector came from, in words, or undefined when it isn't recorded. */
export function sectorBasisLabel(basis: SectorBasis | undefined) {
  switch (basis) {
    case "provider": return "From the price provider";
    case "providerHadNone": return "The price provider has no sector for it";
    case "schemeName": return "From the fund's name";
    case "user": return "Set by you";
    default: return undefined;
  }
}

export function instrumentTypeLabel(value: InstrumentType) {
  return instrumentTypeLabels[value];
}

export function sectorTypeLabel(value: SectorType) {
  return sectorTypeLabels[value];
}

/**
 * Where the reviewed sector came from (#823): the lookup's or saved asset's
 * basis while its sector is kept, the user's once they pick another one.
 * Choosing Unknown by hand is "not set", not a basis.
 */
export function reviewedSectorBasis(
  sectorType: SectorType,
  base: Pick<Asset, "sectorBasis" | "sectorType"> | undefined,
): SectorBasis | undefined {
  if (base && base.sectorType === sectorType) return base.sectorBasis;
  return sectorType === "other" ? undefined : "user";
}
