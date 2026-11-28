import * as Application from "expo-application";
import Constants from "expo-constants";
import { z } from "zod";

import {
  snapshotDriftFields,
  type SnapshotDriftCheckRecords,
  type SnapshotDriftField,
} from "@/src/domain/calculations";
import { getCalendarDatePart } from "@/src/domain/dates";
import { createMmkvJsonStorage, type JsonStorage } from "@/src/services/storage";
import type { MonthlySnapshot } from "@/src/types";

/**
 * The last drift check's answer per saved month (#851). Device-only and
 * derived: it holds fingerprints and field names, never values, and is never
 * backed up. Checking a long history takes seconds of JavaScript on a phone,
 * so Progress reuses a month's answer while neither the records that month
 * reads, that saved month nor the app build changed since it was checked. A
 * new build may work months out differently, so it checks every month once.
 */
export const snapshotDriftCacheStorageKey = "cogvest:v1:snapshot-drift-cache";
// Version 1 (#851) keyed every month on all records; version 2 (#852) on each month's own.
const cacheVersion = 2;

const cacheRecordSchema = z.object({
  build: z.string(),
  months: z.record(z.string(), z.object({
    fields: z.array(z.enum(snapshotDriftFields)).nullable(),
    records: z.string(),
    snapshot: z.string(),
  })),
  version: z.literal(cacheVersion),
});

export type SnapshotDriftCacheRecord = z.infer<typeof cacheRecordSchema>;

export type SnapshotDriftCacheEntries = Pick<SnapshotDriftCacheRecord, "months">;

export type SnapshotDriftCache = {
  read: () => SnapshotDriftCacheEntries | null;
  write: (entries: SnapshotDriftCacheEntries) => void;
};

/** cyrb53: the two 32-bit halves of a 53-bit hash, for matching, not security. */
function hashPair(text: string): [number, number] {
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}

/** A text's fingerprint in hex. */
export function fingerprintText(text: string) {
  const [h1, h2] = hashPair(text);
  return `${h2.toString(16)}-${h1.toString(16)}-${text.length.toString(36)}`;
}

type DatedRecord = { date: string; h1: number; h2: number };

/** The calendar day after a month's last day; records dated on or before it are in the month's scope. */
function dayAfterMonthEnd(month: string) {
  const [year, monthPart] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthPart, 1)).toISOString().slice(0, 10);
}

/**
 * Fingerprints of the records each month's check reads (#852). The month-end
 * generator reads trades and cash entries only up to the month end, so a record
 * dated later leaves earlier months' answers standing: adding this month's SIP
 * re-checks only this month. Everything it reads in full goes into every
 * month's fingerprint:
 * - assets, openings, distributions, and PPF accounts and ledger entries;
 * - every trade of a stock linked to a demerger, validated over its whole history;
 * - whether any trades or cash entries exist at all;
 * - any record whose date can't be read.
 * A month's scope runs a day past its end, so a timezone edge only re-checks.
 */
export function createDriftRecordFingerprints(records: SnapshotDriftCheckRecords) {
  const demergerAssetIds = new Set(records.assets.flatMap((asset) =>
    asset.demerger ? [asset.id, asset.demerger.childAssetId] : []));
  const shared: string[] = [];
  const dated: DatedRecord[] = [];
  const add = (kind: string, record: { date: string }, alwaysShared: boolean) => {
    const date = getCalendarDatePart(record.date);
    const text = `${kind}:${JSON.stringify(record)}`;
    if (alwaysShared || date === null) {
      shared.push(text);
      return;
    }
    const [h1, h2] = hashPair(text);
    dated.push({ date, h1, h2 });
  };
  for (const trade of records.trades) add("trade", trade, demergerAssetIds.has(trade.assetId));
  for (const entry of records.cashEntries) add("cash", entry, false);
  const sharedFingerprint = fingerprintText(JSON.stringify({
    assets: records.assets,
    distributions: records.distributions ?? null,
    hasCashEntries: records.cashEntries.length > 0,
    hasTrades: records.trades.length > 0,
    now: records.now.toISOString(),
    openingPositions: records.openingPositions,
    ppfAccounts: records.ppfAccounts ?? null,
    ppfLedgerEntries: records.ppfLedgerEntries ?? null,
    shared,
  }));
  return (month: string) => {
    const limit = dayAfterMonthEnd(month);
    let h1 = 0x9e3779b9;
    let h2 = 0x85ebca6b;
    let count = 0;
    // Order-sensitive and in record order, which is the order the generator reads them in.
    for (const record of dated) {
      if (record.date > limit) continue;
      h1 = Math.imul(h1 ^ record.h1, 2654435761) ^ (h2 >>> 15);
      h2 = Math.imul(h2 ^ record.h2, 1597334677) ^ (h1 >>> 13);
      count += 1;
    }
    return `${sharedFingerprint}:${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}-${count.toString(36)}`;
  };
}

export function fingerprintSavedMonth(saved: MonthlySnapshot) {
  return fingerprintText(JSON.stringify(saved));
}

/** The cached answer for a month, or undefined when it must be checked again. */
export function cachedMonthDrift(
  cache: SnapshotDriftCacheEntries | null,
  month: string,
  recordsFingerprint: string,
  savedFingerprint: string,
): { fields: SnapshotDriftField[] | null } | undefined {
  const entry = cache?.months[month];
  if (!entry || entry.records !== recordsFingerprint || entry.snapshot !== savedFingerprint) return undefined;
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
        return { months: parsed.data.months };
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
