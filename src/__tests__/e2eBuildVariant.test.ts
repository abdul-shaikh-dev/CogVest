declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};
declare const require: (id: string) => unknown;

type AppConfig = {
  expo?: {
    android?: { package?: string };
    plugins?: unknown[];
    scheme?: string;
  };
};

type PackageConfig = {
  scripts?: Record<string, string>;
};

type ManifestData = { $: Record<string, string> };
type Manifest = {
  manifest: {
    application?: {
      activity?: { $: Record<string, string>; "intent-filter"?: { data?: ManifestData[] }[] }[];
    }[];
  };
};

type E2ePlugin = {
  E2E_SCHEME: string;
  HARNESS_FLAG: string;
  e2eStringsXml: () => string;
  injectE2eBuildType: (contents: string, scheme?: string) => string;
  useSchemePlaceholder: (manifest: Manifest, scheme: string) => Manifest;
};

const { readFileSync } = require("fs") as {
  readFileSync: (path: string, encoding: string) => string;
};
const path = require("path") as {
  resolve: (...segments: string[]) => string;
};
const { execFileSync } = require("child_process") as {
  execFileSync: (
    command: string,
    args: string[],
    options: { cwd: string; encoding: string; env?: Record<string, string | undefined> },
  ) => string;
};
const appConfig = require("../../app.json") as AppConfig;
const packageConfig = require("../../package.json") as PackageConfig;
const easConfig = require("../../eas.json") as unknown;
const {
  E2E_SCHEME,
  HARNESS_FLAG,
  e2eStringsXml,
  injectE2eBuildType,
  useSchemePlaceholder,
} = require("../../plugins/withE2eBuildType") as E2ePlugin;

