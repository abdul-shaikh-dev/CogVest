const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require("expo/config-plugins");

// Local E2E build: release JavaScript with the QA harness flag, a separate
// package, debug signing. See docs/testing/e2e-build-variant.md.
const MARKER = "// CogVest E2E build type";
const HARNESS_FLAG = "EXPO_PUBLIC_COGVEST_QA_HARNESS";
const E2E_APP_NAME = "CogVest E2E";
// Both apps installed side by side must not share a deep-link scheme, or Android
// shows an app chooser. Debug and release keep the app's own scheme.
const SCHEME_PLACEHOLDER = "cogvestScheme";
const E2E_SCHEME = "cogvest-e2e";

const e2eBuildType = `
        ${MARKER}
        e2e {
            initWith release
            signingConfig signingConfigs.debug
            applicationIdSuffix ".e2e"
            matchingFallbacks = ["release"]
            manifestPlaceholders += [${SCHEME_PLACEHOLDER}: "${E2E_SCHEME}"]
        }
`;

const harnessReleaseGuard = `

// CogVest E2E harness guard: release builds must never bundle the QA harness flag.
gradle.taskGraph.whenReady { taskGraph ->
    def cogvestHarnessReleaseRequested = taskGraph.allTasks.any { task ->
        task.project == project && [
            "assembleRelease",
            "bundleRelease",
            "packageRelease",
        ].contains(task.name)
    }

    if (cogvestHarnessReleaseRequested) {
        def cogvestHarnessSources = []
        if (System.getenv("${HARNESS_FLAG}") != null) {
            cogvestHarnessSources << "the build environment"
        }
        new File(projectRoot).listFiles().findAll { file ->
            file.isFile() && file.name.startsWith(".env") &&
                file.text.contains("${HARNESS_FLAG}")
        }.each { file -> cogvestHarnessSources << file.name }

        if (!cogvestHarnessSources.isEmpty()) {
            throw new GradleException(
                "${HARNESS_FLAG} must not be set for a CogVest release build. Found in: " +
                cogvestHarnessSources.join(", ") +
                ". Use npm run android:e2e for the QA harness build."
            )
        }
    }
}
`;

function findBlockEnd(contents, openIndex) {
  let depth = 0;
  for (let index = contents.indexOf("{", openIndex); index < contents.length; index += 1) {
    if (contents[index] === "{") depth += 1;
    if (contents[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function injectE2eBuildType(contents, scheme) {
  if (contents.includes(MARKER)) {
    return contents;
  }
  if (!/^[a-z][a-z0-9+.-]*$/u.test(scheme ?? "")) {
    throw new Error("CogVest E2E build type needs the app's deep-link scheme.");
  }

  const defaultConfigIndex = contents.indexOf("    defaultConfig {");
  const defaultConfigEnd = defaultConfigIndex < 0 ? -1 : findBlockEnd(contents, defaultConfigIndex);
  const buildTypesIndex = contents.indexOf("    buildTypes {");
  const buildTypesEnd = buildTypesIndex < 0 ? -1 : findBlockEnd(contents, buildTypesIndex);
  if (
    defaultConfigEnd < 0 ||
    buildTypesEnd < 0 ||
    defaultConfigEnd > buildTypesIndex ||
    !contents.slice(buildTypesIndex, buildTypesEnd).includes("        release {") ||
    !contents.includes("def projectRoot")
  ) {
    throw new Error(
      "CogVest E2E build type plugin could not recognize the generated Android Gradle structure.",
    );
  }

  // Insert before the indentation of each block's closing brace.
  const defaultConfigInsert = contents.lastIndexOf("\n", defaultConfigEnd) + 1;
  const buildTypesInsert = contents.lastIndexOf("\n", buildTypesEnd) + 1;
  return (
    contents.slice(0, defaultConfigInsert) +
    `        manifestPlaceholders += [${SCHEME_PLACEHOLDER}: "${scheme}"]\n` +
    contents.slice(defaultConfigInsert, buildTypesInsert) +
    e2eBuildType.slice(1) +
    contents.slice(buildTypesInsert) +
    harnessReleaseGuard
  );
}

/** Points the main activity's app-scheme link filter at the build type's placeholder. */
function useSchemePlaceholder(manifest, scheme) {
  const activity = manifest.manifest.application?.[0]?.activity?.find(
    (entry) => entry.$["android:name"] === ".MainActivity",
  );
  const schemeData = (activity?.["intent-filter"] ?? [])
    .flatMap((filter) => filter.data ?? [])
    .filter((data) => data.$["android:scheme"] === scheme);
  if (schemeData.length !== 1) {
    throw new Error(`CogVest E2E build type expected one ${scheme} link filter on MainActivity.`);
  }
  schemeData[0].$["android:scheme"] = "${" + SCHEME_PLACEHOLDER + "}";
  return manifest;
}

function e2eStringsXml() {
  return `<resources>\n  <string name="app_name">${E2E_APP_NAME}</string>\n</resources>\n`;
}

function withE2eBuildType(config) {
  config = withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("CogVest E2E build type supports Groovy build.gradle files only.");
    }

    gradleConfig.modResults.contents = injectE2eBuildType(
      gradleConfig.modResults.contents,
      config.scheme,
    );
    return gradleConfig;
  });

  config = withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = useSchemePlaceholder(manifestConfig.modResults, config.scheme);
    return manifestConfig;
  });

  // The e2e source set overrides only the launcher name.
  return withDangerousMod(config, [
    "android",
    (modConfig) => {
      const valuesDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "e2e",
        "res",
        "values",
      );
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(path.join(valuesDir, "strings.xml"), e2eStringsXml());
      return modConfig;
    },
  ]);
}

module.exports = withE2eBuildType;
module.exports.injectE2eBuildType = injectE2eBuildType;
module.exports.useSchemePlaceholder = useSchemePlaceholder;
module.exports.e2eStringsXml = e2eStringsXml;
module.exports.E2E_SCHEME = E2E_SCHEME;
module.exports.HARNESS_FLAG = HARNESS_FLAG;
