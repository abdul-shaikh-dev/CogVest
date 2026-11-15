import { requireOptionalNativeModule } from "expo";

type ScreenSecurityNativeModule = {
  setSecure(enabled: boolean): Promise<void>;
};

// Android only. Elsewhere, and in tests, the module is absent and this is a no-op.
const nativeModule = requireOptionalNativeModule<ScreenSecurityNativeModule>("CogVestScreenSecurity");

/** Sets (true) or clears (false) Android FLAG_SECURE on the app window (#660). */
export function setScreenSecureAsync(enabled: boolean): Promise<void> {
  return nativeModule ? nativeModule.setSecure(enabled) : Promise.resolve();
}
