import { useEffect } from "react";

import { setScreenSecureAsync } from "@/modules/cogvest-screen-security";

type SetScreenSecure = (enabled: boolean) => Promise<void>;

/**
 * Applies the "Block screenshots" setting (#660). On Android this sets
 * FLAG_SECURE, which also blanks the recent-apps preview; turning the setting
 * off clears it. A native failure is ignored: the setting cannot do more than
 * the platform allows, and must never stop the app from starting.
 */
export function useScreenCaptureProtection(
  enabled: boolean,
  setScreenSecure: SetScreenSecure = setScreenSecureAsync,
) {
  useEffect(() => {
    if (!enabled) return undefined;
    setScreenSecure(true).catch(() => undefined);
    return () => {
      setScreenSecure(false).catch(() => undefined);
    };
  }, [enabled, setScreenSecure]);
}
