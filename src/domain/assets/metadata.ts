import type { Asset, InstrumentType, SectorType } from "@/src/types";

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

  return {
    ...asset,
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

export function instrumentTypeLabel(value: InstrumentType) {
  return instrumentTypeLabels[value];
}

export function sectorTypeLabel(value: SectorType) {
  return sectorTypeLabels[value];
}
