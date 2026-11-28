import type { SnapshotDriftCheckRecords } from "@/src/domain/calculations";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { Asset, CashEntry, MonthlySnapshot, Trade } from "@/src/types";

import {
  cachedMonthDrift,
  createDriftRecordFingerprints,
  createSnapshotDriftCache,
  fingerprintSavedMonth,
  fingerprintText,
  snapshotDriftCacheStorageKey,
} from "../snapshotDriftCache";

const saved: MonthlySnapshot = {
  cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: 100, id: "2026-01", investedValue: 100, month: "2026-01",
  monthlyInvestment: 0, portfolioValue: 100,
  generated: { generatedAt: "2026-11-01T00:00:00Z", priceBasis: "historical-close", source: "manual", warnings: [] },
};
const trade = (id: string, date: string, assetId = "fund"): Trade => ({
  assetId, date, id, pricePerUnit: 10, quantity: 1, totalValue: 10, type: "buy",
});
const cash = (id: string, date: string): CashEntry => ({ amount: 50, date, id, type: "addition" } as CashEntry);
const records = (overrides: Partial<SnapshotDriftCheckRecords> = {}): SnapshotDriftCheckRecords => ({
  assets: [{ id: "fund" } as Asset], cashEntries: [cash("c1", "2026-01-10")], now: new Date("2026-11-15T12:00:00Z"),
  openingPositions: [], trades: [trade("t1", "2026-01-05"), trade("t2", "2026-03-05")], ...overrides,
});

test("fingerprints tell apart texts that differ by one character or only in length", () => {
  expect(fingerprintText("investedValue")).toBe(fingerprintText("investedValue"));
  expect(fingerprintText("investedValue")).not.toBe(fingerprintText("investedValuf"));
  expect(fingerprintText("")).not.toBe(fingerprintText("\u0000"));
});

test("a record dated after a month leaves that month's fingerprint alone (#852)", () => {
  const before = createDriftRecordFingerprints(records());
  const later = createDriftRecordFingerprints(records({
    cashEntries: [cash("c1", "2026-01-10"), cash("c2", "2026-04-02")],
    trades: [trade("t1", "2026-01-05"), trade("t2", "2026-03-05"), trade("t3", "2026-05-01")],
  }));
  for (const month of ["2026-01", "2026-02", "2026-03"]) expect(later(month)).toBe(before(month));
  expect(later("2026-04")).not.toBe(before("2026-04"));
  expect(later("2026-05")).not.toBe(before("2026-05"));
  // A record on the first day after a month end re-checks that month too: timezone slack.
  const nextDay = createDriftRecordFingerprints(records({ trades: [...records().trades, trade("t4", "2026-02-01")] }));
  expect(nextDay("2026-01")).not.toBe(before("2026-01"));
  expect(nextDay("2025-12")).toBe(before("2025-12"));
});

test("an edited, removed or reordered record re-checks every month from its date", () => {
  const before = createDriftRecordFingerprints(records());
  const edited = createDriftRecordFingerprints(records({ trades: [trade("t1", "2026-01-05"), { ...trade("t2", "2026-03-05"), quantity: 2 }] }));
  expect(edited("2026-02")).toBe(before("2026-02"));
  expect(edited("2026-03")).not.toBe(before("2026-03"));
  const removed = createDriftRecordFingerprints(records({ trades: [trade("t1", "2026-01-05")] }));
  expect(removed("2026-03")).not.toBe(before("2026-03"));
  const reordered = createDriftRecordFingerprints(records({ trades: [trade("t2", "2026-03-05"), trade("t1", "2026-01-05")] }));
  expect(reordered("2026-03")).not.toBe(before("2026-03"));
});

test("records the generator reads in full re-check every month", () => {
  const before = createDriftRecordFingerprints(records());
  const variants: Partial<SnapshotDriftCheckRecords>[] = [
    { assets: [{ id: "fund", name: "Renamed" } as Asset] },
    { openingPositions: [{ assetId: "fund", id: "o1" } as never] },
    { distributions: [{ id: "d1" } as never] },
    { ppfAccounts: [{ id: "p1" } as never] },
    { ppfLedgerEntries: [{ date: "2026-10-01", id: "l1" } as never] },
    { now: new Date("2026-12-15T12:00:00Z") },
    // A trade with no readable date can't be scoped to a month.
    { trades: [...records().trades, trade("t9", "someday")] },
  ];
  for (const variant of variants) {
    expect(createDriftRecordFingerprints(records(variant))("2025-06")).not.toBe(before("2025-06"));
  }
});

