import { createMemoryJsonStorage } from "@/src/services/storage";
import {
  dailyPriceCacheFixtureAssetCount,
  dailyPriceCacheFixtureFrom,
  dailyPriceCacheFixturePointCount,
  dailyPriceCacheFixtureTo,
  createDailyPriceCacheFixture,
  runDailyPriceCacheFixtureBenchmark,
} from "@/src/testing/dailyPriceCacheFixture";

describe("daily price cache QA fixture", () => {
  it("builds ten UTC daily histories covering 2016 through 2025 inclusively", () => {
    const entries = createDailyPriceCacheFixture();

    expect(entries).toHaveLength(
      dailyPriceCacheFixtureAssetCount,
    );
    expect(
      entries.reduce(
        (count, entry) => count + entry.points.length,
        0,
      ),
    ).toBe(dailyPriceCacheFixturePointCount);
    expect(entries[0].points[0].date).toBe(
      dailyPriceCacheFixtureFrom,
    );
    expect(entries.at(-1)?.points.at(-1)?.date).toBe(
      dailyPriceCacheFixtureTo,
    );
  });

  it("writes, cold reads, warm reads, and maps finite chart values in memory", () => {
    const result = runDailyPriceCacheFixtureBenchmark(createMemoryJsonStorage());

    expect(result.fixture.pointCount).toBe(dailyPriceCacheFixturePointCount);
    expect(result.storageBytes).toBeGreaterThan(0);
    expect(result.writes.statuses).toEqual(Array(10).fill("stored"));
    expect(result.coldRead.statuses).toEqual(Array(10).fill("hit"));
    expect(result.coldRead.freshnesses).toEqual(Array(10).fill("current"));
    expect(result.coldRead.coverages).toEqual(Array(10).fill("complete"));
    expect(result.warmRead.statuses).toEqual(Array(10).fill("hit"));
    expect(result.chartTransform.pointCount).toBe(3650);
    expect(result.chartTransform.finiteValueCount).toBe(3650);

    if (process.env.COGVEST_CACHE_BENCHMARK === "1") {
      console.info("[quote-cache-qa] result", JSON.stringify(result));
    }
  });
});
