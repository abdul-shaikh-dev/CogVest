const { addOptionalNinja, keepReleaseMinifyOff } = require("../../plugins/withAndroidBuildSettings");

describe("Android build settings plugin", () => {
  it("is registered with the app config", () => {
    expect(require("../../app.json").expo.plugins).toContain("./plugins/withAndroidBuildSettings");
  });

  it("keeps release minification off, replacing the SDK default once", () => {
    const sdkDefault = [
      { type: "comment", value: "Enable R8 in release builds" },
      { type: "property", key: "android.enableMinifyInReleaseBuilds", value: "true" },
      { type: "property", key: "hermesEnabled", value: "true" },
    ];
    const result = keepReleaseMinifyOff(sdkDefault);
    expect(result.filter((item: { key?: string }) => item.key === "android.enableMinifyInReleaseBuilds"))
      .toEqual([{ type: "property", key: "android.enableMinifyInReleaseBuilds", value: "false" }]);
    expect(result).toContainEqual({ type: "property", key: "hermesEnabled", value: "true" });
    expect(keepReleaseMinifyOff(result)).toEqual(result);
  });

  it("adds an opt-in ninja override only once and only behind the local setting", () => {
    const patched = addOptionalNinja("android {\n}\n");
    expect(patched).toContain('System.getenv("COGVEST_NINJA") ?: findProperty("cogvestNinja")');
    expect(patched).toContain("if (cogvestNinja) {");
    expect(patched).toContain('android.defaultConfig.externalNativeBuild.cmake.arguments("-DCMAKE_MAKE_PROGRAM=${cogvestNinja}")');
    expect(addOptionalNinja(patched)).toBe(patched);
  });
});
