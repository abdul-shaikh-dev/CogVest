import { findCanonicalAsset, normalizeAssetMetadata, normalizeIsin } from "@/src/domain/assets";
import type { TransactionCsvCandidate } from "@/src/domain/transactionCsv";
import type { Asset } from "@/src/types";

const normalized = (value?: string) => value?.trim().toUpperCase() ?? "";

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
      values.add(isin);
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
    (!asset.isin || normalizeIsin(asset.isin) === normalizeIsin(row.isin));
}

/** A bulk suggestion is evidence-based, not the first fuzzy search result. */
export function exactTradebookSuggestion(rows: TransactionCsvCandidate[], candidates: Asset[]) {
  const exact = candidates.filter((asset) => rows.every((row) => matchesTradebookListing(asset, row)));
  return exact.length === 1 ? exact[0] : undefined;
}

export function compatibleTransactionCandidate(asset: Asset, row: TransactionCsvCandidate) {
  if (asset.currency !== row.currency) return false;
  if (row.identity.kind === "isin" && asset.isin &&
      normalizeIsin(asset.isin) !== normalizeIsin(row.identity.value)) return false;
  return row.source?.format !== "zerodha-tradebook" ||
    asset.assetClass === "stock" || asset.assetClass === "etf";
}
