import * as Application from "expo-application";
import Constants from "expo-constants";
import { z } from "zod";

import {
  snapshotDriftFields,
  type SnapshotDriftCheckRecords,
  type SnapshotDriftField,
} from "@/src/domain/calculations";
import { createMmkvJsonStorage, type JsonStorage } from "@/src/services/storage";
import type { MonthlySnapshot } from "@/src/types";

/**
 * The last drift check's answer per saved month (#851). Device-only and
 * derived: it holds fingerprints and field names, never values, and is never
 * backed up. Checking a long history takes seconds of JavaScript on a phone,
 * so Progress reuses a month's answer while neither the records, that saved
 * month nor the app build changed since it was checked. A new build may work
 * months out differently, so it checks every month once.
 */
export const snapshotDriftCacheStorageKey = "cogvest:v1:snapshot-drift-cache";
const cacheVersion = 1;

const cacheRecordSchema = z.object({
  build: z.string(),
  months: z.record(z.string(), z.object({
    fields: z.array(z.enum(snapshotDriftFields)).nullable(),
    snapshot: z.string(),
  })),
  records: z.string(),
  version: z.literal(cacheVersion),
});

export type SnapshotDriftCacheRecord = z.infer<typeof cacheRecordSchema>;

export type SnapshotDriftCacheEntries = Pick<SnapshotDriftCacheRecord, "months" | "records">;

export type SnapshotDriftCache = {
  read: () => SnapshotDriftCacheEntries | null;
  write: (entries: SnapshotDriftCacheEntries) => void;
};

/** A 53-bit hash (cyrb53) in hex: a fingerprint for matching, not security. */
export function fingerprintText(text: string) {
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16)}-${(h1 >>> 0).toString(16)}-${text.length.toString(36)}`;
}

/** Everything a month's check reads apart from the saved month itself. */
export function fingerprintDriftRecords(records: SnapshotDriftCheckRecords) {
  return fingerprintText(JSON.stringify({
    assets: records.assets,
    cashEntries: records.cashEntries,
    distributions: records.distributions ?? null,
    now: records.now.toISOString(),
    openingPositions: records.openingPositions,
    ppfAccounts: records.ppfAccounts ?? null,
    ppfLedgerEntries: records.ppfLedgerEntries ?? null,
    trades: records.trades,
  }));
}

export function fingerprintSavedMonth(saved: MonthlySnapshot) {
  return fingerprintText(JSON.stringify(saved));
}

/** The cached answer for a month, or undefined when it must be checked again. */
export function cachedMonthDrift(
  cache: SnapshotDriftCacheEntries | null,
  recordsFingerprint: string,
  saved: MonthlySnapshot,
): { fields: SnapshotDriftField[] | null } | undefined {
  if (!cache || cache.records !== recordsFingerprint) return undefined;
  const entry = cache.months[saved.month];
  if (!entry || entry.snapshot !== fingerprintSavedMonth(saved)) return undefined;
  return { fields: entry.fields };
}

/**
 * Reads and writes the cache in `storage` for app build `build`. Any failure
 * reads as an empty cache or skips the write: losing it only means checking
 * every month again.
 */
export function createSnapshotDriftCache(storage: JsonStorage, build: string): SnapshotDriftCache {
  return {
    read: () => {
      try {
        const raw = storage.getRawItem(snapshotDriftCacheStorageKey);
        if (raw === null) return null;
        const parsed = cacheRecordSchema.safeParse(JSON.parse(raw));
        if (!parsed.success || parsed.data.build !== build) return null;
        return { months: parsed.data.months, records: parsed.data.records };
      } catch {
        return null;
      }
    },
    write: (entries) => {
      try {
        const record: SnapshotDriftCacheRecord = { build, version: cacheVersion, ...entries };
        storage.setItem(snapshotDriftCacheStorageKey, record);
      } catch {
        // The next check simply starts again.
      }
    },
  };
}

const noCache: SnapshotDriftCache = { read: () => null, write: () => undefined };
let deviceCache: SnapshotDriftCache | undefined;

/** The cache on this device's storage, or none where storage can't load (tests, web). */
export function getDeviceSnapshotDriftCache(): SnapshotDriftCache {
  if (deviceCache) return deviceCache;
  try {
    const build = `${Constants.expoConfig?.version ?? "unknown"}+${Application.nativeBuildVersion ?? "unknown"}`;
    deviceCache = createSnapshotDriftCache(createMmkvJsonStorage(), build);
  } catch {
    deviceCache = noCache;
  }
  return deviceCache;
}
