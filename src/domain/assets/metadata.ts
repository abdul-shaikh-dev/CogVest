import type { Asset, InstrumentType, SectorType } from "@/src/types";

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
  "financialServices",
  "technology",
  "energy",
  "consumer",
  "healthcare",
  "industrial",
  "diversified",
  "fixedIncome",
  "digitalAsset",
  "liquidity",
  "other",
];

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
    sectorType: "financialServices",
  },
};

export function getDefaultAssetMetadata(
  assetClass: Asset["assetClass"],
): MetadataDefaults {
  return defaultsByClass[assetClass];
}

export function normalizeAssetMetadata(asset: Asset): Asset {
  const defaults = getDefaultAssetMetadata(asset.assetClass);

  return {
    ...asset,
    instrumentType: asset.instrumentType ?? defaults.instrumentType,
    quoteSourceId: asset.quoteSourceId ?? asset.ticker,
    sectorType: asset.sectorType ?? defaults.sectorType,
  };
}

export function isInstrumentType(value: string): value is InstrumentType {
  return instrumentTypeOptions.includes(value as InstrumentType);
}

export function isSectorType(value: string): value is SectorType {
  return sectorTypeOptions.includes(value as SectorType);
}
