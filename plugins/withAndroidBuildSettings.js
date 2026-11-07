const fs = require("fs");
const path = require("path");
const { withAppBuildGradle, withDangerousMod, withGradleProperties } = require("expo/config-plugins");

// R8 shrinks release (and E2E) builds, as SDK 58 does by default. Set it
// explicitly so a template change cannot turn it off unnoticed (#618).
const minifyProperty = "android.enableMinifyInReleaseBuilds";

function enableReleaseMinify(properties) {
  const rest = properties.filter((item) => !(item.type === "property" && item.key === minifyProperty));
  return [...rest, { type: "property", key: minifyProperty, value: "true" }];
}

// pdfbox-android backs expo-pdf-text-extract for statement imports. Its JPEG
// 2000 codec (com.gemalto.jp2) is an optional dependency that is not bundled, and it loads
// fonts, glyph lists and CMaps as resources relative to its own classes, so
// R8 must not rename or strip them.
const pdfboxMarker = "# CogVest: pdfbox-android rules for statement imports.";
const pdfboxRules = `
${pdfboxMarker}
-dontwarn com.gemalto.jp2.**
-keep class com.tom_roush.** { *; }
`;

function addPdfboxKeepRules(rules) {
  if (rules.includes(pdfboxMarker)) return rules;
  return `${rules.trimEnd()}\n${pdfboxRules}`;
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
    mod.modResults = enableReleaseMinify(mod.modResults);
    return mod;
  });
  config = withDangerousMod(config, [
    "android",
    (mod) => {
      const rulesPath = path.join(mod.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const current = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, "utf8") : "";
      fs.writeFileSync(rulesPath, addPdfboxKeepRules(current));
      return mod;
    },
  ]);
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addOptionalNinja(mod.modResults.contents);
    return mod;
  });
}

module.exports = withAndroidBuildSettings;
module.exports.addOptionalNinja = addOptionalNinja;
module.exports.addPdfboxKeepRules = addPdfboxKeepRules;
module.exports.enableReleaseMinify = enableReleaseMinify;
