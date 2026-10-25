import { useEffect, useMemo, useState } from "react";

import { createCanonicalAssetMatcher } from "@/src/domain/assets";
import type {
  AssetLookupResult,
  AssetLookupSearchResult,
} from "@/src/services/assetLookup";
import type { JsonStorage } from "@/src/services/storage";
import type { Asset } from "@/src/types";

import { matchesDiscoveryFilter, searchSavedAssets, type DiscoveryFilter } from "./assetDiscovery";
import { readRecentAssetSearches, saveRecentAssetSearch, clearRecentAssetSearches } from "./recentAssetSearches";

type UseAssetDiscoveryInput = {
  assets: Asset[];
  recentSearchStorage?: JsonStorage;
  searchAssetLookupResults: (input: {
    query: string;
    signal?: AbortSignal;
  }) => Promise<AssetLookupSearchResult>;
};

/**
 * Add Holding asset search: saved-asset matches, debounced public lookup,
 * discovery filters, paging and recent searches.
 */
export function useAssetDiscovery({
  assets,
  recentSearchStorage,
  searchAssetLookupResults,
}: UseAssetDiscoveryInput) {
  const [lookupQuery, setLookupQuery] = useState("");
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryFilter>("all");
  const [visibleResultCount, setVisibleResultCount] = useState(20);
  const [visibleSavedCount, setVisibleSavedCount] = useState(6);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return readRecentAssetSearches(recentSearchStorage); } catch { return []; }
  });
  const [recentSearchStatus, setRecentSearchStatus] = useState("");
  const [lookupResults, setLookupResults] = useState<AssetLookupResult[]>([]);
  const [lookupResultQuery, setLookupResultQuery] = useState("");
  const [isLookupSearching, setIsLookupSearching] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [canRetryLookup, setCanRetryLookup] = useState(false);
  const [lookupRetryKey, setLookupRetryKey] = useState(0);

  const matchingExistingAssets = useMemo(() => searchSavedAssets(assets, lookupQuery), [lookupQuery, assets]);
  const savedAssetMatcher = useMemo(() => createCanonicalAssetMatcher(assets), [assets]);
  const filteredSavedAssets = useMemo(
    () => matchingExistingAssets.filter((asset) => matchesDiscoveryFilter(asset, discoveryFilter)),
    [discoveryFilter, matchingExistingAssets],
  );
  const filteredLookupResults = useMemo(
    () =>
      lookupResultQuery === lookupQuery.trim()
        ? lookupResults
            .slice(0, 100)
            .filter(
              (asset) =>
                !savedAssetMatcher.find(asset) &&
                matchesDiscoveryFilter(asset, discoveryFilter),
            )
        : [],
    [discoveryFilter, lookupQuery, lookupResultQuery, lookupResults, savedAssetMatcher],
  );
  const visibleLookupResults = useMemo(
    () => filteredLookupResults.slice(0, visibleResultCount),
    [filteredLookupResults, visibleResultCount],
  );
  const visibleSavedAssets = useMemo(
    () => filteredSavedAssets.slice(0, visibleSavedCount),
    [filteredSavedAssets, visibleSavedCount],
  );
  useEffect(() => {
    setVisibleResultCount(20);
    setVisibleSavedCount(lookupQuery.trim() ? 20 : 6);
  }, [lookupQuery, discoveryFilter]);
  useEffect(() => { setLookupResults([]); }, [lookupQuery]);

  function loadMoreLookupResults() {
    setVisibleResultCount((count) => Math.min(count + 20, filteredLookupResults.length, 100));
  }

  function rememberSearch() {
    try { setRecentSearches(saveRecentAssetSearch(lookupQuery, recentSearchStorage)); } catch {
      setRecentSearchStatus("Recent search could not be saved on this device.");
    }
  }

  function clearSearchHistory() {
    try {
      clearRecentAssetSearches(recentSearchStorage);
      setRecentSearches([]);
      setRecentSearchStatus("");
    } catch { setRecentSearchStatus("Could not clear recent searches. Try again."); }
  }

  useEffect(() => {
    const trimmedQuery = lookupQuery.trim();

    if (trimmedQuery.length === 0) {
      setLookupResults([]);
      setLookupStatus("");
      setIsLookupSearching(false);
      setCanRetryLookup(false);
      return undefined;
    }

    if (trimmedQuery.length < 2) {
      setLookupResults([]);
      setLookupStatus("Type at least 2 characters to search.");
      setIsLookupSearching(false);
      setCanRetryLookup(false);
      return undefined;
    }

    let isCancelled = false;
    const controller = new AbortController();

    setIsLookupSearching(true);
    setLookupStatus("Searching public asset directories...");
    setCanRetryLookup(false);

    const timeout = setTimeout(async () => {
      try {
        const result = await searchAssetLookupResults({ query: trimmedQuery, signal: controller.signal });

        if (isCancelled) {
          return;
        }

        const providerResults = result.results.filter((lookupResult) => !savedAssetMatcher.find(lookupResult));

        setLookupResults(providerResults);
        setLookupResultQuery(trimmedQuery);
        setLookupStatus(
          providerResults.length > 0
            ? "Select a result to autofill asset details."
            : matchingExistingAssets.length > 0
              ? "This asset is already in your saved assets."
            : "No public result found. You can enter details manually.",
        );

        if (
          result.failures.length > 0 &&
          providerResults.length === 0 &&
          matchingExistingAssets.length === 0
        ) {
          setLookupStatus("Lookup unavailable. You can enter details manually.");
          setCanRetryLookup(true);
        } else if (result.failures.length > 0) {
          setLookupStatus("Some sources are unavailable. Showing available matches; manual entry is also available.");
        }
      } catch {
        if (!isCancelled) {
          setLookupResults([]);
          setLookupStatus("Lookup unavailable. You can enter details manually.");
          setCanRetryLookup(true);
        }
      } finally {
        if (!isCancelled) {
          setIsLookupSearching(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    lookupQuery,
    lookupRetryKey,
    matchingExistingAssets.length,
    searchAssetLookupResults,
    assets,
    savedAssetMatcher,
  ]);

  function retryLookup() {
    if (lookupQuery.trim().length >= 2 && !isLookupSearching) {
      setLookupRetryKey((key) => key + 1);
    }
  }

  return {
    canRetryLookup,
    clearSearchHistory,
    discoveryFilter,
    hasMoreLookupResults: visibleResultCount < filteredLookupResults.length,
    hasMoreSavedAssets: visibleSavedCount < filteredSavedAssets.length,
    isLookupSearching,
    loadMoreLookupResults,
    loadMoreSavedAssets: () => setVisibleSavedCount((count) => count + 20),
    lookupQuery,
    lookupResults: visibleLookupResults,
    lookupStatus,
    matchingExistingAssets: visibleSavedAssets,
    recentSearchStatus,
    recentSearches,
    rememberSearch,
    retryLookup,
    setDiscoveryFilter,
    setLookupQuery,
    setLookupResults,
    setLookupStatus,
  };
}
