import { normalizeIsin } from "@/src/domain/assets";
import type { CasSchemeReview } from "@/src/domain/camsKfinCasNormalizer";
import type { AssetLookupSearchResult } from "@/src/services/assetLookup";
import type { AmfiSchemeClassification } from "@/src/services/mutualFunds/amfiSchemeCatalog";
import type { Asset } from "@/src/types";

import type { TransactionCsvResolution } from "./transactionImport";
import { assetFromCasScheme, casFundAllocationCandidates, compatibleTransactionCandidate, conflictingHistoricalRows, inferCasFundAllocation, exactTradebookSuggestion, transactionAssetKey } from "./transactionImportMatching";

export type ResolutionGroup = {
  casClassificationRequired?: boolean;
  identityConflict?: boolean;
  candidates: Asset[];
  key: string;
  rowNumbers: number[];
  selectedAsset?: Asset;
  suggestedAsset?: Asset;
  title: string;
};

function normalized(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

function assetFromLookupResult(result: {
  assetClass: Asset["assetClass"];
  currency: Asset["currency"];
  exchange?: Asset["exchange"];
  id: string;
  instrumentType: NonNullable<Asset["instrumentType"]>;
  name: string;
  quoteSourceId: string;
  sectorType: NonNullable<Asset["sectorType"]>;
  symbol: string;
  ticker: string;
}): Asset {
  return {
    assetClass: result.assetClass,
    currency: result.currency,
    ...(result.exchange ? { exchange: result.exchange } : {}),
    id: result.id,
    instrumentType: result.instrumentType,
    name: result.name,
    quoteSourceId: result.quoteSourceId,
    sectorType: result.sectorType,
    symbol: result.symbol,
    ticker: result.ticker,
  };
}

export function identityKey(resolution: TransactionCsvResolution) {
  return transactionAssetKey(resolution.row);
}

function titleForResolution(resolution: TransactionCsvResolution) {
  const { identity } = resolution.row;
  return identity.kind === "isin"
    ? `${resolution.row.symbol ? `${resolution.row.symbol} • ` : ""}ISIN ${identity.value}`
    : `${identity.symbol} • ${identity.exchange}`;
}

function findExistingAsset(
  row: TransactionCsvResolution["row"],
  assets: Asset[],
) {
  if (row.identity.kind === "isin") {
    const isin = normalizeIsin(row.identity.value);
    return assets.find((asset) => normalizeIsin(asset.isin) === isin);
  }

  const { exchange, symbol } = row.identity;
  return assets.find(
    (asset) =>
      normalized(asset.exchange) === normalized(exchange) &&
      (normalized(asset.symbol) === normalized(symbol) ||
        normalized(asset.ticker) === normalized(symbol)),
  );
}

function lookupQuery(row: TransactionCsvResolution["row"]) {
  return row.identity.kind === "isin"
    ? row.isin ?? row.identity.value
    : row.symbol ?? row.identity.symbol;
}

export function groupResolutions(resolutions: TransactionCsvResolution[], existingAssets: Asset[]) {
  const groups = new Map<string, ResolutionGroup>();
  for (const resolution of resolutions) {
    const key = identityKey(resolution);
    const existing = groups.get(key);
    if (existing) {
      existing.rowNumbers.push(resolution.row.rowNumber);
      continue;
    }
    groups.set(key, {
      casClassificationRequired: Boolean(
        resolution.candidates?.length &&
        resolution.candidates.every((candidate) => candidate.id.startsWith("cas:")),
      ),
      candidates: resolution.candidates ?? [],
      key,
      rowNumbers: [resolution.row.rowNumber],
      title: resolution.candidates?.find((candidate) => candidate.id.startsWith("cas:"))?.name
        ?? titleForResolution(resolution),
    });
  }
  for (const group of groups.values()) {
    const selected = resolutions.find(
      (resolution) =>
        identityKey(resolution) === group.key &&
        resolution.status === "ready" &&
        resolution.asset,
    );
    if (selected?.asset) group.selectedAsset = selected.asset;
    group.suggestedAsset = exactTradebookSuggestion(
      resolutions.filter((resolution) => identityKey(resolution) === group.key).map((resolution) => resolution.row),
      group.candidates,
    );
  }
  const result = [...groups.values()];
  const candidates = resolutions.map((resolution) => ({
    row: resolution.row,
    asset: resolution.asset ?? groups.get(identityKey(resolution))?.suggestedAsset,
  }));
  const conflicts = conflictingHistoricalRows(candidates, existingAssets);
  for (const index of conflicts) {
    const group = groups.get(identityKey(resolutions[index]))!;
    group.identityConflict = true;
    group.suggestedAsset = undefined;
  }
  return result;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<R>,
) {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, runWorker),
  );
  return results;
}

export type ResolveTransactionRowsInput = {
  amfiClassifications: Record<string, AmfiSchemeClassification>;
  casSchemes: CasSchemeReview[];
  existingAssets: Asset[];
  /** False once a newer analysis has started; stale lookups stop early. */
  isCurrent: () => boolean;
  /** Provider candidates by identity, kept across analyses until the source changes. */
  lookupCache: Map<string, Asset[]>;
  rows: TransactionCsvResolution["row"][];
  searchAssetLookupResults: (input: {
    query: string;
  }) => Promise<AssetLookupSearchResult>;
  /** Assets the person picked, by identity key. */
  selectedAssets: Map<string, Asset>;
};

