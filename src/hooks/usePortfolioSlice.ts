import { useRef, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

/** True when both values are the same, or are objects with the same keys holding the same values. */
export function shallowEqual<T>(left: T, right: T) {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" || left === null ||
    typeof right !== "object" || right === null
  ) {
    return false;
  }
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(right, key) &&
    Object.is(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key],
    ));
}

/**
 * Subscribes to the part of a store that `selector` returns (#662). The
 * component re-renders only when that part changes under `isEqual`, not on
 * every write to the store. Store records are replaced, never mutated, so a
 * shallow comparison of the selected records is enough by default.
 */
export function usePortfolioSlice<State, Slice>(
  store: StoreApi<State>,
  selector: (state: State) => Slice,
  isEqual: (left: Slice, right: Slice) => boolean = shallowEqual,
): Slice {
  const cache = useRef<{ selector: (state: State) => Slice; slice: Slice; state: State }>(undefined);

  const getSlice = () => {
    const state = store.getState();
    const previous = cache.current;
    if (previous && previous.state === state && previous.selector === selector) {
      return previous.slice;
    }
    const next = selector(state);
    const slice = previous && isEqual(previous.slice, next) ? previous.slice : next;
    cache.current = { selector, slice, state };
    return slice;
  };

  return useSyncExternalStore(store.subscribe, getSlice, getSlice);
}

/** Subscribes to the named top-level store fields only. */
export function usePortfolioFields<State, Key extends keyof State>(
  store: StoreApi<State>,
  keys: readonly Key[],
): Pick<State, Key> {
  return usePortfolioSlice(store, (state) => {
    const slice = {} as Pick<State, Key>;
    for (const key of keys) slice[key] = state[key];
    return slice;
  });
}
