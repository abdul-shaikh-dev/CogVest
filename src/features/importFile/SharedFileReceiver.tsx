import { router, usePathname, useRootNavigationState } from "expo-router";
import { useEffect, useState } from "react";

import { addShareListener, takeSharedFile, type SharedFile } from "@/modules/cogvest-share-intent";
import { setPendingImportFile } from "@/src/services/import-export/pendingImportFile";

type Deps = {
  addListener?: (listener: () => void) => { remove(): void };
  navigate?: () => void;
  take?: () => SharedFile | null;
};

/**
 * Opens "Import a file" for a statement shared to CogVest (#771), at launch
 * or while running. It waits until the launch route has redirected, so the
 * redirect cannot replace the import screen. The file is held in memory as a
 * URI until the import screen takes it.
 */
export function SharedFileReceiver({
  addListener = addShareListener,
  navigate = () => router.push("/import-file"),
  take = takeSharedFile,
}: Deps) {
  const rootKey = useRootNavigationState()?.key;
  const pathname = usePathname();
  const launchSettled = Boolean(rootKey) && pathname !== "/";
  const [shareCount, setShareCount] = useState(0);

  useEffect(() => {
    const subscription = addListener(() => setShareCount((count) => count + 1));
    return () => subscription.remove();
  }, [addListener]);

  useEffect(() => {
    if (!launchSettled) return;
    const file = take();
    if (!file) return;
    setPendingImportFile(file);
    navigate();
    // Each new share bumps the count and is taken once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchSettled, shareCount]);

  return null;
}
