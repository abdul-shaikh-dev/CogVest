import { defaultAppLockSettings, relockLabel, shouldRelock, type AppLockSettings } from "../appLock";

const on = (relockAfterSeconds: AppLockSettings["relockAfterSeconds"]): AppLockSettings => ({ enabled: true, relockAfterSeconds });

describe("shouldRelock (#761)", () => {
  it("is off by default", () => {
    expect(defaultAppLockSettings).toEqual({ enabled: false, relockAfterSeconds: 60 });
    expect(shouldRelock({ backgroundedAt: 0, now: 1_000_000, settings: defaultAppLockSettings })).toBe(false);
  });

  it("does nothing when the app never left the foreground", () => {
    expect(shouldRelock({ backgroundedAt: undefined, now: 1_000_000, settings: on(0) })).toBe(false);
  });

  it("locks once the chosen time in the background has passed", () => {
    expect(shouldRelock({ backgroundedAt: 1000, now: 60_999, settings: on(60) })).toBe(false);
    expect(shouldRelock({ backgroundedAt: 1000, now: 61_000, settings: on(60) })).toBe(true);
    expect(shouldRelock({ backgroundedAt: 1000, now: 1000, settings: on(0) })).toBe(true);
    expect(shouldRelock({ backgroundedAt: 0, now: 299_999, settings: on(300) })).toBe(false);
  });

  it("locks when the clock went backwards", () => {
    expect(shouldRelock({ backgroundedAt: 50_000, now: 10_000, settings: on(300) })).toBe(true);
  });

  it("labels each delay", () => {
    expect([relockLabel(0), relockLabel(60), relockLabel(300)]).toEqual(["Immediately", "After 1 minute", "After 5 minutes"]);
  });
});
