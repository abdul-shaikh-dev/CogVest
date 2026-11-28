import { createMemoryJsonStorage } from "@/src/services/storage";
import type { MonthlySnapshot } from "@/src/types";

import {
  cachedMonthDrift,
  createSnapshotDriftCache,
  fingerprintDriftRecords,
  fingerprintSavedMonth,
  fingerprintText,
  snapshotDriftCacheStorageKey,
} from "../snapshotDriftCache";

const saved: MonthlySnapshot = {
  cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: 100, id: "2026-01", investedValue: 100, month: "2026-01",
  monthlyInvestment: 0, portfolioValue: 100,
  generated: { generatedAt: "2026-11-01T00:00:00Z", priceBasis: "historical-close", source: "manual", warnings: [] },
};
const records = {
  assets: [], cashEntries: [], now: new Date("2026-11-15T12:00:00Z"), openingPositions: [], trades: [],
};

test("fingerprints tell apart texts that differ by one character or only in length", () => {
  expect(fingerprintText("investedValue")).toBe(fingerprintText("investedValue"));
  expect(fingerprintText("investedValue")).not.toBe(fingerprintText("investedValuf"));
  expect(fingerprintText("")).not.toBe(fingerprintText("\u0000"));
});

test("a month's answer is reused only for the same records and the same saved month", () => {
  const recordsFingerprint = fingerprintDriftRecords(records);
  const cache = { months: { "2026-01": { fields: ["cashValue" as const], snapshot: fingerprintSavedMonth(saved) } }, records: recordsFingerprint };
  expect(cachedMonthDrift(cache, recordsFingerprint, saved)).toEqual({ fields: ["cashValue"] });
  expect(cachedMonthDrift(cache, fingerprintDriftRecords({ ...records, now: new Date("2026-12-15T12:00:00Z") }), saved))
    .toBeUndefined();
  expect(cachedMonthDrift(cache, recordsFingerprint, { ...saved, investedValue: 101 })).toBeUndefined();
  expect(cachedMonthDrift(cache, recordsFingerprint, { ...saved, id: "2026-02", month: "2026-02" })).toBeUndefined();
  expect(cachedMonthDrift(null, recordsFingerprint, saved)).toBeUndefined();
});

test("the stored cache holds fingerprints and field names only, and belongs to one app build", () => {
  const storage = createMemoryJsonStorage();
  const entries = { months: { "2026-01": { fields: null, snapshot: fingerprintSavedMonth(saved) } }, records: fingerprintDriftRecords(records) };
  createSnapshotDriftCache(storage, "1.0.44+7").write(entries);
  const raw = storage.getRawItem(snapshotDriftCacheStorageKey) ?? "";
  expect(raw).not.toContain("100");
  expect(createSnapshotDriftCache(storage, "1.0.44+7").read()).toEqual(entries);
  expect(createSnapshotDriftCache(storage, "1.0.45+8").read()).toBeNull();
});

test("an unreadable or unwritable cache only means checking again", () => {
  const storage = createMemoryJsonStorage();
  storage.setRawItem(snapshotDriftCacheStorageKey, "{not json");
  expect(createSnapshotDriftCache(storage, "b").read()).toBeNull();
  storage.setItem(snapshotDriftCacheStorageKey, { build: "b", months: { x: { fields: ["price"], snapshot: "s" } }, records: "r", version: 1 });
  expect(createSnapshotDriftCache(storage, "b").read()).toBeNull();
  const failing = { ...storage, setItem: () => { throw new Error("disk full"); } };
  expect(() => createSnapshotDriftCache(failing, "b").write({ months: {}, records: "r" })).not.toThrow();
});
