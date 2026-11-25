import { requireOptionalNativeModule } from "expo";

/** A file shared to CogVest from another app (#771): a URI, never its contents. */
export type SharedFile = { mimeType: string | null; name: string; size: number | null; uri: string };

type ShareIntentNativeModule = {
  takeSharedFile(): SharedFile | null;
  addListener(event: "onShare", listener: () => void): { remove(): void };
};

// Android only. Elsewhere, and in tests, the module is absent and nothing is shared.
const nativeModule = requireOptionalNativeModule<ShareIntentNativeModule>("CogVestShareIntent");

/** The file of the Share intent that opened CogVest, once; null when none is waiting. */
export function takeSharedFile(): SharedFile | null {
  return nativeModule ? nativeModule.takeSharedFile() : null;
}

/** Calls back when a file is shared while CogVest is already running. */
export function addShareListener(listener: () => void): { remove(): void } {
  return nativeModule ? nativeModule.addListener("onShare", listener) : { remove() {} };
}
