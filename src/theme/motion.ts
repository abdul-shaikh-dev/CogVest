/**
 * Motion tokens (#783). Every animation takes its duration from here, and
 * reduced motion skips it. DESIGN.md §7: short, soft, never on a financial
 * value's number itself.
 */
export const motionDurations = {
  /** A screen's content appearing. */
  entry: 220,
  /** A card appearing once its data has loaded. */
  reveal: 200,
  /** Masked and unmasked amounts swapping. */
  mask: 160,
} as const;

export type MotionKind = keyof typeof motionDurations;

/** The duration for this motion, or null when it should not run at all. */
export function getMotionDuration(kind: MotionKind, reducedMotion: boolean): number | null {
  return reducedMotion ? null : motionDurations[kind];
}
