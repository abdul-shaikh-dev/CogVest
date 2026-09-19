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

    if (index === 0) {
      return {
        assetClass: "stock",
        currency: "INR",
        id: "asset-search-qa-saved-0001",
        instrumentType: "mutualFund",
        name: "HDFC Balanced Advantage Fund - Direct Plan - Growth",
        quoteSourceId: "INF179K01WA6",
        sectorType: "diversified",
        symbol: "INF179K01WA6",
        ticker: "INF179K01WA6",
      };
    }

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

export const assetSearchQaMixedNameCandidates: AssetLookupResult[] = [
  {
    assetClass: "stock", currency: "INR", exchange: "NSE", id: "asset-search-qa-hdfc-bank-nse",
    instrumentType: "stock", instrumentTypeConfidence: "provider",
    metadataReviewMessage: "Synthetic QA metadata. Confirm before saving.", name: "HDFC Bank Limited",
    provider: "yahoo", quoteSourceId: "HDFCBANK.NS", sectorType: "financialServices",
    sectorTypeConfidence: "provider", sourceLabel: "Yahoo Finance", symbol: "HDFCBANK", ticker: "HDFCBANK.NS",
  },
  {
    assetClass: "stock", currency: "INR", exchange: "BSE", id: "asset-search-qa-hdfc-bank-bse",
    instrumentType: "stock", instrumentTypeConfidence: "provider",
    metadataReviewMessage: "Synthetic QA metadata. Confirm before saving.", name: "HDFC Bank Limited",
    provider: "yahoo", quoteSourceId: "HDFCBANK.BO", sectorType: "financialServices",
    sectorTypeConfidence: "provider", sourceLabel: "Yahoo Finance", symbol: "HDFCBANK", ticker: "HDFCBANK.BO",
  },
  {
    assetClass: "stock", currency: "INR", exchange: "NSE", id: "asset-search-qa-hdfc-amc",
    instrumentType: "stock", instrumentTypeConfidence: "provider",
    metadataReviewMessage: "Synthetic QA metadata. Confirm before saving.", name: "HDFC Asset Management Company Limited",
    provider: "yahoo", quoteSourceId: "HDFCAMC.NS", sectorType: "financialServices",
    sectorTypeConfidence: "provider", sourceLabel: "Yahoo Finance", symbol: "HDFCAMC", ticker: "HDFCAMC.NS",
  },
  {
    assetClass: "etf", currency: "INR", exchange: "NSE", id: "asset-search-qa-hdfc-etf",
    instrumentType: "etf", instrumentTypeConfidence: "provider",
    metadataReviewMessage: "Synthetic QA metadata. Confirm before saving.",
    name: "HDFC Bank Nifty 50 Exchange Traded Fund - Growth Option with a deliberately long fixture name",
    provider: "yahoo", quoteSourceId: "HDFCNIFETF.NS", sectorType: "diversified",
    sectorTypeConfidence: "provider", sourceLabel: "Yahoo Finance", symbol: "HDFCNIFETF", ticker: "HDFCNIFETF.NS",
  },
  {
    assetClass: "crypto", currency: "INR", exchange: "CRYPTO", id: "asset-search-qa-hdfc-rstock",
    instrumentType: "crypto", instrumentTypeConfidence: "provider",
    metadataReviewMessage: "Synthetic QA metadata. Confirm before saving.", name: "HDFC Bank rStock",
    provider: "coingecko", quoteSourceId: "hdfc-bank-rstock", sectorType: "digitalAsset",
    sectorTypeConfidence: "provider", sourceLabel: "CoinGecko", symbol: "HDFCR", ticker: "hdfc-bank-rstock",
  },
];

export function createAssetSearchQaLookup(query: string) {
  return prepareAssetLookupResults(
    query,
    query.trim().toLowerCase().includes("hdfc")
      ? assetSearchQaMixedNameCandidates
      : assetSearchQaProviderCandidates,
  );
}

export function seedAssetSearchQaStore(store: StoreApi<PortfolioStoreState>) {
  assetSearchQaSavedAssets.forEach((asset) => store.getState().addAsset(asset));
}

export const assetSearchQaFixtureCounts = {
  providerCandidates: providerCandidateCount,
  savedAssets: savedAssetCount,
} as const;