/**
 * Resolves each imported row to a saved asset, a CAS scheme or provider
 * candidates. Rows sharing an identity are resolved together.
 */
export async function resolveTransactionRows({
  amfiClassifications,
  casSchemes,
  existingAssets,
  isCurrent,
  lookupCache,
  rows,
  searchAssetLookupResults,
  selectedAssets,
}: ResolveTransactionRowsInput) {
  const casSchemesByIsin = new Map<string, CasSchemeReview[]>();
  for (const scheme of casSchemes) {
    const isin = normalizeIsin(scheme.isin);
    if (!isin) continue;
    casSchemesByIsin.set(isin, [
      ...(casSchemesByIsin.get(isin) ?? []),
      scheme,
    ]);
  }
  const byKey = new Map<string, TransactionCsvResolution[]>();
  for (const row of rows) {
    const seed: TransactionCsvResolution = { row, status: "unresolved" };
    const key = identityKey(seed);
    byKey.set(key, [...(byKey.get(key) ?? []), seed]);
  }

  const resolvedGroups = await mapWithConcurrency(
    [...byKey.values()],
    4,
    async (seeds) => {
      const first = seeds[0];
      const cacheKey = JSON.stringify([identityKey(first), ...new Set(seeds.map((seed) => `${seed.row.exchange}:${seed.row.symbol}:${seed.row.currency}`))].sort());
      const cachedCandidates = lookupCache.get(cacheKey)?.filter((asset) => seeds.every((seed) => compatibleTransactionCandidate(asset, seed.row)));
      const existing = findExistingAsset(first.row, existingAssets);
      if (existing) {
        return seeds.map((seed) => ({
          ...seed,
          asset: existing,
          status: "ready" as const,
        }));
      }
      const selected = selectedAssets.get(identityKey(first));
      if (selected && seeds.every((seed) => compatibleTransactionCandidate(selected, seed.row))) {
        return seeds.map((seed) => ({ ...seed, asset: selected, candidates: cachedCandidates, status: "ready" as const }));
      }
      const normalizedIsin = first.row.identity.kind === "isin"
        ? normalizeIsin(first.row.identity.value)
        : undefined;
      const matchingCasSchemes = normalizedIsin
        ? casSchemesByIsin.get(normalizedIsin)
        : undefined;
      const amfiClassification = normalizedIsin
        ? amfiClassifications[normalizedIsin]
        : undefined;
      const inferredAllocations = new Set(
        amfiClassification
          ? [amfiClassification.allocation].filter(
            (allocation): allocation is "debt" | "equity" => Boolean(allocation),
          )
          : matchingCasSchemes
            ?.map((scheme) => inferCasFundAllocation(scheme.name))
            .filter((allocation): allocation is "debt" | "equity" => Boolean(allocation)),
      );
      const inferredAllocation = inferredAllocations.size === 1
        ? [...inferredAllocations][0]
        : undefined;
      const casAsset = matchingCasSchemes?.[0] && inferredAllocation
        ? assetFromCasScheme(matchingCasSchemes[0], inferredAllocation)
        : undefined;
      if (casAsset) {
        return seeds.map((seed) => ({
          ...seed,
          asset: casAsset,
          status: "ready" as const,
        }));
      }
      if (matchingCasSchemes?.[0]) {
        const candidates = casFundAllocationCandidates(matchingCasSchemes[0]);
        return seeds.map((seed) => ({
          ...seed,
          candidates,
          status: "selectionRequired" as const,
        }));
      }
      if (cachedCandidates?.length) return seeds.map((seed) => ({ ...seed, candidates: cachedCandidates, status: "selectionRequired" as const }));
      try {
        let lookup = await searchAssetLookupResults({
          query: lookupQuery(first.row),
        });
        if (first.row.source?.format === "zerodha-tradebook" &&
            !exactTradebookSuggestion(seeds.map((seed) => seed.row), lookup.results)) {
          const symbols = [...new Set(seeds.map((seed) => seed.row.symbol).filter((symbol): symbol is string => Boolean(symbol)))];
          for (const symbol of symbols) {
            if (!isCurrent()) return seeds;
            const bySymbol = await searchAssetLookupResults({ query: symbol });
            lookup = { failures: [...lookup.failures, ...bySymbol.failures], results: [...lookup.results, ...bySymbol.results] };
          }
        }
        const candidates = [...new Map(lookup.results.map(assetFromLookupResult)
          .filter((asset) => seeds.every((seed) => compatibleTransactionCandidate(asset, seed.row)))
          .map((asset) => [asset.id, asset])).values()];
        if (candidates.length > 0 && isCurrent()) lookupCache.set(cacheKey, candidates);
        const status =
          candidates.length > 0
            ? ("selectionRequired" as const)
            : ("unresolved" as const);
        return seeds.map((seed) => ({
          ...seed,
          candidates,
          status,
        }));
      } catch {
        return seeds.map((seed) => ({
          ...seed,
          status: "unresolved" as const,
        }));
      }
    },
  );
  return resolvedGroups.flat();
}
