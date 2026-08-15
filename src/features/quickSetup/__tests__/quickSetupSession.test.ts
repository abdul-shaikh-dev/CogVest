import { createMemoryJsonStorage } from "@/src/services/storage";

import {
  createQuickSetupSessionStore,
  quickSetupStorageKey,
} from "../quickSetupSession";

describe("Quick Portfolio Setup session", () => {
  const now = () => new Date("2026-08-15T10:00:00.000Z");

  it("persists confirmed references and restores review state", () => {
    const storage = createMemoryJsonStorage();
    const store = createQuickSetupSessionStore({ now, storage });

    store.getState().start();
    store.getState().recordItem({
      assetId: "asset-1",
      kind: "openingPosition",
      name: "HDFC Bank",
      recordId: "opening-1",
    });
    store.getState().showReview();

    const restored = createQuickSetupSessionStore({ now, storage });

    expect(restored.getState().session).toMatchObject({
      items: [
        {
          assetId: "asset-1",
          kind: "openingPosition",
          name: "HDFC Bank",
          recordId: "opening-1",
        },
      ],
      stage: "review",
    });
  });

  it("does not duplicate a confirmed reference when save is replayed", () => {
    const storage = createMemoryJsonStorage();
    const store = createQuickSetupSessionStore({ now, storage });
    const item = {
      assetId: "asset-1",
      kind: "openingPosition" as const,
      name: "HDFC Bank",
      recordId: "opening-1",
    };

    store.getState().recordItem(item);
    store.getState().recordItem(item);

    expect(store.getState().session?.items).toHaveLength(1);
  });

  it("removes a stale confirmed reference without clearing the session", () => {
    const store = createQuickSetupSessionStore({
      now,
      storage: createMemoryJsonStorage(),
    });
    store.getState().recordItem({
      assetId: "asset-1",
      kind: "openingPosition",
      name: "HDFC Bank",
      recordId: "opening-1",
    });

    store.getState().removeItem("openingPosition", "opening-1");

    expect(store.getState().session).not.toBeNull();
    expect(store.getState().session?.items).toEqual([]);
  });

  it("clears setup state without touching portfolio storage", () => {
    const storage = createMemoryJsonStorage({
      "cogvest:v1:portfolio": { schemaVersion: 8 },
    });
    const store = createQuickSetupSessionStore({ now, storage });

    store.getState().start();
    store.getState().finish();

    expect(storage.getRawItem(quickSetupStorageKey)).toBeNull();
    expect(storage.getRawItem("cogvest:v1:portfolio")).not.toBeNull();
  });

  it("discards malformed setup state without blocking recovery", () => {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(quickSetupStorageKey, "{not-json");

    const store = createQuickSetupSessionStore({ now, storage });

    expect(store.getState().session).toBeNull();
    expect(storage.getRawItem(quickSetupStorageKey)).toBeNull();
  });
});
