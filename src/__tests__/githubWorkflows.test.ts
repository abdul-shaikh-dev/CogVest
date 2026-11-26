declare const process: { cwd: () => string; execPath: string };
declare const require: (id: string) => unknown;

const { spawnSync } = require("node:child_process") as {
  spawnSync: (
    command: string,
    args: string[],
    options: { encoding: "utf8" },
  ) => { status: number | null; stdout: string; stderr: string };
};
const fs = require("fs") as {
  readFileSync: (path: string, encoding: "utf8") => string;
};
const path = require("path") as {
  join: (...parts: string[]) => string;
};

function readWorkflow(name: string) {
  return fs
    .readFileSync(
      path.join(process.cwd(), ".github", "workflows", name),
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

const checkoutPin = "uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0";
const setupNodePin = "uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0";

function stepIndex(workflow: string, name: string) {
  const index = workflow.indexOf(`- name: ${name}\n`);
  expect(index).toBeGreaterThan(-1);
  return index;
}

type VersionInput = {
  tag?: string;
  appVersion: string;
  packageVersion: string;
  versionCode: unknown;
  taggedVersionCodes: Record<string, number>;
};

// The check is an ES module script; run it in Node rather than through Jest's transform.
function checkReleaseVersion(input: VersionInput): string[] {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { checkReleaseVersion } from "./scripts/check-release-version.mjs"; console.log(JSON.stringify(checkReleaseVersion(${JSON.stringify(input)})));`,
    ],
    { encoding: "utf8" },
  );
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout) as string[];
}

const release: VersionInput = {
  tag: "v1.0.32-preview.1",
  appVersion: "1.0.32",
  packageVersion: "1.0.32",
  versionCode: 33,
  taggedVersionCodes: { "v1.0.31-preview.1": 32, "v1.0.31-preview.2": 32 },
};

describe("GitHub workflows", () => {
  it("builds preview tags with current action runtimes and direct EAS auth", () => {
    const workflow = readWorkflow("android-preview.yml");

    expect(workflow).toContain("  push:");
    expect(workflow).toContain('      - "v*-preview.*"');
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain(checkoutPin);
    expect(workflow).toContain(setupNodePin);
    expect(workflow).toContain("npm install --global eas-cli@27.2.0\n");
    // A cancelled EAS build still exits 0, so the status is checked.
    expect(workflow).toContain("--non-interactive --json > build.json");
    expect(workflow).toContain(`test "$(jq -r '.[0].status' build.json)" = "FINISHED"`);
    expect(workflow).toContain("EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}");
    expect(workflow).not.toContain("expo/expo-github-action");
  });

  it("pins every action to a commit SHA (#672)", () => {
    for (const name of ["ci.yml", "android-preview.yml"]) {
      const uses = readWorkflow(name).match(/uses: \S+.*/gu) ?? [];
      expect(uses.length).toBeGreaterThan(0);
      for (const use of uses) {
        expect(use).toMatch(/^uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/u);
      }
    }
  });

  it("refuses to build anything but a release tag, before checking out (#672)", () => {
    const workflow = readWorkflow("android-preview.yml");

    expect(workflow).toContain('if [ "$GITHUB_REF_TYPE" != "tag" ]; then');
    expect(stepIndex(workflow, "Require a release tag")).toBeLessThan(stepIndex(workflow, "Checkout"));
    // The versionCode check reads app.json at every other tag.
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("persist-credentials: false");
  });

  it("runs the release gates before the signed build (#672)", () => {
    const workflow = readWorkflow("android-preview.yml");
    const build = stepIndex(workflow, "Build preview APK");

    for (const [name, command] of [
      ["Check the tag, version and versionCode", 'node scripts/check-release-version.mjs "$GITHUB_REF_NAME"'],
      ["Lint", "npm run lint"],
      ["Maestro selector lint", "npm run maestro:lint"],
      ["Check the release bundle has no QA harness", "npm run release:check-harness"],
    ]) {
      expect(workflow).toContain(`- name: ${name}\n        run: ${command}\n`);
      expect(stepIndex(workflow, name)).toBeLessThan(build);
    }
    // Only the build step sees the EAS token.
    expect(workflow.indexOf("EXPO_TOKEN")).toBeGreaterThan(build);
  });

  it("publishes the pre-release from a separate job without the EAS token (#827)", () => {
    const workflow = readWorkflow("android-preview.yml");
    const start = workflow.indexOf("  publish-release:\n");
    expect(start).toBeGreaterThan(-1);
    const job = workflow.slice(start);

    expect(job).toContain("needs: preview-apk");
    expect(job).toContain("permissions:\n      contents: write\n      issues: read\n      pull-requests: read\n");
    expect(job).toContain("persist-credentials: false");
    expect(job).toContain('run: node scripts/release-notes.mjs "$GITHUB_REF_NAME"');
    expect(job).toContain("EAS_APK_URL: ${{ needs.preview-apk.outputs.apk-url }}");
    expect(job).not.toContain("EXPO_TOKEN");
    expect(job).not.toContain("npm ci");
    // The build job keeps read-only contents and exposes the build for the notes.
    expect(workflow.slice(0, start)).toContain(`echo "apk-url=$(jq -r '.[0].artifacts.buildUrl' build.json)" >> "$GITHUB_OUTPUT"`);
  });

  it("runs the tests once more in UTC (#673)", () => {
    const workflow = readWorkflow("ci.yml");
    const start = workflow.indexOf("  test-utc:\n");
    expect(start).toBeGreaterThan(-1);
    const job = workflow.slice(start);

    expect(job).toContain("name: Test in UTC");
    expect(job).toContain("- name: Test\n        env:\n          TZ: UTC\n        run: npm test -- --runInBand\n");
  });

  it("runs lint and the Maestro selector lint in default CI", () => {
    const workflow = readWorkflow("ci.yml");

    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain(checkoutPin);
    expect(workflow).toContain(setupNodePin);
    expect(workflow).toContain("- name: Lint\n        run: npm run lint\n");
    expect(workflow).toContain("- name: Maestro selector lint\n        run: npm run maestro:lint\n");
  });
});

describe("release version check (#672)", () => {
  it("accepts a tag that names the app version with a new, higher versionCode", () => {
    expect(checkReleaseVersion(release)).toEqual([]);
    expect(checkReleaseVersion({ ...release, tag: "v1.0.32" })).toEqual([]);
  });

  it("ignores the tag being built, so a rerun of the same tag passes", () => {
    expect(checkReleaseVersion({
      ...release, taggedVersionCodes: { ...release.taggedVersionCodes, "v1.0.32-preview.1": 33 },
    })).toEqual([]);
  });

  it("rejects a versionCode that another tag already used or passed", () => {
    expect(checkReleaseVersion({ ...release, versionCode: 32 })).toEqual([
      "versionCode 32 is not higher than 32, already used by v1.0.31-preview.1.",
      "versionCode 32 is not higher than 32, already used by v1.0.31-preview.2.",
    ]);
    expect(checkReleaseVersion({ ...release, taggedVersionCodes: { "v1.0.40": 40 } })).toEqual([
      "versionCode 33 is not higher than 40, already used by v1.0.40.",
    ]);
  });

  it("rejects a tag whose version differs from app.json or package.json", () => {
    expect(checkReleaseVersion({ ...release, tag: "v1.0.31-preview.3" })).toEqual([
      "Tag v1.0.31-preview.3 names 1.0.31, but app.json has version 1.0.32.",
    ]);
    expect(checkReleaseVersion({ ...release, packageVersion: "1.0.31" })).toEqual([
      "package.json has version 1.0.31, but app.json has 1.0.32.",
    ]);
  });

  it("rejects a branch or malformed ref and a missing versionCode", () => {
    for (const tag of ["main", "v1.0.32-beta.1", "1.0.32", ""]) {
      expect(checkReleaseVersion({ ...release, tag })[0]).toMatch(/is not a release tag/u);
    }
    expect(checkReleaseVersion({ ...release, versionCode: undefined })).toContain(
      "app.json android.versionCode undefined is not a positive integer.",
    );
  });
});
