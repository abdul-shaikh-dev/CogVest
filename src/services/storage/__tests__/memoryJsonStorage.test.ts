import {
  createMemoryJsonStorage,
  createMmkvJsonStorage,
} from "@/src/services/storage";

describe("memory JSON storage", () => {
  it("stores JSON-compatible values by key", () => {
    const storage = createMemoryJsonStorage();

    storage.setItem("cogvest:test", { enabled: true });

    expect(storage.getItem("cogvest:test")).toEqual({ enabled: true });
  });

  it("removes values by key", () => {
    const storage = createMemoryJsonStorage();
    storage.setItem("cogvest:test", { enabled: true });

    storage.removeItem("cogvest:test");

    expect(storage.getItem("cogvest:test")).toBeNull();
  });

  it("preserves exact raw values independently from the JSON API", () => {
    const storage = createMemoryJsonStorage();
    const rawValue = '{ "enabled": true, "label": "CogVest" }';

    storage.setRawItem("cogvest:test", rawValue);

    expect(storage.getRawItem("cogvest:test")).toBe(rawValue);
    expect(storage.getItem("cogvest:test")).toEqual({
      enabled: true,
      label: "CogVest",
    });
  });

  it("defers malformed raw JSON failure until the JSON API reads it", () => {
    const storage = createMemoryJsonStorage();
    const rawValue = '{ not valid JSON';

    storage.setRawItem("cogvest:test", rawValue);

    expect(storage.getRawItem("cogvest:test")).toBe(rawValue);
    expect(() => storage.getItem("cogvest:test")).toThrow(SyntaxError);
  });

  it("provides the same exact raw access for MMKV storage", () => {
    const values = new Map<string, string>();
    const storage = createMmkvJsonStorage({
      getString: (key) => values.get(key),
      remove: (key) => values.delete(key),
      set: (key, value) => values.set(key, value),
    });
    const rawValue = '{ "enabled": true }';

    storage.setRawItem("cogvest:test", rawValue);

    expect(storage.getRawItem("cogvest:test")).toBe(rawValue);
    expect(storage.getItem("cogvest:test")).toEqual({ enabled: true });
  });
});
