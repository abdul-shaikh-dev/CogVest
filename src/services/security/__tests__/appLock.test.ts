import type { LocalAuthenticationResult } from "expo-local-authentication";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { appLockStorageKey, backupRestoreKeys } from "@/src/services/storage/backupKeys";

import { createAppLockStore, type DeviceAuth } from "../appLock";

jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0 },
  authenticateAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
}));

function harness({ hasLock = true, results = [] as LocalAuthenticationResult[] } = {}) {
  let clock = 1_000_000;
  const storage = createMemoryJsonStorage();
  const auth: DeviceAuth & { authenticate: jest.Mock; hasDeviceLock: jest.Mock } = {
    hasDeviceLock: jest.fn(async () => hasLock),
    authenticate: jest.fn(async (): Promise<LocalAuthenticationResult> => results.shift() ?? { success: true }),
  };
  const make = () => createAppLockStore({ auth, now: () => clock, storage });
  return { advance: (ms: number) => { clock += ms; }, auth, make, storage };
}

describe("App lock store (#761)", () => {
  it("is off and unlocked by default, and never part of a backup", () => {
    const { make } = harness();
    expect(make().getState()).toMatchObject({ locked: false, settings: { enabled: false } });
    expect(backupRestoreKeys).not.toContain(appLockStorageKey);
  });

  it("turns on only after the phone's lock is passed, and locks the next cold start", async () => {
    const { auth, make, storage } = harness();
    const store = make();
    await expect(store.getState().enable()).resolves.toBe(true);
    expect(auth.authenticate).toHaveBeenCalledWith("Turn on App lock");
    expect(store.getState()).toMatchObject({ locked: false, settings: { enabled: true } });
    expect(JSON.parse(storage.getRawItem(appLockStorageKey) ?? "{}")).toEqual({ version: 1, enabled: true, relockAfterSeconds: 60 });

    expect(make().getState().locked).toBe(true);
  });

  it.each([
    ["the prompt is cancelled", { results: [{ success: false, error: "user_cancel" } as const] }],
    ["the check fails", { results: [{ success: false, error: "authentication_failed" } as const] }],
    ["the phone has no screen lock", { hasLock: false }],
  ])("stays off when %s", async (_label, options) => {
    const { auth, make, storage } = harness(options);
    const store = make();
    await expect(store.getState().enable()).resolves.toBe(false);
    expect(store.getState().settings.enabled).toBe(false);
    expect(storage.getRawItem(appLockStorageKey)).toBeNull();
    if ("hasLock" in options) expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it("asks for the phone's lock before turning off", async () => {
    const { make } = harness({ results: [{ success: true }, { success: false, error: "user_cancel" }] });
    const store = make();
    await store.getState().enable();
    await expect(store.getState().disable()).resolves.toBe(false);
    expect(store.getState().settings.enabled).toBe(true);
    await expect(store.getState().disable()).resolves.toBe(true);
    expect(store.getState().settings.enabled).toBe(false);
  });

  it("locks again only after the chosen time in the background", async () => {
    const { advance, make } = harness();
    const store = make();
    await store.getState().enable();

    store.getState().handleAppStateChange("background");
    advance(59_000);
    store.getState().handleAppStateChange("active");
    expect(store.getState().locked).toBe(false);

    store.getState().handleAppStateChange("background");
    advance(60_000);
    store.getState().handleAppStateChange("active");
    expect(store.getState().locked).toBe(true);
  });

  it("locks on every return when set to Immediately", async () => {
    const { make } = harness();
    const store = make();
    await store.getState().enable();
    store.getState().setRelockAfter(0);
    store.getState().handleAppStateChange("background");
    store.getState().handleAppStateChange("active");
    expect(store.getState().locked).toBe(true);
  });

  it("does not treat the system PIN screen as leaving the app", async () => {
    const { advance, auth, make } = harness();
    const store = make();
    await store.getState().enable();
    store.getState().setRelockAfter(0);
    auth.authenticate.mockImplementationOnce(async () => {
      // The PIN screen is a separate activity: CogVest goes to the background.
      store.getState().handleAppStateChange("background");
      advance(120_000);
      return { success: true };
    });
    store.getState().handleAppStateChange("background");
    store.getState().handleAppStateChange("active");
    await expect(store.getState().unlock()).resolves.toBe("unlocked");
    store.getState().handleAppStateChange("active");
    expect(store.getState().locked).toBe(false);
  });

  it("stays locked and explains a failed or locked-out attempt", async () => {
    const { make, storage } = harness({ results: [
      { success: false, error: "authentication_failed" },
      { success: false, error: "lockout" },
      { success: false, error: "user_cancel" },
      { success: true },
    ] });
    storage.setItem(appLockStorageKey, { version: 1, enabled: true, relockAfterSeconds: 60 });
    const store = make();
    await expect(store.getState().unlock()).resolves.toBe("failed");
    expect(store.getState()).toMatchObject({ locked: true, error: "CogVest could not confirm it's you. Try again." });
    await store.getState().unlock();
    expect(store.getState().error).toBe("Too many attempts. Wait a moment, then try again.");
    await expect(store.getState().unlock()).resolves.toBe("cancelled");
    expect(store.getState()).toMatchObject({ locked: true, error: undefined });
    await expect(store.getState().unlock()).resolves.toBe("unlocked");
    expect(store.getState().locked).toBe(false);
  });

  it("stays locked when the prompt throws", async () => {
    const { auth, make, storage } = harness();
    storage.setItem(appLockStorageKey, { version: 1, enabled: true, relockAfterSeconds: 60 });
    auth.authenticate.mockRejectedValueOnce(new Error("no activity"));
    const store = make();
    await expect(store.getState().unlock()).resolves.toBe("failed");
    expect(store.getState().locked).toBe(true);
  });

  it("turns itself off rather than locking the owner out when the screen lock was removed", async () => {
    const { auth, make, storage } = harness({ hasLock: false });
    storage.setItem(appLockStorageKey, { version: 1, enabled: true, relockAfterSeconds: 60 });
    const store = make();
    await expect(store.getState().unlock()).resolves.toBe("noDeviceLock");
    expect(auth.authenticate).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ locked: false, settings: { enabled: false } });
    expect(make().getState().locked).toBe(false);
  });

  it.each([
    ["not JSON", "{"],
    ["an unknown delay", JSON.stringify({ version: 1, enabled: false, relockAfterSeconds: 7 })],
    ["a newer version", JSON.stringify({ version: 2, enabled: false, relockAfterSeconds: 60 })],
  ])("stays locked when the saved setting is %s", (_label, raw) => {
    const { make, storage } = harness();
    storage.setRawItem(appLockStorageKey, raw);
    expect(make().getState()).toMatchObject({ locked: true, settings: { enabled: true } });
  });

  it("leaves the lock up when a deep link or any other screen change happens", async () => {
    const { make, storage } = harness();
    storage.setItem(appLockStorageKey, { version: 1, enabled: true, relockAfterSeconds: 300 });
    const store = make();
    // Coming back to the foreground, for a link or otherwise, never unlocks.
    store.getState().handleAppStateChange("background");
    store.getState().handleAppStateChange("active");
    expect(store.getState().locked).toBe(true);
  });
});
