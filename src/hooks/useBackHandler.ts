import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";

import { useLatestCallback } from "./useLatestCallback";

function addBackListener(handler: () => void) {
  const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
    handler();
    return true;
  });
  return () => subscription.remove();
}

/**
 * Handles the Android back button while `enabled`, always calling the latest
 * `handler`. The listener is added once per enable, so later renders do not
 * reorder BackHandler's listener stack (#666).
 */
export function useBackHandler(handler: () => void, enabled = true) {
  const latestHandler = useLatestCallback(handler);

  useEffect(() => {
    if (!enabled) return undefined;
    return addBackListener(latestHandler);
  }, [enabled, latestHandler]);
}

/** Like `useBackHandler`, but only while the screen has navigation focus. */
export function useFocusedBackHandler(handler: () => void) {
  const latestHandler = useLatestCallback(handler);

  useFocusEffect(useCallback(() => addBackListener(latestHandler), [latestHandler]));
}
