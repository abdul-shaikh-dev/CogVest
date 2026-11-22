import { getMotionDuration, motionDurations, type MotionKind } from "@/src/theme";

const kinds = Object.keys(motionDurations) as MotionKind[];

describe("motion tokens (#783)", () => {
  it.each(kinds)("skips %s motion when reduced motion is on", (kind) => {
    expect(getMotionDuration(kind, true)).toBeNull();
  });

  it.each(kinds)("keeps %s motion short when it runs", (kind) => {
    const duration = getMotionDuration(kind, false);
    expect(duration).toBe(motionDurations[kind]);
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(250);
  });
});
