import { createV3ScaleFixture } from "./v3ScaleFixture";

/** Current-date synthetic records for native scale QA, never production seeding. */
export function createAndroidScaleFixture(now = new Date()) {
  const fixture = createV3ScaleFixture();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const offset = end.getTime() - Date.parse("2025-12-31T00:00:00Z");
  fixture.dailyPriceEntries = fixture.dailyPriceEntries.map((entry) => ({
    ...entry,
    fetchedAt: now.toISOString(),
    from: new Date(Date.parse(`${entry.from}T00:00:00Z`) + offset).toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    points: entry.points.map((point) => ({ ...point,
      date: new Date(Date.parse(`${point.date}T00:00:00Z`) + offset).toISOString().slice(0, 10) })),
  }));
  // Include every completed month since the earliest opening: startup should not
  // fetch fictional providers to fill unrelated gaps during offline measurements.
  const months = (now.getUTCFullYear() - 2019) * 12 + now.getUTCMonth();
  fixture.portfolio.monthlySnapshots = Array.from({ length: months }, (_, index) => {
    const baseline = fixture.portfolio.monthlySnapshots[index % 60];
    const month = new Date(Date.UTC(2019, index, 1)).toISOString().slice(0, 7);
    return { ...baseline, id: `v3-native-snapshot-${month}`, month };
  });
  fixture.portfolio.preferences.hasCompletedOnboarding = true;
  fixture.portfolio.preferences.nudgeVersions = { metadata: 1, minimal: 1, insights: 1 };
  fixture.quoteCache = Object.fromEntries(Object.entries(fixture.quoteCache)
    .map(([id, quote]) => [id, { ...quote, asOf: now.toISOString() }]));
  fixture.now = now;
  return fixture;
}
