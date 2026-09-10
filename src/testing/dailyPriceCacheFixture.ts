import {
  createDailyPriceCache,
  dailyPriceCacheStorageKey,
  type DailyPriceEntry,
  type DailyPriceRequest,
} from "@/src/services/quotes/dailyPriceCache";
import type { JsonStorage } from "@/src/services/storage";

export const dailyPriceCacheFixtureNow = new Date("2026-01-01T12:00:00.000Z");
export const dailyPriceCacheFixtureFrom = "2016-01-01";
export const dailyPriceCacheFixtureTo = "2025-12-31";
export const dailyPriceCacheFixtureAssetCount = 10;
export const dailyPriceCacheFixturePointCount = 36530;

function toUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildPoints(assetIndex: number) {
  const points: DailyPriceEntry["points"] = [];
  const cursor = new Date(`${dailyPriceCacheFixtureFrom}T00:00:00.000Z`);
  const end = new Date(`${dailyPriceCacheFixtureTo}T00:00:00.000Z`);
  let day = 0;

  while (cursor <= end) {
    points.push({
      close: Math.round((100 + assetIndex * 37 + day * 0.19) * 100) / 100,
      date: toUtcDate(cursor),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    day += 1;
  }

  return points;
}

export function createDailyPriceCacheFixture(): DailyPriceEntry[] {
  return Array.from({ length: dailyPriceCacheFixtureAssetCount }, (_, index) => ({
    basis: "close",
    complete: true,
    currency: "INR",
    fetchedAt: dailyPriceCacheFixtureNow.toISOString(),
    from: dailyPriceCacheFixtureFrom,
    points: buildPoints(index + 1),
    provider: index % 2 === 0 ? "yahoo" : "coingecko",
    providerId: `daily-price-qa-${(index + 1).toString().padStart(2, "0")}`,
    to: dailyPriceCacheFixtureTo,
  }));
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function requestFor(entry: DailyPriceEntry): DailyPriceRequest {
  const { basis, currency, from, provider, providerId, to } = entry;

  return { basis, currency, from, provider, providerId, to };
}

function storageByteCount(storage: JsonStorage) {
  const raw = storage.getRawItem(dailyPriceCacheStorageKey) ?? "";

  let byteCount = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);

    if (code < 0x80) {
      byteCount += 1;
    } else if (code < 0x800) {
      byteCount += 2;
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < raw.length &&
      raw.charCodeAt(index + 1) >= 0xdc00 &&
      raw.charCodeAt(index + 1) <= 0xdfff
    ) {
      byteCount += 4;
      index += 1;
    } else {
      byteCount += 3;
    }
  }

  return byteCount;
}

export type DailyPriceCacheBenchmarkResult = {
  chartTransform: {
    finiteValueCount: number;
    milliseconds: number;
    pointCount: number;
  };
  coldRead: {
    coverages: string[];
    freshnesses: string[];
    milliseconds: number;
    statuses: string[];
  };
  fixture: {
    from: string;
    pointCount: number;
    to: string;
  };
  storageBytes: number;
  warmRead: {
    milliseconds: number;
    statuses: string[];
  };
  writes: {
    milliseconds: number;
    statuses: string[];
    writeLatenciesMs: number[];
  };
};

export function runDailyPriceCacheFixtureBenchmark(
  storage: JsonStorage,
): DailyPriceCacheBenchmarkResult {
  const entries = createDailyPriceCacheFixture();
  const cache = createDailyPriceCache({
    now: () => dailyPriceCacheFixtureNow,
    storage,
  });
  const writeLatenciesMs: number[] = [];
  const writeStartedAt = now();
  const writes = entries.map((entry) => {
    const startedAt = now();
    const result = cache.write(entry);

    writeLatenciesMs.push(now() - startedAt);
    return result;
  });
  const writeMilliseconds = now() - writeStartedAt;
  const storageBytes = storageByteCount(storage);
  const coldCache = createDailyPriceCache({
    now: () => dailyPriceCacheFixtureNow,
    storage,
  });
  const coldStartedAt = now();
  const coldReads = entries.map((entry) =>
    coldCache.read(requestFor(entry)),
  );
  const coldMilliseconds = now() - coldStartedAt;
  const warmStartedAt = now();
  const warmReads = entries.map((entry) =>
    coldCache.read(requestFor(entry)),
  );
  const warmMilliseconds = now() - warmStartedAt;
  const chartStartedAt = now();
  const chartPoints = entries.flatMap((entry) => {
    const result = coldCache.read({
      ...requestFor(entry),
      from: "2025-01-01",
      to: dailyPriceCacheFixtureTo,
    });

    return result.status === "hit"
      ? result.entry.points.map((point) => ({ date: point.date, value: point.close }))
      : [];
  });
  const chartMilliseconds = now() - chartStartedAt;

  return {
    chartTransform: {
      finiteValueCount: chartPoints.filter((point) => Number.isFinite(point.value))
        .length,
      milliseconds: chartMilliseconds,
      pointCount: chartPoints.length,
    },
    coldRead: {
      coverages: coldReads.map((result) =>
        result.status === "hit" ? result.coverage : result.status,
      ),
      freshnesses: coldReads.map((result) =>
        result.status === "hit" ? result.freshness : result.status,
      ),
      milliseconds: coldMilliseconds,
      statuses: coldReads.map((result) => result.status),
    },
    fixture: {
      from: dailyPriceCacheFixtureFrom,
      pointCount: entries.reduce(
        (count, entry) => count + entry.points.length,
        0,
      ),
      to: dailyPriceCacheFixtureTo,
    },
    storageBytes,
    warmRead: {
      milliseconds: warmMilliseconds,
      statuses: warmReads.map((result) => result.status),
    },
    writes: {
      milliseconds: writeMilliseconds,
      statuses: writes.map((result) => result.status),
      writeLatenciesMs,
    },
  };
}
