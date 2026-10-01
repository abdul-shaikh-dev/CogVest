import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createAndroidScaleFixture } from "../androidScaleFixture";

it("keeps a current-date combined native fixture valid and cache-complete", () => {
  const now = new Date("2026-10-01T08:00:00Z");
  const fixture = createAndroidScaleFixture(now);
  const cache = createDailyPriceCache({ now: () => now, storage: createMemoryJsonStorage() });
  expect(fixture.portfolio.assets).toHaveLength(250);
  expect(fixture.portfolio.trades).toHaveLength(1000);
  expect(fixture.portfolio.monthlySnapshots).toHaveLength(93);
  expect(fixture.portfolio.monthlySnapshots.at(-1)?.month).toBe("2026-09");
  validateBackupPayload({ portfolio: fixture.portfolio, quoteCache: fixture.quoteCache,
    casFolioSalt: null, historicalQuoteCache: {} });
  for (const entry of fixture.dailyPriceEntries) {
    expect(entry.points).toHaveLength(3653);
    expect(entry.to).toBe("2026-09-30");
    expect(cache.write(entry).status).toBe("stored");
    expect(cache.read(entry).status).toBe("hit");
  }
});
