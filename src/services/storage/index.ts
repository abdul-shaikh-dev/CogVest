export type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonStorage = {
  getItem: <T extends JsonValue>(key: string) => T | null;
  removeItem: (key: string) => void;
  setItem: <T extends JsonValue>(key: string, value: T) => void;
};

export function createMemoryJsonStorage(
  initialValues: Record<string, JsonValue> = {},
): JsonStorage {
  const values = new Map<string, JsonValue>(Object.entries(initialValues));

  return {
    getItem: <T extends JsonValue>(key: string) => {
      return (values.get(key) as T | undefined) ?? null;
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: <T extends JsonValue>(key: string, value: T) => {
      values.set(key, value);
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

      if (!rawValue) {
        return null;
      }

      return JSON.parse(rawValue) as T;
    },
    removeItem: (key: string) => {
      storage.remove(key);
    },
    setItem: <T extends JsonValue>(key: string, value: T) => {
      storage.set(key, JSON.stringify(value));
    },
  };
}
