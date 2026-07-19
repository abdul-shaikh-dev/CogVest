declare const process: {
  cwd: () => string;
};
declare const require: (id: string) => unknown;

type AppConfig = {
  expo?: {
    plugins?: unknown[];
  };
};

type PackageConfig = {
  scripts?: Record<string, string>;
};

type SigningPlugin = {
  injectPrivateReleaseSigning?: (contents: string) => string;
};

const { readFileSync } = require("fs") as {
  readFileSync: (path: string, encoding: string) => string;
};
const path = require("path") as {
  resolve: (...segments: string[]) => string;
};
const appConfig = require("../../app.json") as AppConfig;
const packageConfig = require("../../package.json") as PackageConfig;
const { injectPrivateReleaseSigning } = require(
  "../../plugins/withPrivateReleaseSigning",
) as SigningPlugin;

const generatedBuildGradle = `
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;

describe("Android release signing", () => {
  it("registers the durable Expo signing plugin", () => {
    expect(appConfig.expo?.plugins).toContain(
      "./plugins/withPrivateReleaseSigning",
    );
  });

  it("uses debug APKs by default and keeps release builds explicit", () => {
    expect(packageConfig.scripts?.["android:apk"]).toBe(
      "node scripts/android-build-apk.mjs",
    );
    expect(packageConfig.scripts?.["android:apk:emulator"]).toBe(
      "node scripts/android-build-apk.mjs --architecture=x86_64",
    );
    expect(packageConfig.scripts?.["android:apk:release"]).toBe(
      "node scripts/android-build-apk.mjs --release",
    );
  });

  it("replaces generated debug release signing with private credentials", () => {
    const result = injectPrivateReleaseSigning?.(generatedBuildGradle);
    const buildTypes = result?.slice(result.indexOf("    buildTypes {"));
    const releaseBuild = buildTypes?.slice(
      buildTypes.indexOf("        release {"),
    );

    expect(result).toContain("COGVEST_RELEASE_STORE_FILE");
    expect(buildTypes).toContain("signingConfig signingConfigs.debug");
    expect(result).toContain("signingConfig signingConfigs.release");
    expect(releaseBuild).not.toContain("signingConfig signingConfigs.debug");
    expect(result).toContain(
      "CogVest release signing credentials are required",
    );
  });

  it("applies the Gradle transformation only once", () => {
    const first = injectPrivateReleaseSigning?.(generatedBuildGradle);
    const second = first ? injectPrivateReleaseSigning?.(first) : undefined;

    expect(second).toBe(first);
  });

  it("ignores local signing credentials and keystores", () => {
    const gitignore = readFileSync(
      path.resolve(process.cwd(), ".gitignore"),
      "utf8",
    );

    expect(gitignore).toContain("credentials.json");
    expect(gitignore).toContain("keystore.properties");
    expect(gitignore).toContain("*.jks");
    expect(gitignore).toContain("*.keystore");
  });
});
