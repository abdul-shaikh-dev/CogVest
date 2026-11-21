import { useEffect, useMemo, useState } from "react";

import {
  createSnapshotDriftCheck,
  isDriftCheckedSnapshot,
  type SnapshotDriftCheckRecords,
  type SnapshotRecordDrift,
} from "@/src/domain/calculations";
import type { MonthlySnapshot } from "@/src/types";

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
 */
export function useSnapshotDrift(input: SnapshotDriftInput): ReadonlyMap<string, SnapshotRecordDrift> {
  const [drift, setDrift] = useState(noDrift);

  useEffect(() => {
    const { monthlySnapshots, ...records } = input;
    const months = monthlySnapshots.filter(isDriftCheckedSnapshot);
    const check = createSnapshotDriftCheck(records);
    const found = new Map<string, SnapshotRecordDrift>();
    let next = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const started = Date.now();
      while (next < months.length && Date.now() - started < sliceMs) {
        const month = check(months[next]);
        next += 1;
        if (month) found.set(month.month, month);
      }
      if (next < months.length) timer = setTimeout(step, 0);
      else setDrift(found);
    };
    timer = setTimeout(step, 0);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [input]);

  // A month saved again since the last check (recalculated, reviewed or rebuilt)
  // drops out at once rather than waiting for the next check to finish.
  return useMemo(() => {
    const current = new Set(input.monthlySnapshots);
    const stale = [...drift.values()].filter((entry) => !current.has(entry.saved));
    if (stale.length === 0) return drift;
    return new Map([...drift].filter(([, entry]) => current.has(entry.saved)));
  }, [drift, input.monthlySnapshots]);
}
