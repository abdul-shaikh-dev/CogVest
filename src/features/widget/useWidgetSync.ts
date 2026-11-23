import { useEffect, useRef, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";

import { setWidgetSnapshotAsync, type WidgetSnapshot } from "@/modules/cogvest-widget";
import type { AppLockState } from "@/src/services/security/appLock";
import type { PortfolioStoreState } from "@/src/store";

import { buildWidgetSnapshot, isWidgetHidden, type WidgetDashboard, type WidgetPrivacy } from "./widgetSnapshot";

type SetWidgetSnapshot = (snapshot: WidgetSnapshot) => Promise<void>;

/**
 * Hides the home-screen widget's value as soon as masking or App lock turns
 * on, from anywhere in the app (#786). Mounted in the root layout. A native
 * failure is ignored: the widget must never stop the app.
 */
export function useWidgetPrivacySync(
  privacy: WidgetPrivacy,
  setSnapshot: SetWidgetSnapshot = setWidgetSnapshotAsync,
) {
  const hidden = isWidgetHidden(privacy);
  useEffect(() => {
    if (hidden) setSnapshot({ kind: "hidden" }).catch(() => undefined);
  }, [hidden, setSnapshot]);
}

const noSubscription = () => () => undefined;

/**
 * Whether App lock is on, for the widget's privacy check. Without a store it
 * answers yes, so a screen that was not given one keeps the widget hidden.
 */
export function useAppLockEnabled(appLockStore: StoreApi<AppLockState> | undefined) {
  return useSyncExternalStore(
    appLockStore?.subscribe ?? noSubscription,
    () => appLockStore?.getState().settings.enabled ?? true,
    () => appLockStore?.getState().settings.enabled ?? true,
  );
}

/**
 * Sends the Dashboard's valuation to the widget whenever its text changes
 * (#786). It never sends a value while the widget is hidden; the root
 * layout's privacy sync covers that case.
 */
export function useDashboardWidgetSync({
  appLockStore,
  dashboard,
  hasCompleteValuation,
  maskWealthValues,
  now,
  setSnapshot = setWidgetSnapshotAsync,
  showWidgetValue,
  store,
}: {
  appLockStore: StoreApi<AppLockState> | undefined;
  dashboard: WidgetDashboard;
  hasCompleteValuation: boolean;
  maskWealthValues: boolean;
  showWidgetValue: boolean;
  now: Date;
  setSnapshot?: SetWidgetSnapshot;
  store: StoreApi<PortfolioStoreState>;
}) {
  const appLockEnabled = useAppLockEnabled(appLockStore);
  const quoteCache = useSyncExternalStore(
    store.subscribe,
    () => store.getState().quoteCache,
    () => store.getState().quoteCache,
  );
  const snapshot = buildWidgetSnapshot({
    dashboard,
    hasCompleteValuation,
    now,
    privacy: { appLockEnabled, maskWealthValues, showWidgetValue },
    quoteCache,
  });
  const key = JSON.stringify(snapshot);
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (snapshot.kind === "hidden") {
      // Send the value again once the widget may show it.
      sent.current = null;
      return;
    }
    if (sent.current === key) return;
    sent.current = key;
    setSnapshot(snapshot).catch(() => undefined);
    // The key is the snapshot's content; the object is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setSnapshot]);
}
