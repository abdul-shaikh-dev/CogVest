export type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonStorage = {
  getItem: <T extends JsonValue>(key: string) => T | null;
  getRawItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: <T extends JsonValue>(key: string, value: T) => void;
  setRawItem: (key: string, rawValue: string) => void;
};

export function createMemoryJsonStorage(
  initialValues: Record<string, JsonValue> = {},
): JsonStorage {
  const values = new Map<string, string>(
    Object.entries(initialValues).map(([key, value]) => [
      key,
      JSON.stringify(value),
    ]),
  );

  return {
    getItem: <T extends JsonValue>(key: string) => {
      const rawValue = values.get(key);

      return rawValue === undefined ? null : (JSON.parse(rawValue) as T);
    },
    getRawItem: (key: string) => {
      return values.get(key) ?? null;
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: <T extends JsonValue>(key: string, value: T) => {
      values.set(key, JSON.stringify(value));
    },
    setRawItem: (key: string, rawValue: string) => {
      values.set(key, rawValue);
    },
  };
}

type MmkvLikeStorage = {
  getString: (key: string) => string | undefined;
  remove: (key: string) => boolean;
  set: (key: string, value: string) => void;
};

function createDefaultMmkvStorage(): MmkvLikeStorage {
  const { createMMKV } = require(
    "react-native-mmkv",
  ) as typeof import("react-native-mmkv");

  return createMMKV();
}

export function createMmkvJsonStorage(
  storage: MmkvLikeStorage = createDefaultMmkvStorage(),
): JsonStorage {
  return {
    getItem: <T extends JsonValue>(key: string) => {
      const rawValue = storage.getString(key);

      if (rawValue === undefined) {
        return null;
      }

      return JSON.parse(rawValue) as T;
    },
    getRawItem: (key: string) => {
      return storage.getString(key) ?? null;
    },
    removeItem: (key: string) => {
      storage.remove(key);
    },
    setItem: <T extends JsonValue>(key: string, value: T) => {
      storage.set(key, JSON.stringify(value));
    },
    setRawItem: (key: string, rawValue: string) => {
      storage.set(key, rawValue);
    },
  };
}
