import { createMemoryJsonStorage } from "@/src/services/storage";
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

  it("says AMFI could not be reached when a window fails", async () => {
    const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
    const result = await loadBenchmarkNav(cache, "2026-03-01", "2026-11-26", async () => { throw new Error("offline"); }, now);
    expect(result).toEqual({ message: expect.stringContaining("couldn't be loaded from AMFI"), status: "failed" });
  });
});
