/**
 * App lock rules (#761). The lock is a device setting: it is never part of a
 * backup, so restoring onto another phone cannot lock someone out.
 */

/** Seconds in the background before CogVest asks again. */
export const appLockRelockOptions = [0, 60, 300] as const;
export type AppLockRelockSeconds = (typeof appLockRelockOptions)[number];
export const defaultAppLockRelockSeconds: AppLockRelockSeconds = 60;

export type AppLockSettings = {
  enabled: boolean;
  relockAfterSeconds: AppLockRelockSeconds;
};

export const defaultAppLockSettings: AppLockSettings = {
  enabled: false,
  relockAfterSeconds: defaultAppLockRelockSeconds,
};

/**
 * Whether returning to CogVest needs the lock again. `backgroundedAt` is when
 * the app last left the foreground while unlocked; without it, nothing to do.
 */
export function shouldRelock({
  backgroundedAt,
  now,
  settings,
}: {
  backgroundedAt: number | undefined;
  now: number;
  settings: AppLockSettings;
}) {
  if (!settings.enabled || backgroundedAt === undefined) return false;
  // A clock set backwards counts as time passed rather than leaving the app open.
  const elapsed = now - backgroundedAt;
  return elapsed < 0 || elapsed >= settings.relockAfterSeconds * 1000;
}

export function relockLabel(seconds: AppLockRelockSeconds) {
  if (seconds === 0) return "Immediately";
  return seconds === 60 ? "After 1 minute" : `After ${seconds / 60} minutes`;
}
