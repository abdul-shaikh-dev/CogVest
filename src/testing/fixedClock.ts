// Test-only helper (#673): freezes Date at a fixed instant for every test in
// the calling file. Timers, microtasks and animation frames stay real, so
// React Testing Library's waitFor and async rendering behave as usual.
const realTimers = [
  "cancelAnimationFrame",
  "cancelIdleCallback",
  "clearImmediate",
  "clearInterval",
  "clearTimeout",
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "requestIdleCallback",
  "setImmediate",
  "setInterval",
  "setTimeout",
] as const;

export function pinTestClock(instant: string) {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: [...realTimers], now: new Date(instant) });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
}
