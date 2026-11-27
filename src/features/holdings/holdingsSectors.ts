import {
  instrumentTypeLabel,
  sectorTypeLabel,
  suggestPortfolioClassifications,
  type AssetClassificationSuggestion,
} from "@/src/domain/assets";
import { calculateSectorAllocation } from "@/src/domain/calculations";
import type { Asset, Holding, PpfAccount, SectorType } from "@/src/types";

/**
 * The sector breakdown on Holdings → Portfolio insights (#823). Unknown is
 * its own row, last, so missing sectors stay visible instead of being spread
 * over the others.
 */
export type SectorRow = { key: SectorType; label: string; percentage: number };

export function getSectorRows(holdings: Holding[]): SectorRow[] {
  const rows = calculateSectorAllocation(holdings).map((item) => ({
    key: item.label as SectorType,
    label: sectorTypeLabel(item.label as SectorType),
    percentage: item.percentage,
  }));
  return [...rows.filter((row) => row.key !== "other"), ...rows.filter((row) => row.key === "other")];
}

/** Suggestions the store can apply: PPF-linked and demerged records keep their class. */
export function reviewableSuggestions(assets: Asset[], ppfAccounts: Pick<PpfAccount, "legacyAssetId">[]) {
  const ppfLinked = new Set(ppfAccounts.map((account) => account.legacyAssetId).filter(Boolean));
  const demergedChildren = new Set(assets.flatMap((asset) => asset.demerger?.childAssetId ?? []));
  return suggestPortfolioClassifications(assets)
    .filter((suggestion) => !ppfLinked.has(suggestion.assetId) && !demergedChildren.has(suggestion.assetId));
}

/** "Unknown → Technology", "Company share → ETF", or both. */
export function describeSuggestion(suggestion: AssetClassificationSuggestion) {
  const lines: string[] = [];
  if (suggestion.sectorChanged) {
    lines.push(`Sector: ${sectorTypeLabel(suggestion.current.sectorType ?? "other")} → ${sectorTypeLabel(suggestion.next.sectorType ?? "other")}`);
  }
  if (suggestion.reclassifyAsEtf) {
    lines.push(`Type: ${instrumentTypeLabel(suggestion.current.instrumentType ?? "stock")} → ${instrumentTypeLabel("etf")}`);
  }
  return lines;
}
