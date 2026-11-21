import { requireOptionalNativeModule } from "expo";

type Pbkdf2NativeModule = {
  pbkdf2Sha256(password: string, saltBase64: string, iterations: number, keyLength: number): Promise<string>;
};

// Android only. Elsewhere, and in tests, the module is absent.
const nativeModule = requireOptionalNativeModule<Pbkdf2NativeModule>("CogVestPbkdf2");

/** True when Android's PBKDF2 is available (#760). */
export const isPbkdf2Available = nativeModule !== null;

/**
 * PBKDF2-HMAC-SHA256 from Android's crypto provider. The password must be
 * printable ASCII; the salt and the key travel as base64.
 */
export function pbkdf2Sha256Async(password: string, saltBase64: string, iterations: number, keyLength: number) {
  if (!nativeModule) return Promise.reject(new Error("PBKDF2 is not available on this platform."));
  return nativeModule.pbkdf2Sha256(password, saltBase64, iterations, keyLength);
}
