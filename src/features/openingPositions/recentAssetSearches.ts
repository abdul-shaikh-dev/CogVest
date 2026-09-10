import { createMmkvJsonStorage, type JsonStorage } from "@/src/services/storage";

export const recentAssetSearchesKey = "cogvest:recent-asset-searches:v1";
const limit = 5;

// Convenience history only: never part of the portfolio or exported backup.
export function readRecentAssetSearches(storage: JsonStorage = createMmkvJsonStorage()): string[] {
  try {
    const value = storage.getItem(recentAssetSearchesKey);
    return Array.isArray(value) ? value.filter((item): item is string =>
      typeof item === "string" && item.trim().length >= 2 && item.length <= 100).slice(0, limit) : [];
  } catch {
    return [];
  }
}

export function saveRecentAssetSearch(query: string, storage: JsonStorage = createMmkvJsonStorage()) {
  const value = query.trim().slice(0, 100);
  if (value.length < 2) return readRecentAssetSearches(storage);
  const next = [value, ...readRecentAssetSearches(storage).filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, limit);
  storage.setItem(recentAssetSearchesKey, next);
  return next;
}

export function clearRecentAssetSearches(storage: JsonStorage = createMmkvJsonStorage()) {
  storage.removeItem(recentAssetSearchesKey);
}
