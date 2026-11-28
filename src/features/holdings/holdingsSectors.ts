import {
  instrumentTypeLabel,
  sectorTypeLabel,
  suggestPortfolioClassifications,
  type AssetClassificationSuggestion,
} from "@/src/domain/assets";
import { calculateInternationalShare, calculateSectorAllocation } from "@/src/domain/calculations";
import type { Asset, Holding, PpfAccount, SectorType } from "@/src/types";

/**
 * The sector breakdown on Holdings → Portfolio insights (#823). Unknown is
 * its own row, last, so missing sectors stay visible instead of being spread
 * over the others.
 */
export type SectorRow = {
  key: SectorType;
  label: string;
  percentage: number;
  /** INR value, only when every holding is priced in INR; never summed across currencies. */
  value?: number;
};

export function getSectorRows(holdings: Holding[]): SectorRow[] {
  const allInr = holdings.every((holding) => holding.asset.currency === "INR");
  const rows = calculateSectorAllocation(holdings).map((item) => ({
    key: item.label as SectorType,
    label: sectorTypeLabel(item.label as SectorType),
    percentage: item.percentage,
    ...(allInr ? { value: item.value } : {}),
  }));
  return [...rows.filter((row) => row.key !== "other"), ...rows.filter((row) => row.key === "other")];
}

/** The share held in holdings marked international, or undefined when there is none to show. */
export function getInternationalShare(holdings: Holding[]) {
  const share = calculateInternationalShare(holdings);
  return share === undefined || share === 0 ? undefined : share;
}

/** The holdings the sector breakdown covers: market holdings, without cash and PPF. */
export function sectorHoldings(holdings: Holding[]) {
  return holdings.filter((holding) => holding.asset.instrumentType !== "ppf" && holding.asset.assetClass !== "cash");
}

/**
 * Holdings still in Unknown that no name rule can place, so the user sets the
 * sector by hand. One entry per asset, by name.
 */
export function unknownSectorAssets(holdings: Holding[], suggestions: Pick<AssetClassificationSuggestion, "assetId">[]) {
  const suggested = new Set(suggestions.map((suggestion) => suggestion.assetId));
  const assets = new Map<string, Asset>();
  for (const holding of sectorHoldings(holdings)) {
    const sector = holding.asset.sectorType ?? "other";
    if (sector === "other" && !suggested.has(holding.asset.id)) assets.set(holding.asset.id, holding.asset);
  }
  return [...assets.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

/** Suggestions the store can apply: PPF-linked and demerged records keep their class. */
export function reviewableSuggestions(assets: Asset[], ppfAccounts: Pick<PpfAccount, "legacyAssetId">[]) {
  const ppfLinked = new Set(ppfAccounts.map((account) => account.legacyAssetId).filter(Boolean));
  const demergedChildren = new Set(assets.flatMap((asset) => asset.demerger?.childAssetId ?? []));
  return suggestPortfolioClassifications(assets)
    .filter((suggestion) => !ppfLinked.has(suggestion.assetId) && !demergedChildren.has(suggestion.assetId));
}

/** "Unknown → Technology", "Company share → ETF", "Market: International", or several. */
export function describeSuggestion(suggestion: AssetClassificationSuggestion) {
  const lines: string[] = [];
  if (suggestion.sectorChanged) {
    lines.push(`Sector: ${sectorTypeLabel(suggestion.current.sectorType ?? "other")} → ${sectorTypeLabel(suggestion.next.sectorType ?? "other")}`);
  }
  if (suggestion.reclassifyAsEtf) {
    lines.push(`Type: ${instrumentTypeLabel(suggestion.current.instrumentType ?? "stock")} → ${instrumentTypeLabel("etf")}`);
  }
  if (suggestion.markInternational) lines.push("Market: International");
  return lines;
}
