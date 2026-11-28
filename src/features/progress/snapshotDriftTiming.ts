/**
 * How long a saved month waits before it is worked out again, from when
 * Progress opens or records change, so opening the screen and the first taps
 * on it come first. Months answered from the cache need no wait. Jest sets it
 * to zero; tests of the wait pass their own.
 */
export const snapshotDriftTiming = { checkDelayMs: 3000 };
