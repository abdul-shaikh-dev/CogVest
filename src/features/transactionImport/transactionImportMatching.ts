import { normalizeIsin } from "@/src/domain/assets";
import type { TransactionCsvCandidate } from "@/src/domain/transactionCsv";
import type { Asset } from "@/src/types";

const normalized = (value?: string) => value?.trim().toUpperCase() ?? "";

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
