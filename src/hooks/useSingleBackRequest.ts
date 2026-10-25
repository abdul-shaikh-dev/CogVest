import { useCallback, useRef } from "react";

/**
 * Requests closer together than this are one Android back press. A person
 * cannot press back twice this quickly; the duplicate below arrives in tens of
 * milliseconds.
 */
export const DUPLICATE_BACK_REQUEST_MS = 300;

/**
 * Wraps a Modal `onRequestClose` handler so one back press runs it once.
 *
 * React Native 0.81 registers two Android back handlers on every Modal (an
 * `OnBackPressedDispatcher` callback and a key listener), and a single press
 * can reach `onRequestClose` through both. A handler that steps back one level
 * at a time would then skip a level, such as closing Monthly History instead
 * of returning from a month to the overview.
 */
export function useSingleBackRequest(handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const lastRequestRef = useRef<number | null>(null);

  return useCallback(() => {
    const requestedAt = Date.now();
    if (
      lastRequestRef.current !== null &&
      requestedAt - lastRequestRef.current < DUPLICATE_BACK_REQUEST_MS
    ) {
      return;
    }
    lastRequestRef.current = requestedAt;
    handlerRef.current();
  }, []);
}
