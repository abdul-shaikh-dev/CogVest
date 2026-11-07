const { addOptionalNinja, addPdfboxKeepRules, enableReleaseMinify } = require("../../plugins/withAndroidBuildSettings");

describe("Android build settings plugin", () => {
  it("is registered with the app config", () => {
    expect(require("../../app.json").expo.plugins).toContain("./plugins/withAndroidBuildSettings");
  });

  it("turns release minification on, replacing any template value once", () => {
    const template = [
      { type: "comment", value: "Enable R8 in release builds" },
      { type: "property", key: "android.enableMinifyInReleaseBuilds", value: "false" },
      { type: "property", key: "hermesEnabled", value: "true" },
    ];
    const result = enableReleaseMinify(template);
    expect(result.filter((item: { key?: string }) => item.key === "android.enableMinifyInReleaseBuilds"))
      .toEqual([{ type: "property", key: "android.enableMinifyInReleaseBuilds", value: "true" }]);
    expect(result).toContainEqual({ type: "property", key: "hermesEnabled", value: "true" });
    expect(enableReleaseMinify(result)).toEqual(result);
  });

  it("keeps pdfbox intact under R8 and adds the rules only once", () => {
    const template = "-keep class com.swmansion.reanimated.** { *; }\n";
    const patched = addPdfboxKeepRules(template);
    expect(patched.startsWith(template.trimEnd())).toBe(true);
    expect(patched).toContain("-dontwarn com.gemalto.jp2.JP2Decoder");
    expect(patched).toContain("-keep class com.tom_roush.** { *; }");
    expect(addPdfboxKeepRules(patched)).toBe(patched);
  });

  it("adds an opt-in ninja override only once and only behind the local setting", () => {
    const patched = addOptionalNinja("android {\n}\n");
    expect(patched).toContain('System.getenv("COGVEST_NINJA") ?: findProperty("cogvestNinja")');
    expect(patched).toContain("if (cogvestNinja) {");
    expect(patched).toContain('android.defaultConfig.externalNativeBuild.cmake.arguments("-DCMAKE_MAKE_PROGRAM=${cogvestNinja}")');
    expect(addOptionalNinja(patched)).toBe(patched);
  });
});
