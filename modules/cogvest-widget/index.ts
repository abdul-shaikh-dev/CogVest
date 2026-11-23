import { requireOptionalNativeModule } from "expo";

/**
 * What the home-screen widget shows (#786): text the app already formatted.
 * Only "value" carries amounts; the native side drops them for every other kind.
 */
export type WidgetSnapshot =
  | { kind: "hidden" }
  | { kind: "empty" }
  | { kind: "pending"; updated: string }
  | { kind: "value"; change: string | null; updated: string; value: string };

type WidgetNativeModule = {
  setSnapshot(kind: string, value: string | null, change: string | null, updated: string | null): Promise<void>;
};

const nativeModule = requireOptionalNativeModule<WidgetNativeModule>("CogVestWidget");

/** Stores the snapshot and redraws any placed widget. A no-op where the module is absent. */
export function setWidgetSnapshotAsync(snapshot: WidgetSnapshot): Promise<void> {
  if (!nativeModule) return Promise.resolve();
  return nativeModule.setSnapshot(
    snapshot.kind,
    snapshot.kind === "value" ? snapshot.value : null,
    snapshot.kind === "value" ? snapshot.change : null,
    snapshot.kind === "value" || snapshot.kind === "pending" ? snapshot.updated : null,
  );
}
