import { useSyncExternalStore } from "react";
import { z } from "zod";
import { createStore, type StoreApi } from "zustand/vanilla";

import {
  createMmkvJsonStorage,
  type JsonStorage,
} from "@/src/services/storage";
import { createId } from "@/src/utils";

import { quickSetupStorageKey, backupRestoreJournalKey } from "@/src/services/storage/backupKeys";
export { quickSetupStorageKey };
export const quickSetupSchemaVersion = 1;

const quickSetupItemSchema = z.object({
  assetId: z.string().min(1).optional(),
  kind: z.enum(["openingPosition", "ppfAccount"]),
  name: z.string().min(1),
  recordId: z.string().min(1),
  savedAt: z.string().datetime(),
});

const quickSetupSessionSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  items: z.array(quickSetupItemSchema),
  stage: z.enum(["entry", "review"]),
  updatedAt: z.string().datetime(),
  version: z.literal(quickSetupSchemaVersion),
});

export type QuickSetupItem = z.infer<typeof quickSetupItemSchema>;
export type QuickSetupSession = z.infer<typeof quickSetupSessionSchema>;

type RecordQuickSetupItemInput = Omit<QuickSetupItem, "savedAt">;

export type QuickSetupSessionState = {
  finish: () => void;
  recordItem: (item: RecordQuickSetupItemInput) => void;
  removeItem: (kind: QuickSetupItem["kind"], recordId: string) => void;
  session: QuickSetupSession | null;
  showEntry: () => void;
  showReview: () => void;
  start: () => QuickSetupSession;
};

type CreateQuickSetupSessionStoreOptions = {
  now?: () => Date;
  storage?: JsonStorage;
};

function readSession(storage: JsonStorage): QuickSetupSession | null {
  if (storage.getRawItem(backupRestoreJournalKey) !== null) return null;
  const raw = storage.getRawItem(quickSetupStorageKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed = quickSetupSessionSchema.safeParse(JSON.parse(raw));

    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Invalid setup state must not prevent the portfolio from loading.
  }

  storage.removeItem(quickSetupStorageKey);
  return null;
}

export function createQuickSetupSessionStore({
  now = () => new Date(),
  storage = createMmkvJsonStorage(),
}: CreateQuickSetupSessionStoreOptions = {}): StoreApi<QuickSetupSessionState> {
  function persist(session: QuickSetupSession | null) {
    if (storage.getRawItem(backupRestoreJournalKey) !== null) {
      throw new Error("Restart CogVest to finish local data recovery first.");
    }
    if (session) {
      storage.setItem(quickSetupStorageKey, session);
    } else {
      storage.removeItem(quickSetupStorageKey);
    }
  }

  return createStore<QuickSetupSessionState>((set, get) => ({
    finish: () => {
      persist(null);
      set({ session: null });
    },
    recordItem: (item) => {
      const session = get().session ?? get().start();
      const savedAt = now().toISOString();
      const existingIndex = session.items.findIndex(
        (current) =>
          current.kind === item.kind && current.recordId === item.recordId,
      );
      const nextItem = { ...item, savedAt };
      const items =
        existingIndex >= 0
          ? session.items.map((current, index) =>
              index === existingIndex ? nextItem : current,
            )
          : [...session.items, nextItem];
      const next = { ...session, items, stage: "entry" as const, updatedAt: savedAt };

      persist(next);
      set({ session: next });
    },
    removeItem: (kind, recordId) => {
      const session = get().session;

      if (!session) {
        return;
      }

      const next = {
        ...session,
        items: session.items.filter(
          (item) => item.kind !== kind || item.recordId !== recordId,
        ),
        updatedAt: now().toISOString(),
      };
      persist(next);
      set({ session: next });
    },
    session: readSession(storage),
    showEntry: () => {
      const session = get().session;

      if (!session) {
        return;
      }

      const next = {
        ...session,
        stage: "entry" as const,
        updatedAt: now().toISOString(),
      };
      persist(next);
      set({ session: next });
    },
    showReview: () => {
      const session = get().session;

      if (!session || session.items.length === 0) {
        return;
      }

      const next = {
        ...session,
        stage: "review" as const,
        updatedAt: now().toISOString(),
      };
      persist(next);
      set({ session: next });
    },
    start: () => {
      const existing = get().session;

      if (existing) {
        return existing;
      }

      const timestamp = now().toISOString();
      const session: QuickSetupSession = {
        createdAt: timestamp,
        id: createId("quick-setup"),
        items: [],
        stage: "entry",
        updatedAt: timestamp,
        version: quickSetupSchemaVersion,
      };
      persist(session);
      set({ session });
      return session;
    },
  }));
}

let runtimeQuickSetupSessionStore:
  | StoreApi<QuickSetupSessionState>
  | undefined;

export function getQuickSetupSessionStore() {
  runtimeQuickSetupSessionStore ??= createQuickSetupSessionStore();
  return runtimeQuickSetupSessionStore;
}

export function resetQuickSetupSessionAfterRestore() {
  // Persistence was cleared in the restore transaction, not in this notification.
  runtimeQuickSetupSessionStore?.setState({ session: null });
}

export function useQuickSetupSession(
  store = getQuickSetupSessionStore(),
) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
