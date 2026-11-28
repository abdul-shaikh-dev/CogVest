import { useEffect, useMemo, useState } from "react";

import {
  createSnapshotDriftCheck,
  isDriftCheckedSnapshot,
  type SnapshotDriftCheckRecords,
  type SnapshotRecordDrift,
} from "@/src/domain/calculations";
import type { MonthlySnapshot } from "@/src/types";

import {
  cachedMonthDrift,
  createDriftRecordFingerprints,
  fingerprintSavedMonth,
  getDeviceSnapshotDriftCache,
  type SnapshotDriftCache,
  type SnapshotDriftCacheEntries,
} from "./snapshotDriftCache";
import { snapshotDriftTiming } from "./snapshotDriftTiming";

/** Work done per slice before yielding to the UI; one month can run past it. */
const sliceMs = 12;
const noDrift: ReadonlyMap<string, SnapshotRecordDrift> = new Map();

export type SnapshotDriftInput = SnapshotDriftCheckRecords & { monthlySnapshots: readonly MonthlySnapshot[] };

/**
 * Saved months that no longer match current records (#747). Each month is
 * worked out again from records, which takes seconds for a long history on a
 * phone, so the check runs in short slices between frames and never holds the
 * screen. The result arrives once every month is checked; until then the last
 * finished result stands. Pass a memoized input: a new one restarts the check.
 *
 * Even sliced, a full check keeps JavaScript busy for seconds on a phone, so
 * each month's answer is kept on the device (#851) and reused while neither the
 * records that month reads nor the saved month changed (#852). Usually no month
 * needs checking again, and a new record re-checks only months from its date.
 * Months still to work out wait `checkDelayMs` first, so a re-check after an
 * update, an import or a back-dated record never competes with opening the
 * screen; months answered from the cache need no wait.
 */
export function useSnapshotDrift(
  input: SnapshotDriftInput,
  cache: SnapshotDriftCache = getDeviceSnapshotDriftCache(),
  checkDelayMs = snapshotDriftTiming.checkDelayMs,
): ReadonlyMap<string, SnapshotRecordDrift> {
  const [drift, setDrift] = useState(noDrift);

  useEffect(() => {
    const { monthlySnapshots, ...records } = input;
    const months = monthlySnapshots.filter(isDriftCheckedSnapshot);
    const found = new Map<string, SnapshotRecordDrift>();
    const check = createSnapshotDriftCheck(records);
    let cached: SnapshotDriftCacheEntries | null = null;
    let entries: SnapshotDriftCacheEntries | undefined;
    let monthRecords: ((month: string) => string) | undefined;
    let checkedCount = 0;
    let next = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const checkFrom = Date.now() + checkDelayMs;
    const step = () => {
      if (cancelled) return;
      if (months.length === 0) {
        setDrift(found);
        return;
      }
      const started = Date.now();
      if (!entries || !monthRecords) {
        cached = cache.read();
        entries = { months: {} };
        monthRecords = createDriftRecordFingerprints(records);
      }
      while (next < months.length && Date.now() - started < sliceMs) {
        const saved = months[next];
        const recordsFingerprint = monthRecords(saved.month);
        const snapshotFingerprint = fingerprintSavedMonth(saved);
        const reused = cachedMonthDrift(cached, saved.month, recordsFingerprint, snapshotFingerprint);
        if (!reused && Date.now() < checkFrom) {
          timer = setTimeout(step, checkFrom - Date.now());
          return;
        }
        next += 1;
        let fields = reused?.fields ?? null;
        if (!reused) {
          fields = check(saved)?.fields ?? null;
          checkedCount += 1;
        }
        entries.months[saved.month] = { fields, records: recordsFingerprint, snapshot: snapshotFingerprint };
        if (fields) found.set(saved.month, { fields, month: saved.month, saved });
      }
      if (next < months.length) {
        timer = setTimeout(step, 0);
        return;
      }
      // Rewrite only when something changed: a month checked again, or months added or removed.
      const cachedMonths = cached === null ? -1 : Object.keys(cached.months).length;
      if (checkedCount > 0 || cachedMonths !== months.length) cache.write(entries);
      setDrift(found);
    };
    timer = setTimeout(step, 0);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [cache, checkDelayMs, input]);

  // A month saved again since the last check (recalculated, reviewed or rebuilt)
  // drops out at once rather than waiting for the next check to finish.
  return useMemo(() => {
    const current = new Set(input.monthlySnapshots);
    const stale = [...drift.values()].filter((entry) => !current.has(entry.saved));
    if (stale.length === 0) return drift;
    return new Map([...drift].filter(([, entry]) => current.has(entry.saved)));
  }, [drift, input.monthlySnapshots]);
}
