import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a stable function that always calls the latest `callback`.
 *
 * Use it for event handlers that a memoized child or a long-lived listener
 * keeps, so the child does not re-render whenever the parent's closure
 * changes. The ref is updated in an insertion effect, before any layout
 * effect or event can call it, rather than during render. Do not call the
 * returned function during render.
 */
export function useLatestCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const callbackRef = useRef(callback);

  useInsertionEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args: Args) => callbackRef.current(...args), []);
}
