import { getMotionDuration, motionDurations, pressedScale, pressSpring, type MotionKind } from "@/src/theme";

const kinds = Object.keys(motionDurations) as MotionKind[];
// The refresh indicator loops while prices load; every other motion runs once.
const transitions = kinds.filter((kind) => kind !== "loader");

describe("motion tokens (#783)", () => {
  it.each(kinds)("skips %s motion when reduced motion is on", (kind) => {
    expect(getMotionDuration(kind, true)).toBeNull();
  });

  it.each(transitions)("keeps %s motion short when it runs", (kind) => {
    const duration = getMotionDuration(kind, false);
    expect(duration).toBe(motionDurations[kind]);
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(250);
  });

  it("turns the refresh indicator slowly enough to stay calm (#785)", () => {
    expect(motionDurations.loader).toBeGreaterThanOrEqual(1000);
  });

  it("presses with a spring that cannot overshoot (#785)", () => {
    expect(pressSpring.overshootClamping).toBe(true);
    expect(pressedScale).toBeGreaterThanOrEqual(0.95);
    expect(pressedScale).toBeLessThan(1);
  });
});
