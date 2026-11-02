import { useEffect, useState } from "react";

/** Rows rendered in the first commit, then added per later task. */
export const PROGRESSIVE_BATCH_SIZE = 24;

/**
 * Returns how many of `total` items to render, growing from one batch to all
 * of them one task at a time.
 *
 * Mounting hundreds of rows in a single commit blocks the JavaScript thread
 * for most of a second on Android (#138). Splitting the first render keeps each
 * task short; the screen shows its first rows at once and fills in the rest
 * within a few frames. The count never shrinks, so after the first fill a
 * filtered or searched subset renders in full immediately; only growth past
 * the rendered count is batched again.
 */
export function useProgressiveCount(total: number, batchSize = PROGRESSIVE_BATCH_SIZE) {
  const [count, setCount] = useState(batchSize);
  const isComplete = count >= total;

  useEffect(() => {
    if (isComplete) return undefined;
    const timer = setTimeout(() => setCount((current) => current + batchSize), 0);
    return () => clearTimeout(timer);
  }, [batchSize, count, isComplete]);

  return Math.min(count, total);
}
