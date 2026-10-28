import * as Application from "expo-application";

/** The local E2E build's package. The Play and private release package never matches it. */
export const e2eApplicationId = "com.abdulshaikh.cogvest.e2e";

/**
 * Whether QA harness routes may run: in development builds, and in the local E2E
 * build only when it was bundled with the harness flag. Both the flag and the
 * installed package must agree, so a flag leaked into a release bundle stays off.
 * See docs/testing/e2e-build-variant.md.
 */
export function isQaHarnessEnabled({
  applicationId = Application.applicationId,
  harnessFlag = process.env.EXPO_PUBLIC_COGVEST_QA_HARNESS,
  isDevelopment = __DEV__,
}: {
  applicationId?: string | null;
  harnessFlag?: string;
  isDevelopment?: boolean;
} = {}) {
  return isDevelopment || (Boolean(harnessFlag) && applicationId === e2eApplicationId);
}
