import type { Asset, HistoricalQuote, Quote } from "@/src/types";

/**
 * Whether a cached quote still belongs to a saved asset (#651).
 *
 * Backup validation rejects any quote without a matching asset, or whose
 * currency differs from the asset's. A quote refresh or month-end run that
 * finishes after its holding was deleted could leave such a quote behind and
 * block every later export.
 */
export function isQuoteForSavedAsset(
  quote: Pick<Quote | HistoricalQuote, "assetId" | "currency">,
  assets: readonly Pick<Asset, "currency" | "id">[],
): boolean {
  return assets.some(
    (asset) => asset.id === quote.assetId && asset.currency === quote.currency,
  );
}

/** Returns the cache unchanged (same object) when every quote is kept. */
export function withoutOrphanQuotes<T extends Record<string, Quote | HistoricalQuote>>(
  cache: T,
  assets: readonly Pick<Asset, "currency" | "id">[],
): T {
  const entries = Object.entries(cache);
  const kept = entries.filter(([, quote]) => isQuoteForSavedAsset(quote, assets));
  return kept.length === entries.length ? cache : (Object.fromEntries(kept) as T);
}