const generatedBuildGradle = `
def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()
android {
    defaultConfig {
        applicationId 'com.abdulshaikh.cogvest'
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            if (cogvestHasReleaseSigning) {
                signingConfig signingConfigs.release
            }
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;
const injected = injectE2eBuildType(generatedBuildGradle, "cogvest");

function manifest(): Manifest {
  return {
    manifest: {
      application: [{
        activity: [{
          $: { "android:name": ".MainActivity" },
          "intent-filter": [
            { data: [{ $: { "android:scheme": "cogvest" } }] },
            { data: [{ $: { "android:scheme": "https" } }] },
          ],
        }],
      }],
    },
  };
}

describe("E2E build variant", () => {
  it("registers the plugin and keeps the Play package and scheme unchanged", () => {
    expect(appConfig.expo?.plugins).toContain("./plugins/withE2eBuildType");
    expect(appConfig.expo?.android?.package).toBe("com.abdulshaikh.cogvest");
    expect(appConfig.expo?.scheme).toBe("cogvest");
  });

  it("adds a debug-signed e2e build type with its own package", () => {
    const e2eBlock = injected.slice(injected.indexOf("        e2e {"), injected.indexOf("    }\n}"));

    expect(e2eBlock).toContain("initWith release");
    expect(e2eBlock).toContain("signingConfig signingConfigs.debug");
    expect(e2eBlock).toContain('applicationIdSuffix ".e2e"');
    // The release build type itself is untouched.
    expect(injected.slice(injected.indexOf("        release {"), injected.indexOf("        e2e {"))).not.toContain(
      ".e2e",
    );
    expect(injectE2eBuildType(injected, "cogvest")).toBe(injected);
  });

  it("keeps the app's scheme for debug and release and gives the E2E build its own", () => {
    const defaultConfig = injected.slice(injected.indexOf("    defaultConfig {"), injected.indexOf("    buildTypes {"));
    const e2eBlock = injected.slice(injected.indexOf("        e2e {"));

    expect(defaultConfig).toContain('manifestPlaceholders += [cogvestScheme: "cogvest"]');
    expect(e2eBlock).toContain(`manifestPlaceholders += [cogvestScheme: "${E2E_SCHEME}"]`);
    expect(E2E_SCHEME).not.toBe("cogvest");
    expect(() => injectE2eBuildType(generatedBuildGradle)).toThrow(/deep-link scheme/u);
  });

  it("points only the main activity's app link filter at the scheme placeholder", () => {
    const filters = useSchemePlaceholder(manifest(), "cogvest").manifest.application?.[0]?.activity?.[0]?.[
      "intent-filter"
    ];

    expect(filters?.[0]?.data?.[0]?.$["android:scheme"]).toBe("${cogvestScheme}");
    expect(filters?.[1]?.data?.[0]?.$["android:scheme"]).toBe("https");
    expect(() => useSchemePlaceholder(manifest(), "other")).toThrow(/expected one other link filter/u);
  });

  it("fails release Gradle tasks when the harness flag is in the environment or a .env file", () => {
    const guard = injected.slice(injected.indexOf("gradle.taskGraph.whenReady"));

    for (const task of ["assembleRelease", "bundleRelease", "packageRelease"]) {
      expect(guard).toContain(`"${task}"`);
    }
    expect(guard).toContain(`System.getenv("${HARNESS_FLAG}")`);
    expect(guard).toContain('file.name.startsWith(".env")');
    expect(guard).toContain("throw new GradleException");
  });

  it("refuses an unrecognized Gradle structure instead of skipping the guard", () => {
    expect(() => injectE2eBuildType("android {\n}\n", "cogvest")).toThrow(/could not recognize/u);
  });

  it("names the E2E app distinctly", () => {
    expect(e2eStringsXml()).toContain('<string name="app_name">CogVest E2E</string>');
  });

  it("builds the E2E APK locally and checks release bundles", () => {
    expect(packageConfig.scripts?.["android:e2e"]).toBe(
      "node scripts/android-build-apk.mjs --e2e --architecture=x86_64",
    );
    expect(packageConfig.scripts?.["release:check-harness"]).toBe(
      "node scripts/check-release-harness.mjs",
    );
    expect(Object.values(packageConfig.scripts ?? {}).join("\n")).not.toMatch(/eas (build|submit)/u);
  });

  it("never sets the harness flag in EAS profiles or committed .env files", () => {
    expect(JSON.stringify(easConfig)).not.toContain(HARNESS_FLAG);

    const tracked = execFileSync("git", ["ls-files"], { cwd: process.cwd(), encoding: "utf8" })
      .split("\n")
      .filter((file) => /(^|\/)\.env/u.test(file));
    for (const file of tracked) {
      expect(readFileSync(path.resolve(process.cwd(), file), "utf8")).not.toContain(HARNESS_FLAG);
    }
  });

  it("keys Metro's transform cache on the harness flag so release never reuses E2E transforms", () => {
    // Load the config in plain Node, as Expo CLI does; Jest's module runtime can't load Metro.
    const loadCacheVersion = (flag: string | undefined) => {
      const env = { ...process.env };
      delete env[HARNESS_FLAG];
      if (flag !== undefined) env[HARNESS_FLAG] = flag;
      return execFileSync(
        "node",
        ["-e", "process.stdout.write(String(require('./metro.config.js').cacheVersion))"],
        { cwd: process.cwd(), encoding: "utf8", env },
      );
    };

    const release = loadCacheVersion(undefined);
    const e2e = loadCacheVersion("cogvest-qa-harness-on");
    expect(release).toContain("qa-harness:");
    expect(release).not.toContain("cogvest-qa-harness-on");
    expect(e2e).toContain("cogvest-qa-harness-on");
    expect(e2e).not.toBe(release);
  });

  it("keeps the flag value out of app source so the release bundle check stays meaningful", () => {
    const appSources = execFileSync("git", ["ls-files", "app", "src"], { cwd: process.cwd(), encoding: "utf8" })
      .split("\n")
      .filter((file) => /\.(ts|tsx)$/u.test(file) && !file.includes("__tests__"));

    expect(appSources.length).toBeGreaterThan(100);
    for (const file of appSources) {
      expect(readFileSync(path.resolve(process.cwd(), file), "utf8")).not.toContain("cogvest-qa-harness-on");
    }
  });
});
