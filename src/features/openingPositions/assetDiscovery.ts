import type { Asset, AssetClass } from "@/src/types";

export type DiscoveryFilter = "all" | AssetClass | "NSE" | "BSE";
export const discoveryFilters = [
  { label: "All assets", value: "all" },
  { label: "Stocks", value: "stock" },
  { label: "ETFs", value: "etf" },
  { label: "Debt (saved assets)", value: "debt" },
  { label: "Crypto", value: "crypto" },
  { label: "NSE", value: "NSE" },
  { label: "BSE", value: "BSE" },
] as const;

export function matchesDiscoveryFilter(asset: Pick<Asset, "assetClass" | "exchange">, filter: DiscoveryFilter) {
  return filter === "all" || asset.assetClass === filter || asset.exchange === filter;
}

export function searchSavedAssets(assets: Asset[], query: string, filter: DiscoveryFilter = "all") {
  const normalized = query.trim().toLowerCase();
  const exact = (asset: Asset) => [asset.symbol, asset.ticker, asset.quoteSourceId, asset.name]
    .some((value) => value?.trim().toLowerCase() === normalized);
  return assets.filter((asset) => matchesDiscoveryFilter(asset, filter) &&
    [asset.name, asset.symbol, asset.ticker, asset.quoteSourceId].some((value) => value?.toLowerCase().includes(normalized)))
    .sort((a, b) => Number(exact(b)) - Number(exact(a)) || a.name.localeCompare(b.name));
}
