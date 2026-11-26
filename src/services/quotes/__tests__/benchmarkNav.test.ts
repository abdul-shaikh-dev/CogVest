import { createMemoryJsonStorage } from "@/src/services/storage";
import { AssetHistoryError } from "@/src/services/quotes/assetHistoryProvider";
import { benchmarkWindows, loadBenchmarkNav, readCachedBenchmarkNav } from "@/src/services/quotes/benchmarkNav";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import type { DailyPriceEntry, DailyPriceRequest } from "@/src/types";

const now = new Date("2026-11-26T06:00:00Z");

function entryFor(request: DailyPriceRequest): DailyPriceEntry {
  const points = [request.from, request.to].map((date, index) => ({ close: 100 + index, date }));
  return { ...request, complete: true, fetchedAt: now.toISOString(), points } as DailyPriceEntry;
}

describe("benchmark NAV windows (#765)", () => {
  it("splits the period into calendar years, starting a holiday gap early", () => {
    expect(benchmarkWindows("2025-01-03", "2026-11-26")).toEqual([
      { from: "2024-12-28", to: "2024-12-31" },
      { from: "2025-01-01", to: "2025-12-31" },
      { from: "2026-01-01", to: "2026-11-26" },
    ]);
    expect(benchmarkWindows("2026-03-10", "2026-11-26")).toEqual([{ from: "2026-03-04", to: "2026-11-26" }]);
  });

  it("fetches each missing window once, then reads the whole period from the cache", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const loader = jest.fn(async (request: DailyPriceRequest) => entryFor(request));

    expect(readCachedBenchmarkNav(cache, "2025-06-01", "2026-11-26", now)).toEqual({ status: "missing" });
    const loaded = await loadBenchmarkNav(cache, "2025-06-01", "2026-11-26", loader, now);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader.mock.calls.map(([request]) => request.providerId)).toEqual(["INF789F01XA0", "INF789F01XA0"]);
    expect(loaded).toEqual({ points: [
      { close: 100, date: "2025-05-26" }, { close: 101, date: "2025-12-31" },
      { close: 100, date: "2026-01-01" }, { close: 101, date: "2026-11-26" },
    ], status: "ready" });
    expect(readCachedBenchmarkNav(cache, "2025-06-01", "2026-11-26", now)).toEqual(loaded);
    await loadBenchmarkNav(cache, "2025-06-01", "2026-11-26", loader, now);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("ends the last window on the UTC date while the local date is a day ahead", async () => {
    const earlyIst = new Date("2026-11-25T20:00:00Z"); // 01:30 on 26 Nov in India
    const cache = createDailyPriceCache({ now: () => earlyIst, storage: createMemoryJsonStorage() });
    const loader = jest.fn(async (request: DailyPriceRequest) => ({ ...entryFor(request), fetchedAt: earlyIst.toISOString() }));

    await expect(loadBenchmarkNav(cache, "2026-03-01", "2026-11-26", loader, earlyIst)).resolves.toMatchObject({ status: "ready" });
    expect(loader.mock.calls[0][0]).toMatchObject({ from: "2026-02-23", to: "2026-11-25" });
    expect(readCachedBenchmarkNav(cache, "2026-03-01", "2026-11-26", earlyIst)).toMatchObject({ status: "ready" });
  });

  it("names the year and the reason when a window fails", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const offline = await loadBenchmarkNav(cache, "2026-03-01", "2026-11-26", async () => {
      throw new AssetHistoryError("offline", "AMFI NAV history could not be reached.");
    }, now);
    expect(offline).toEqual({ message: "AMFI couldn't be reached while loading 2026. Check your connection.", status: "failed" });

    const tooLarge = await loadBenchmarkNav(cache, "2026-03-01", "2026-11-26", async () => {
      throw new AssetHistoryError("invalid-data", "AMFI NAV history response exceeded the safety limit.");
    }, now);
    expect(tooLarge).toEqual({
      message: "The 2026 NAV history from AMFI couldn't be read: AMFI NAV history response exceeded the safety limit.",
      status: "failed",
    });
  });

  it("says a slow year timed out and that earlier years are kept for the retry", async () => {
    jest.useFakeTimers({ now });
    try {
      const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
      const loader = jest.fn((request: DailyPriceRequest) => (request.from.startsWith("2025")
        ? Promise.resolve(entryFor(request))
        : new Promise<DailyPriceEntry>(() => undefined)));
      const pending = loadBenchmarkNav(cache, "2025-06-01", "2026-11-26", loader, now);
      await jest.advanceTimersByTimeAsync(90_000);

      await expect(pending).resolves.toEqual({
        message: "AMFI took too long to send the 2026 NAV history. Earlier years are saved, so trying again continues from 2026.",
        status: "failed",
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("says when a year can't be saved on the phone", async () => {
    const cache = { read: () => ({ status: "miss" as const }), refresh: async () => ({ status: "unavailable" as const }) };
    const result = await loadBenchmarkNav(cache as never, "2026-03-01", "2026-11-26", async (request) => entryFor(request), now);
    expect(result).toEqual({ message: "The 2026 NAV history couldn't be saved on this phone.", status: "failed" });
  });

  it("reports progress by year, counting only years that need a request", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    // 2025 as a whole calendar year: its window starts a holiday gap before 7 Jan.
    await loadBenchmarkNav(cache, "2025-01-07", "2025-12-31", async (request) => entryFor(request), now);
    const progress: unknown[] = [];

    await loadBenchmarkNav(cache, "2023-06-01", "2026-11-26", async (request) => entryFor(request), now, (value) => progress.push(value));

    expect(progress).toEqual([
      { fraction: 0, year: 2023, yearIndex: 0, years: 3 },
      { fraction: 1 / 3, year: 2024, yearIndex: 1, years: 3 },
      { fraction: 2 / 3, year: 2026, yearIndex: 2, years: 3 },
    ]);
  });
});