test("every trade of a demerger-linked stock re-checks every month, since the demerger is validated over all of them", () => {
  const assets = [
    { demerger: { childAssetId: "child", eventId: "e1" }, id: "parent" } as Asset,
    { id: "child" } as Asset,
    { id: "fund" } as Asset,
  ];
  const before = createDriftRecordFingerprints(records({ assets }));
  const childTrade = createDriftRecordFingerprints(records({ assets, trades: [...records().trades, trade("t5", "2026-09-01", "child")] }));
  expect(childTrade("2025-06")).not.toBe(before("2025-06"));
  const otherTrade = createDriftRecordFingerprints(records({ assets, trades: [...records().trades, trade("t6", "2026-09-01")] }));
  expect(otherTrade("2025-06")).toBe(before("2025-06"));
});

test("whether any trades or cash entries exist at all is part of every month", () => {
  const empty = createDriftRecordFingerprints(records({ cashEntries: [], trades: [] }));
  const later = createDriftRecordFingerprints(records({ cashEntries: [], trades: [trade("t7", "2026-09-01")] }));
  expect(later("2025-06")).not.toBe(empty("2025-06"));
});

test("a month's answer is reused only for the same records and the same saved month", () => {
  const fingerprint = createDriftRecordFingerprints(records())("2026-01");
  const snapshot = fingerprintSavedMonth(saved);
  const cache = { months: { "2026-01": { fields: ["cashValue" as const], records: fingerprint, snapshot } } };
  expect(cachedMonthDrift(cache, "2026-01", fingerprint, snapshot)).toEqual({ fields: ["cashValue"] });
  expect(cachedMonthDrift(cache, "2026-01", `${fingerprint}x`, snapshot)).toBeUndefined();
  expect(cachedMonthDrift(cache, "2026-01", fingerprint, fingerprintSavedMonth({ ...saved, investedValue: 101 }))).toBeUndefined();
  expect(cachedMonthDrift(cache, "2026-02", fingerprint, snapshot)).toBeUndefined();
  expect(cachedMonthDrift(null, "2026-01", fingerprint, snapshot)).toBeUndefined();
});

test("the stored cache holds fingerprints and field names only, and belongs to one app build", () => {
  const storage = createMemoryJsonStorage();
  const entries = { months: { "2026-01": { fields: null, records: "r", snapshot: fingerprintSavedMonth(saved) } } };
  createSnapshotDriftCache(storage, "1.0.44+7").write(entries);
  const raw = storage.getRawItem(snapshotDriftCacheStorageKey) ?? "";
  expect(raw).not.toContain("100");
  expect(createSnapshotDriftCache(storage, "1.0.44+7").read()).toEqual(entries);
  expect(createSnapshotDriftCache(storage, "1.0.45+8").read()).toBeNull();
});

test("an unreadable, outdated or unwritable cache only means checking again", () => {
  const storage = createMemoryJsonStorage();
  storage.setRawItem(snapshotDriftCacheStorageKey, "{not json");
  expect(createSnapshotDriftCache(storage, "b").read()).toBeNull();
  storage.setItem(snapshotDriftCacheStorageKey, { build: "b", months: { x: { fields: ["price"], records: "r", snapshot: "s" } }, version: 2 });
  expect(createSnapshotDriftCache(storage, "b").read()).toBeNull();
  // The #851 layout keyed every month on all records.
  storage.setItem(snapshotDriftCacheStorageKey, { build: "b", months: { x: { fields: null, snapshot: "s" } }, records: "r", version: 1 });
  expect(createSnapshotDriftCache(storage, "b").read()).toBeNull();
  const failing = { ...storage, setItem: () => { throw new Error("disk full"); } };
  expect(() => createSnapshotDriftCache(failing, "b").write({ months: {} })).not.toThrow();
});
