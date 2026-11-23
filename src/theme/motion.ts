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
  /** A bottom sheet sliding up, or settling back after a short drag (#784). */
  sheet: 240,
  /** One turn of the price refresh indicator (#785). It repeats while prices load. */
  loader: 1400,
} as const;

/**
 * Press feedback (#785): a firm spring that settles without overshoot, so a
 * pressed control eases in a little and back. DESIGN.md §7 rules out bounce.
 */
export const pressSpring = {
  damping: 30,
  mass: 1,
  overshootClamping: true,
  stiffness: 500,
} as const;

/** How far a pressed control eases in. */
export const pressedScale = 0.97;

export type MotionKind = keyof typeof motionDurations;

/** The duration for this motion, or null when it should not run at all. */
export function getMotionDuration(kind: MotionKind, reducedMotion: boolean): number | null {
  return reducedMotion ? null : motionDurations[kind];
}
