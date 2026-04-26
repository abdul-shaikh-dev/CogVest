import { createMemoryJsonStorage } from "@/src/services/storage";

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
});
