import type { StoreApi } from "zustand/vanilla";

import {
  prepareAssetLookupResults,
  type AssetLookupResult,
} from "@/src/services/assetLookup";
import type { PortfolioStoreState } from "@/src/store";
import type { Asset } from "@/src/types";

const savedAssetCount = 500;
const providerCandidateCount = 200;

function pad(value: number) {
  return value.toString().padStart(4, "0");
}

export const assetSearchQaSavedAssets: Asset[] = Array.from(
  { length: savedAssetCount },
  (_, index) => {
    const number = index + 1;
    const code = pad(number);
    const assetClass = number % 10 === 0 ? "etf" : "stock";

    return {
      assetClass,
      currency: "INR",
      exchange: number % 2 === 0 ? "NSE" : "BSE",
      id: `asset-search-qa-saved-${code}`,
      instrumentType: assetClass,
      name: `Synthetic saved asset ${code}`,
      quoteSourceId: `SAVED${code}.${number % 2 === 0 ? "NS" : "BO"}`,
      sectorType: assetClass === "etf" ? "diversified" : "technology",
      symbol: `SAVED${code}`,
      ticker: `SAVED${code}.${number % 2 === 0 ? "NS" : "BO"}`,
    };
  },
);

export const assetSearchQaProviderCandidates: AssetLookupResult[] = Array.from(
  { length: providerCandidateCount },
  (_, index) => {
    const number = index + 1;
    const code = pad(number);
    const isCrypto = number % 5 === 0;

    return {
      assetClass: isCrypto ? "crypto" : "stock",
      currency: "INR",
      exchange: isCrypto ? "CRYPTO" : number % 2 === 0 ? "NSE" : "BSE",
      id: `asset-search-qa-provider-${code}`,
      instrumentType: isCrypto ? "crypto" : "stock",
      instrumentTypeConfidence: "provider",
      metadataReviewMessage: "Synthetic QA metadata. Confirm before saving.",
      name: `Synthetic provider candidate ${code}`,
      provider: isCrypto ? "coingecko" : "yahoo",
      quoteSourceId: isCrypto ? `synthetic-coin-${code}` : `CAND${code}.${number % 2 === 0 ? "NS" : "BO"}`,
      sectorType: isCrypto ? "digitalAsset" : "technology",
      sectorTypeConfidence: "provider",
      sourceLabel: isCrypto ? "CoinGecko" : "Yahoo Finance",
      symbol: isCrypto ? `SYN${code}` : `CAND${code}`,
      ticker: isCrypto ? `synthetic-coin-${code}` : `CAND${code}.${number % 2 === 0 ? "NS" : "BO"}`,
    };
  },
);

export function createAssetSearchQaLookup(query: string) {
  return prepareAssetLookupResults(query, assetSearchQaProviderCandidates);
}

export function seedAssetSearchQaStore(store: StoreApi<PortfolioStoreState>) {
  assetSearchQaSavedAssets.forEach((asset) => store.getState().addAsset(asset));
}

export const assetSearchQaFixtureCounts = {
  providerCandidates: providerCandidateCount,
  savedAssets: savedAssetCount,
} as const;
