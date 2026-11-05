const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

// SDK 58 turns R8 on for release builds. R8 rejects pdfbox-android (used by
// expo-pdf-text-extract for statement imports) and can strip classes it loads
// by reflection, so keep SDK 57 behaviour until R8 is enabled with PDF-import
// proof of its own (#618).
const minifyProperty = "android.enableMinifyInReleaseBuilds";

function keepReleaseMinifyOff(properties) {
  const rest = properties.filter((item) => !(item.type === "property" && item.key === minifyProperty));
  return [...rest, { type: "property", key: minifyProperty, value: "false" }];
}

// Gesture Handler 3 codegen paths pass Windows' 260-character limit, which the
// SDK's ninja 1.10 cannot handle in the app module. A local build may point
// COGVEST_NINJA (or the cogvestNinja Gradle property) at a long-path-aware
// ninja 1.12+. Unset, nothing changes. It is set while the app module is
// evaluated: a root-project hook runs after AGP has already read the DSL.
const ninjaMarker = "// CogVest: optional long-path-aware ninja for Windows native builds.";
const ninjaBlock = `
${ninjaMarker}
def cogvestNinja = System.getenv("COGVEST_NINJA") ?: findProperty("cogvestNinja")
if (cogvestNinja) {
    android.defaultConfig.externalNativeBuild.cmake.arguments("-DCMAKE_MAKE_PROGRAM=\${cogvestNinja}")
}
`;

function addOptionalNinja(buildGradle) {
  if (buildGradle.includes(ninjaMarker)) return buildGradle;
  return `${buildGradle.trimEnd()}\n${ninjaBlock}`;
}

function withAndroidBuildSettings(config) {
  config = withGradleProperties(config, (mod) => {
    mod.modResults = keepReleaseMinifyOff(mod.modResults);
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addOptionalNinja(mod.modResults.contents);
    return mod;
  });
}

module.exports = withAndroidBuildSettings;
module.exports.addOptionalNinja = addOptionalNinja;
module.exports.keepReleaseMinifyOff = keepReleaseMinifyOff;
