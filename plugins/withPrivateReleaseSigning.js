const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// CogVest private release signing";

const signingProperties = `
${MARKER}
def cogvestSigningValue = { String name ->
    findProperty(name) ?: System.getenv(name)
}
def cogvestReleaseStoreFile = cogvestSigningValue("COGVEST_RELEASE_STORE_FILE")
def cogvestReleaseStorePassword = cogvestSigningValue("COGVEST_RELEASE_STORE_PASSWORD")
def cogvestReleaseKeyAlias = cogvestSigningValue("COGVEST_RELEASE_KEY_ALIAS")
def cogvestReleaseKeyPassword = cogvestSigningValue("COGVEST_RELEASE_KEY_PASSWORD")
def cogvestReleaseSigningMissing = [
    COGVEST_RELEASE_STORE_FILE: cogvestReleaseStoreFile,
    COGVEST_RELEASE_STORE_PASSWORD: cogvestReleaseStorePassword,
    COGVEST_RELEASE_KEY_ALIAS: cogvestReleaseKeyAlias,
    COGVEST_RELEASE_KEY_PASSWORD: cogvestReleaseKeyPassword,
].findAll { entry -> !entry.value }.keySet()
def cogvestHasReleaseSigning = cogvestReleaseSigningMissing.isEmpty()
def cogvestUsesEasSigning =
    System.getenv("EAS_BUILD") != null || file("eas-build.gradle").exists()
`;

const releaseSigningConfig = `
        release {
            if (cogvestHasReleaseSigning) {
                storeFile file(cogvestReleaseStoreFile)
                storePassword cogvestReleaseStorePassword
                keyAlias cogvestReleaseKeyAlias
                keyPassword cogvestReleaseKeyPassword
            }
        }
`;

const releaseTaskGuard = `

gradle.taskGraph.whenReady { taskGraph ->
    def cogvestReleaseTaskRequested = taskGraph.allTasks.any { task ->
        task.project == project && [
            "assembleRelease",
            "bundleRelease",
            "packageRelease",
        ].contains(task.name)
    }

    if (cogvestReleaseTaskRequested &&
        !cogvestHasReleaseSigning &&
        !cogvestUsesEasSigning) {
        throw new GradleException(
            "CogVest release signing credentials are required. Missing: " +
            cogvestReleaseSigningMissing.join(", ") +
            ". Set them in ~/.gradle/gradle.properties or the environment. " +
            "Use assembleDebug for local development APKs."
        )
    }
}
`;

function injectPrivateReleaseSigning(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const androidBlockIndex = contents.indexOf("android {");
  const signingConfigsIndex = contents.indexOf("    signingConfigs {");
  const buildTypesIndex = contents.indexOf("    buildTypes {");
  const releaseBlockIndex = contents.indexOf("        release {", buildTypesIndex);
  const debugReleaseSigningIndex = contents.indexOf(
    "signingConfig signingConfigs.debug",
    releaseBlockIndex,
  );

  if (
    androidBlockIndex < 0 ||
    signingConfigsIndex < 0 ||
    buildTypesIndex < 0 ||
    releaseBlockIndex < 0 ||
    debugReleaseSigningIndex < 0
  ) {
    throw new Error(
      "CogVest release signing plugin could not recognize the generated Android Gradle structure.",
    );
  }

  const signingConfigsSection = contents.slice(
    signingConfigsIndex,
    buildTypesIndex,
  );
  const signingConfigsCloseOffset = signingConfigsSection.lastIndexOf(
    "\n    }",
  );

  if (signingConfigsCloseOffset < 0) {
    throw new Error(
      "CogVest release signing plugin could not locate signingConfigs closure.",
    );
  }

  const signingConfigInsertIndex =
    signingConfigsIndex + signingConfigsCloseOffset;
  let result =
    contents.slice(0, androidBlockIndex) +
    signingProperties +
    "\n" +
    contents.slice(androidBlockIndex, signingConfigInsertIndex) +
    releaseSigningConfig +
    contents.slice(signingConfigInsertIndex);

  const updatedBuildTypesIndex = result.indexOf("    buildTypes {");
  const updatedReleaseBlockIndex = result.indexOf(
    "        release {",
    updatedBuildTypesIndex,
  );
  const updatedDebugSigningIndex = result.indexOf(
    "signingConfig signingConfigs.debug",
    updatedReleaseBlockIndex,
  );
  result =
    result.slice(0, updatedDebugSigningIndex) +
    `if (cogvestHasReleaseSigning) {
                signingConfig signingConfigs.release
            }` +
    result.slice(
      updatedDebugSigningIndex + "signingConfig signingConfigs.debug".length,
    );

  return result + releaseTaskGuard;
}

function withPrivateReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error(
        "CogVest release signing currently supports Groovy build.gradle files only.",
      );
    }

    gradleConfig.modResults.contents = injectPrivateReleaseSigning(
      gradleConfig.modResults.contents,
    );
    return gradleConfig;
  });
}

module.exports = withPrivateReleaseSigning;
module.exports.injectPrivateReleaseSigning = injectPrivateReleaseSigning;
