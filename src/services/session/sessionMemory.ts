// Android relaunches MainActivity when the system font size changes (#529).
// The app process and its JavaScript runtime survive, but React remounts the
// app from the launch route: the user lands on the Dashboard and unsaved input
// is gone. Session memory keeps that transient UI state in JavaScript memory
// only, never in storage, so the remounted app can return to it. A new process
// starts empty, as before.

export type SessionMemoryKey = "cashEntryDraft" | "navigation";

export type SessionMemory = {
  /** Clears everything, e.g. when Back is about to leave the app. */
  forgetAll: () => void;
  read: <T>(key: SessionMemoryKey) => T | undefined;
  /** Returns a value once and clears it. */
  take: <T>(key: SessionMemoryKey) => T | undefined;
  /** Stores a value; undefined clears it. */
  write: <T>(key: SessionMemoryKey, value: T | undefined) => void;
};

export function createSessionMemory(): SessionMemory {
  const values = new Map<SessionMemoryKey, unknown>();

  return {
    forgetAll: () => values.clear(),
    read: <T>(key: SessionMemoryKey) => values.get(key) as T | undefined,
    take: <T>(key: SessionMemoryKey) => {
      const value = values.get(key) as T | undefined;
      values.delete(key);
      return value;
    },
    write: (key, value) => {
      if (value === undefined) values.delete(key);
      else values.set(key, value);
    },
  };
}

export const sessionMemory = createSessionMemory();
