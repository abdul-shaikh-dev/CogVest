import { findCanonicalAsset, normalizeAssetMetadata, normalizeIsin } from "@/src/domain/assets";
import type { CasSchemeReview } from "@/src/domain/camsKfinCasNormalizer";
import type { TransactionCsvCandidate } from "@/src/domain/transactionCsv";
import type { Asset } from "@/src/types";
import { splitCanonicalIsin, stockSplitCatalog } from "@/src/domain/stockSplitCatalog";
import {
  inferMutualFundAllocationFromName,
  type MutualFundAllocation,
} from "@/src/domain/mutualFundClassification";

const normalized = (value?: string) => value?.trim().toUpperCase() ?? "";

export type CasFundAllocation = MutualFundAllocation;

export function inferCasFundAllocation(
  name: string,
): CasFundAllocation | undefined {
  return inferMutualFundAllocationFromName(name);
}

export function assetFromCasScheme(
  scheme: CasSchemeReview,
  allocation = inferCasFundAllocation(scheme.name),
): Asset | undefined {
  const isin = normalizeIsin(scheme.isin);
  const name = scheme.name.trim();
  if (!isin || !name || !allocation) return undefined;

  const normalizedName = name.toUpperCase();
  const instrumentType = /\bLIQUID\b/u.test(normalizedName)
    ? "liquidFund"
    : /\bARBITRAGE\b/u.test(normalizedName)
      ? "arbitrageFund"
      : "mutualFund";

  return {
    assetClass: allocation === "equity" ? "stock" : "debt",
    currency: "INR",
    id: `cas:${isin}`,
    instrumentType,
    isin,
    name,
    sectorType: instrumentType === "liquidFund"
      ? "liquidity"
      : allocation === "debt"
        ? "fixedIncome"
        : "other",
    symbol: isin,
    ticker: isin,
  };
}

export function casFundAllocationCandidates(scheme: CasSchemeReview) {
  return (["equity", "debt"] as const)
    .map((allocation) => assetFromCasScheme(scheme, allocation))
    .filter((asset): asset is Asset => asset !== undefined);
}

/** A quote listing is not evidence that two historical securities have equal units. */
export function conflictingHistoricalRows(
  rows: Array<{ row: TransactionCsvCandidate; asset?: Asset }>,
  existing: Asset[],
) {
  const identities = new Map<string, Set<string>>();
  const keysFor = (asset: Asset, rowIsin?: string) => {
    const enriched = normalizeAssetMetadata(!asset.isin && rowIsin ? { ...asset, isin: rowIsin } : asset);
    const canonical = findCanonicalAsset(existing, enriched);
    return [
      `id:${asset.id}`,
      ...(asset.quoteSourceId ? [`quote:${normalized(asset.quoteSourceId)}`] : []),
      ...(asset.exchange && asset.ticker ? [`listing:${normalized(asset.exchange)}:${normalized(asset.ticker)}`] : []),
      ...(canonical ? [`id:${canonical.id}`] : []),
    ];
  };
  const rowKeys = (asset: Asset, row: TransactionCsvCandidate) => [
    ...keysFor(asset, row.identity.kind === "isin" ? normalizeIsin(row.identity.value) : undefined),
    ...(row.source?.format === "zerodha-tradebook" && row.exchange && row.symbol
      ? [`source:${normalized(row.exchange)}:${normalized(row.symbol)}:${row.currency}`] : []),
  ];
  const add = (keys: string[], isin: string | undefined) => {
    if (!isin) return;
    for (const key of keys) {
      const values = identities.get(key) ?? new Set<string>();
      values.add(splitCanonicalIsin(isin)!);
      identities.set(key, values);
    }
  };
  for (const asset of existing) add(keysFor(asset), normalizeIsin(asset.isin));
  for (const { row, asset } of rows) {
    if (!asset) continue;
    const isin = row.identity.kind === "isin" ? normalizeIsin(row.identity.value) : undefined;
    add(rowKeys(asset, row), isin);
    add(rowKeys(asset, row), normalizeIsin(asset.isin));
  }
  return new Set(rows.flatMap(({ asset, row }, index) => asset &&
    rowKeys(asset, row)
      .some((key) => (identities.get(key)?.size ?? 0) > 1) ? [index] : []));
}

export function transactionAssetKey(row: TransactionCsvCandidate) {
  return row.identity.kind === "isin"
    ? `isin:${normalized(row.identity.value)}`
    : `symbol:${normalized(row.identity.exchange)}:${normalized(row.identity.symbol)}`;
}

export function matchesTradebookListing(asset: Asset, row: TransactionCsvCandidate) {
  return row.source?.format === "zerodha-tradebook" &&
    (asset.assetClass === "stock" || asset.assetClass === "etf") &&
    asset.currency === row.currency &&
    normalized(asset.exchange) === normalized(row.exchange) &&
    normalized(asset.symbol) === normalized(row.symbol) &&
    Boolean(row.symbol) &&
    (!asset.isin || splitCanonicalIsin(asset.isin) === splitCanonicalIsin(row.isin));
}

/** A bulk suggestion is evidence-based, not the first fuzzy search result. */
export function exactTradebookSuggestion(rows: TransactionCsvCandidate[], candidates: Asset[]) {
  const exact = candidates.filter((asset) => rows.every((row) => matchesTradebookListing(asset, row)));
  return exact.length === 1 ? exact[0] : undefined;
}

export function compatibleTransactionCandidate(asset: Asset, row: TransactionCsvCandidate) {
  if (asset.currency !== row.currency) return false;
  if (row.identity.kind === "isin" && asset.isin &&
      splitCanonicalIsin(asset.isin) !== splitCanonicalIsin(row.identity.value)) return false;
  return row.source?.format !== "zerodha-tradebook" ||
    asset.assetClass === "stock" || asset.assetClass === "etf";
}

export function hasValidSplitSourceDate(row: TransactionCsvCandidate) {
  if (row.identity.kind !== "isin") return true;
  const isin = normalizeIsin(row.identity.value);
  return stockSplitCatalog.every((event) =>
    isin === event.oldIsin ? row.tradeDate < event.effectiveDate :
      isin === event.newIsin ? row.tradeDate >= event.effectiveDate : true);
}
