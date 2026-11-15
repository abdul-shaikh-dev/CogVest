import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";

const protectionKey = "cogvest-settings";

type ScreenCaptureModule = Pick<typeof ScreenCapture, "allowScreenCaptureAsync" | "preventScreenCaptureAsync">;

/**
 * Applies the "Block screenshots" setting (#660). On Android this sets
 * FLAG_SECURE, which also blanks the recent-apps preview; turning the setting
 * off clears it. A native failure is ignored: the setting cannot do more than
 * the platform allows, and must never stop the app from starting.
 */
export function useScreenCaptureProtection(
  enabled: boolean,
  screenCapture: ScreenCaptureModule = ScreenCapture,
) {
  useEffect(() => {
    if (!enabled) return undefined;
    screenCapture.preventScreenCaptureAsync(protectionKey).catch(() => undefined);
    return () => {
      screenCapture.allowScreenCaptureAsync(protectionKey).catch(() => undefined);
    };
  }, [enabled, screenCapture]);
}
