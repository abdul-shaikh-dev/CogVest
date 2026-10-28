import { e2eApplicationId, isQaHarnessEnabled } from "@/src/testing/qaHarness";
import { canUseVisualQaHarness, visualQaSeedToken } from "@/src/testing/visualQaSeed";

const playApplicationId = "com.abdulshaikh.cogvest";
const release = { isDevelopment: false };

describe("QA harness gate", () => {
  it("is open in development builds", () => {
    expect(isQaHarnessEnabled({ applicationId: playApplicationId, isDevelopment: true })).toBe(true);
  });

  it("is closed in a release build without the harness flag", () => {
    expect(isQaHarnessEnabled({ ...release, applicationId: playApplicationId })).toBe(false);
    expect(isQaHarnessEnabled({ ...release, applicationId: e2eApplicationId })).toBe(false);
    expect(isQaHarnessEnabled({ ...release, applicationId: e2eApplicationId, harnessFlag: "" })).toBe(false);
  });

  it("stays closed in the Play package even if the flag leaked into its bundle", () => {
    expect(
      isQaHarnessEnabled({ ...release, applicationId: playApplicationId, harnessFlag: "cogvest-qa-harness-on" }),
    ).toBe(false);
    expect(isQaHarnessEnabled({ ...release, applicationId: null, harnessFlag: "cogvest-qa-harness-on" })).toBe(
      false,
    );
  });

  it("opens only in the E2E package bundled with the flag", () => {
    expect(
      isQaHarnessEnabled({ ...release, applicationId: e2eApplicationId, harnessFlag: "cogvest-qa-harness-on" }),
    ).toBe(true);
  });

  it("still requires the token when the gate is open", () => {
    expect(canUseVisualQaHarness({ enabled: true, token: "wrong" })).toBe(false);
    expect(canUseVisualQaHarness({ enabled: true })).toBe(false);
    expect(canUseVisualQaHarness({ enabled: true, token: visualQaSeedToken })).toBe(true);
  });

  it("uses the E2E package as its only non-development identity", () => {
    expect(e2eApplicationId).toBe(`${playApplicationId}.e2e`);
  });
});
