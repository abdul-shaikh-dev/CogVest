import { createMemoryJsonStorage } from "@/src/services/storage";

import {
  createDailyPriceCache,
  dailyPriceCacheStorageKey,
  type DailyPriceEntry,
  type DailyPriceRequest,
} from "../dailyPriceCache";

const now = () => new Date("2026-09-10T12:00:00.000Z");
const request: DailyPriceRequest = {
  basis: "close", currency: "INR", from: "2026-09-01", provider: "yahoo", providerId: "RELIANCE.NS", to: "2026-09-05",
};

function entry(overrides: Partial<DailyPriceEntry> = {}): DailyPriceEntry {
  return {
    ...request,
    complete: true,
    fetchedAt: "2026-09-10T11:00:00.000Z",
    points: [
      { close: 100, date: "2026-09-01" },
      { close: 101, date: "2026-09-02" },
      { close: 102, date: "2026-09-03" },
      { close: 103, date: "2026-09-04" },
      { close: 104, date: "2026-09-05" },
    ],
    ...overrides,
  };
}

function tenYearPoints() {
  const first = Date.UTC(2016, 8, 1);
  return Array.from({ length: 3652 }, (_, index) => ({
    close: index + 1,
    date: new Date(first + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }));
}

describe("daily price cache", () => {
  it("stores, reuses a covering range, and slices only actual points", () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    expect(cache.write(entry())).toMatchObject({ status: "stored" });

    expect(cache.read({ ...request, from: "2026-09-02", to: "2026-09-04" })).toEqual({
      coverage: "complete",
      entry: expect.objectContaining({ from: "2026-09-02", points: [
        { close: 101, date: "2026-09-02" }, { close: 102, date: "2026-09-03" }, { close: 103, date: "2026-09-04" },
      ], to: "2026-09-04" }),
      freshness: "current",
      status: "hit",
    });
    expect(cache.read({ ...request, to: "2026-09-06" })).toEqual({ status: "missing" });
  });

  it("keeps provider, currency, basis, and provider ID identities separate", () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    cache.write(entry());
    expect(cache.read({ ...request, provider: "coingecko" })).toEqual({ status: "missing" });
    expect(cache.read({ ...request, currency: "USD" })).toEqual({ status: "missing" });
    expect(cache.read({ ...request, basis: "adjusted-close" })).toEqual({ status: "missing" });
    expect(cache.read({ ...request, providerId: "reliance.ns" })).toEqual({ status: "missing" });
  });

  it("rechecks raw storage while returning cloned points from the validated memo", () => {
    const storage = createMemoryJsonStorage();
    const first = createDailyPriceCache({ now, storage });
    const second = createDailyPriceCache({ now, storage });
    const stored = first.write(entry());
    expect(stored.status).toBe("stored");
    if (stored.status === "stored") stored.entry.points[0].close = 777;
    const initial = first.read(request);
    expect(initial.status).toBe("hit");
    if (initial.status === "hit") initial.entry.points[0].close = 999;
    const reread = first.read(request);
    expect(reread.status).toBe("hit");
    expect(reread.status === "hit" && reread.entry.points[0]).toEqual({ close: 100, date: "2026-09-01" });

    second.clear();
    expect(first.read(request)).toEqual({ status: "missing" });
  });

  it("reports partial and stale entries honestly and never downgrades complete data with partial data", () => {
    const storage = createMemoryJsonStorage();
    const cache = createDailyPriceCache({ now, storage });
    cache.write(entry({ fetchedAt: "2026-09-08T11:00:00.000Z" }));
    cache.write(entry({ complete: false, fetchedAt: "2026-09-10T11:00:00.000Z", points: [{ close: 999, date: "2026-09-03" }] }));

    expect(cache.read(request)).toMatchObject({ coverage: "complete", freshness: "stale", status: "hit" });
  });

  it("reports a partial hit and prefers a complete covering range", () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    cache.write(entry({ complete: false }));
    expect(cache.read(request)).toMatchObject({ coverage: "partial", status: "hit" });
    cache.write(entry({
      from: "2026-08-31",
      to: "2026-09-06",
      points: [
        { close: 99, date: "2026-08-31" }, ...entry().points,
        { close: 105, date: "2026-09-06" },
      ],
    }));
    expect(cache.read(request)).toMatchObject({ coverage: "complete", status: "hit" });
  });

  it("rejects an older exact-range entry instead of regressing a newer refresh", () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    expect(cache.write(entry({ fetchedAt: "2026-09-10T11:00:00.000Z" }))).toMatchObject({ status: "stored" });
    expect(cache.write(entry({ fetchedAt: "2026-09-10T10:00:00.000Z" }))).toEqual({ reason: "rejected", status: "rejected" });
  });

  it("rejects whitespace, invalid dates, future timestamps, invalid points, and oversized requests", () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    expect(cache.read({ ...request, providerId: " RELIANCE.NS" })).toEqual({ reason: "invalid", status: "invalid" });
    expect(cache.read({ ...request, from: "2026-02-30" })).toEqual({ reason: "invalid", status: "invalid" });
    expect(cache.read({ ...request, to: "2026-09-11" })).toEqual({ reason: "invalid", status: "invalid" });
    expect(cache.read({ ...request, from: "2015-01-01" })).toEqual({ reason: "invalid", status: "invalid" });
    expect(cache.write(entry({ fetchedAt: "2026-09-11T00:00:00.000Z" })).status).toBe("rejected");
    expect(cache.write(entry({ fetchedAt: "2026-09-10" })).status).toBe("rejected");
    expect(cache.write(entry({ points: [{ close: 0, date: "2026-09-01" }] })).status).toBe("rejected");
  });

  it("evicts the oldest disposable entries deterministically and preserves unrelated keys", () => {
    const storage = createMemoryJsonStorage({ "cogvest:portfolio": { protected: true } });
    const cache = createDailyPriceCache({ now, storage });
    for (let index = 0; index < 65; index += 1) {
      expect(cache.write(entry({ providerId: `ID-${index}` })).status).toBe("stored");
    }
    expect(cache.read({ ...request, providerId: "ID-0" })).toEqual({ status: "missing" });
    expect(storage.getRawItem("cogvest:portfolio")).toBe('{"protected":true}');
  });

  it("enforces per-entry and aggregate point caps and bounds oversized UTF-8 raw data", () => {
    const storage = createMemoryJsonStorage();
    const cache = createDailyPriceCache({ now, storage });
    expect(cache.write(entry({ points: Array.from({ length: 4001 }, () => ({ close: 1, date: "2026-09-01" })) })).status).toBe("rejected");
    storage.setRawItem(dailyPriceCacheStorageKey, "\u00e9".repeat(8 * 1024 * 1024));
    expect(cache.read(request)).toEqual({ reason: "corrupt", status: "corrupt" });
  });

  it("evicts disposable entries when valid ranges exceed 50,000 total points", () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    const points = tenYearPoints();
    const range = { from: "2016-09-01", points, to: "2026-08-31" };

    for (let index = 0; index < 14; index += 1) {
      expect(cache.write(entry({ ...range, providerId: `LONG-${index}` })).status).toBe("stored");
    }

    expect(cache.read({ ...request, ...range, providerId: "LONG-0" })).toEqual({ status: "missing" });
    expect(cache.read({ ...request, ...range, providerId: "LONG-13" }).status).toBe("hit");
  });

  it("returns unavailable when storage reads or writes throw", () => {
    const memory = createMemoryJsonStorage();
    const readFailure = { ...memory, getRawItem: () => { throw new Error("read"); } };
    expect(createDailyPriceCache({ now, storage: readFailure }).read(request)).toEqual({ status: "unavailable" });
    const writeFailure = { ...memory, setRawItem: () => { throw new Error("write"); } };
    expect(createDailyPriceCache({ now, storage: writeFailure }).write(entry())).toEqual({ status: "unavailable" });
  });

  it("contains corrupt data, requires explicit clear for incompatible versions, and recovers corruption on write", () => {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(dailyPriceCacheStorageKey, "{");
    const cache = createDailyPriceCache({ now, storage });
    expect(cache.read(request)).toEqual({ reason: "corrupt", status: "corrupt" });
    expect(cache.write(entry()).status).toBe("stored");
    storage.setRawItem(dailyPriceCacheStorageKey, JSON.stringify({ entries: [{ ...entry(), points: [null] }], generation: "bad", version: 1 }));
    expect(cache.read(request)).toEqual({ reason: "corrupt", status: "corrupt" });

    storage.setRawItem(dailyPriceCacheStorageKey, JSON.stringify({ entries: [], generation: "legacy", version: 99 }));
    expect(cache.write(entry())).toEqual({ reason: "incompatible", status: "rejected" });
    expect(cache.clear()).toEqual({ status: "cleared" });
    expect(cache.write(entry()).status).toBe("stored");
  });

  it("deduplicates matching refreshes, retains old data after failure, and rejects mismatched loader output", async () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    cache.write(entry());
    let resolve!: (value: DailyPriceEntry) => void;
    const loader = jest.fn(() => new Promise<DailyPriceEntry>((done) => { resolve = done; }));
    const first = cache.refresh(request, loader);
    const second = cache.refresh(request, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    resolve(entry());
    await expect(first).resolves.toMatchObject({ status: "refreshed" });
    await expect(second).resolves.toMatchObject({ status: "refreshed" });
    await expect(cache.refresh(request, async () => { throw new Error("offline"); })).resolves.toMatchObject({ entry: expect.anything(), reason: "failed", status: "failed" });
    await expect(cache.refresh(request, async () => entry({ providerId: "wrong" }))).resolves.toMatchObject({ reason: "mismatch", status: "failed" });
  });

  it("aborts timed-out refreshes and invalidates a refresh cleared by a sibling cache", async () => {
    jest.useFakeTimers();
    const storage = createMemoryJsonStorage();
    const first = createDailyPriceCache({ now, storage });
    const second = createDailyPriceCache({ now, storage });
    const timeout = first.refresh(request, async (_request, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
    jest.advanceTimersByTime(10_000);
    await expect(timeout).resolves.toMatchObject({ reason: "timeout", status: "failed" });

    const ignoredAbort = first.refresh(request, async () => new Promise<DailyPriceEntry>(() => {}));
    jest.advanceTimersByTime(10_000);
    await expect(ignoredAbort).resolves.toMatchObject({ reason: "timeout", status: "failed" });

    let resolve!: (value: DailyPriceEntry) => void;
    const pending = first.refresh(request, () => new Promise<DailyPriceEntry>((done) => { resolve = done; }));
    second.clear();
    resolve(entry());
    await expect(pending).resolves.toMatchObject({ reason: "invalidated", status: "failed" });
    jest.useRealTimers();
  });

  it("invalidates an in-flight refresh after corrupt clear or corruption recovery", async () => {
    const storage = createMemoryJsonStorage();
    const first = createDailyPriceCache({ now, storage });
    const second = createDailyPriceCache({ now, storage });
    first.write(entry());
    let resolve!: (value: DailyPriceEntry) => void;
    const pending = first.refresh(request, () => new Promise<DailyPriceEntry>((done) => { resolve = done; }));
    storage.setRawItem(dailyPriceCacheStorageKey, "{");
    expect(second.clear()).toEqual({ status: "cleared" });
    resolve(entry());
    await expect(pending).resolves.toMatchObject({ reason: "invalidated", status: "failed" });

    first.write(entry());
    const repaired = first.refresh(request, () => new Promise<DailyPriceEntry>((done) => { resolve = done; }));
    storage.setRawItem(dailyPriceCacheStorageKey, "{");
    expect(second.write(entry()).status).toBe("stored");
    resolve(entry());
    await expect(repaired).resolves.toMatchObject({ reason: "invalidated", status: "failed" });
  });

  it("starts a new refresh after clear without allowing the old task to clear it", async () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    let resolveOld!: (value: DailyPriceEntry) => void;
    let resolveNew!: (value: DailyPriceEntry) => void;
    const old = cache.refresh(request, () => new Promise<DailyPriceEntry>((done) => { resolveOld = done; }));
    expect(cache.clear()).toEqual({ status: "cleared" });
    const current = cache.refresh(request, () => new Promise<DailyPriceEntry>((done) => { resolveNew = done; }));
    resolveOld(entry());
    resolveNew(entry());
    await expect(old).resolves.toEqual({ reason: "invalidated", status: "failed" });
    await expect(current).resolves.toMatchObject({ status: "refreshed" });
  });

  it("omits pre-clear fallback data when a loader rejects after clear", async () => {
    const cache = createDailyPriceCache({ now, storage: createMemoryJsonStorage() });
    cache.write(entry());
    let reject!: (error: Error) => void;
    const pending = cache.refresh(request, () => new Promise<DailyPriceEntry>((_resolve, fail) => { reject = fail; }));
    cache.clear();
    reject(new Error("offline"));

    await expect(pending).resolves.toEqual({ reason: "invalidated", status: "failed" });
  });
});
