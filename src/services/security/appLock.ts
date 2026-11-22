import {
  authenticateAsync,
  getEnrolledLevelAsync,
  SecurityLevel,
  type LocalAuthenticationResult,
} from "expo-local-authentication";
import { useSyncExternalStore } from "react";
import type { AppStateStatus } from "react-native";
import { z } from "zod";
import { createStore, type StoreApi } from "zustand/vanilla";

import {
  appLockRelockOptions,
  defaultAppLockSettings,
  shouldRelock,
  type AppLockRelockSeconds,
  type AppLockSettings,
} from "@/src/domain/appLock";
import { createMmkvJsonStorage, type JsonStorage } from "@/src/services/storage";
import { appLockStorageKey } from "@/src/services/storage/backupKeys";

/** The phone's own lock: fingerprint, face, or the screen-lock PIN, pattern or password. */
export type DeviceAuth = {
  /** True when the phone has a screen lock, which every other method needs. */
  hasDeviceLock: () => Promise<boolean>;
  authenticate: (promptMessage: string) => Promise<LocalAuthenticationResult>;
};

export const expoDeviceAuth: DeviceAuth = {
  hasDeviceLock: async () => (await getEnrolledLevelAsync()) > SecurityLevel.NONE,
  authenticate: (promptMessage) =>
    authenticateAsync({ cancelLabel: "Cancel", disableDeviceFallback: false, promptMessage }),
};

export type UnlockResult = "unlocked" | "cancelled" | "failed" | "noDeviceLock";

export type AppLockState = {
  settings: AppLockSettings;
  locked: boolean;
  /** Set while the system prompt is open. */
  authenticating: boolean;
  /** Why the last unlock attempt failed, for the lock screen. */
  error?: string;
  /** Asks for the phone's lock, then turns App lock on. Resolves false when not confirmed. */
  enable: () => Promise<boolean>;
  /** Asks for the phone's lock, then turns App lock off. */
  disable: () => Promise<boolean>;
  setRelockAfter: (seconds: AppLockRelockSeconds) => void;
  unlock: () => Promise<UnlockResult>;
  handleAppStateChange: (state: AppStateStatus) => void;
};

const relockSchema = z.union(
  appLockRelockOptions.map((seconds) => z.literal(seconds)) as unknown as [
    z.ZodLiteral<AppLockRelockSeconds>, z.ZodLiteral<AppLockRelockSeconds>, ...z.ZodLiteral<AppLockRelockSeconds>[],
  ],
);

export const appLockRecordVersion = 1;

const appLockRecordSchema = z.object({
  version: z.literal(appLockRecordVersion),
  enabled: z.boolean(),
  relockAfterSeconds: relockSchema,
}).strict();

/**
 * Reads the saved setting. An unreadable record that may have been "on" stays
 * on: failing open would let anyone past the lock by corrupting storage.
 */
function readSettings(storage: JsonStorage): AppLockSettings {
  const raw = storage.getRawItem(appLockStorageKey);
  if (raw === null) return defaultAppLockSettings;
  try {
    const parsed = appLockRecordSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      const { version: _version, ...settings } = parsed.data;
      return settings;
    }
  } catch {
    // Fall through.
  }
  return { ...defaultAppLockSettings, enabled: true };
}

function failureMessage(error: string) {
  if (error === "lockout") return "Too many attempts. Wait a moment, then try again.";
  return "CogVest could not confirm it's you. Try again.";
}

type Options = {
  auth?: DeviceAuth;
  now?: () => number;
  storage?: JsonStorage;
};

export function createAppLockStore({
  auth = expoDeviceAuth,
  now = () => Date.now(),
  storage = createMmkvJsonStorage(),
}: Options = {}): StoreApi<AppLockState> {
  const initial = readSettings(storage);
  // When CogVest last left the foreground while unlocked.
  let backgroundedAt: number | undefined;

  function persist(settings: AppLockSettings) {
    storage.setItem(appLockStorageKey, { version: appLockRecordVersion, ...settings });
  }

  return createStore<AppLockState>((set, get) => {
    async function confirm(promptMessage: string): Promise<UnlockResult> {
      if (get().authenticating) return "cancelled";
      set({ authenticating: true });
      try {
        if (!(await auth.hasDeviceLock())) return "noDeviceLock";
        const result = await auth.authenticate(promptMessage);
        if (result.success) return "unlocked";
        if (["user_cancel", "system_cancel", "app_cancel"].includes(result.error)) return "cancelled";
        set({ error: failureMessage(result.error) });
        return "failed";
      } catch {
        set({ error: failureMessage("unknown") });
        return "failed";
      } finally {
        set({ authenticating: false });
      }
    }

    function save(settings: AppLockSettings) {
      persist(settings);
      set({ settings });
    }

    return {
      settings: initial,
      // Cold start is always locked when the setting is on.
      locked: initial.enabled,
      authenticating: false,
      enable: async () => {
        set({ error: undefined });
        const result = await confirm("Turn on App lock");
        if (result !== "unlocked") return false;
        save({ ...get().settings, enabled: true });
        return true;
      },
      disable: async () => {
        set({ error: undefined });
        const result = await confirm("Turn off App lock");
        // Without a screen lock there is nothing to confirm with, and nothing to protect.
        if (result !== "unlocked" && result !== "noDeviceLock") return false;
        save({ ...get().settings, enabled: false });
        return true;
      },
      setRelockAfter: (relockAfterSeconds) => save({ ...get().settings, relockAfterSeconds }),
      unlock: async () => {
        set({ error: undefined });
        const result = await confirm("Unlock CogVest");
        if (result === "unlocked") {
          backgroundedAt = undefined;
          set({ locked: false });
        } else if (result === "noDeviceLock") {
          // The phone's screen lock was removed, which needs that lock to do.
          // Keeping the app locked would lock the owner out for good.
          try { save({ ...get().settings, enabled: false }); } catch { /* Unlock anyway. */ }
          backgroundedAt = undefined;
          set({ locked: false });
        }
        return result;
      },
      handleAppStateChange: (state) => {
        const current = get();
        // The system prompt, and the PIN screen in particular, sends CogVest to
        // the background; that is not the user leaving.
        if (current.authenticating || !current.settings.enabled || current.locked) return;
        if (state === "background") {
          backgroundedAt ??= now();
          return;
        }
        if (state === "active") {
          const relock = shouldRelock({ backgroundedAt, now: now(), settings: current.settings });
          backgroundedAt = undefined;
          if (relock) set({ locked: true, error: undefined });
        }
      },
    };
  });
}

let runtimeStore: StoreApi<AppLockState> | undefined;

export function getAppLockStore() {
  runtimeStore ??= createAppLockStore();
  return runtimeStore;
}

export function useAppLock(store: StoreApi<AppLockState> = getAppLockStore()) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
