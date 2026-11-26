declare const process: { execPath: string };
declare const require: (id: string) => unknown;

const { spawnSync } = require("node:child_process") as {
  spawnSync: (
    command: string,
    args: string[],
    options: { encoding: "utf8" },
  ) => { status: number | null; stdout: string; stderr: string };
};

// The script is an ES module; call its exports in Node rather than through Jest's transform.
function call(name: string, ...args: unknown[]): unknown {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import * as notes from "./scripts/release-notes.mjs"; console.log(JSON.stringify(notes[${JSON.stringify(name)}](...${JSON.stringify(args)}) ?? null));`,
    ],
    { encoding: "utf8" },
  );
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout);
}

type Pull = { body: string; headRefName: string; number: number; title: string };

function pull(number: number, title: string, body = "", headRefName = `feat/${number}`): Pull {
  return { body, headRefName, number, title };
}

const base = {
  apkUrl: "https://expo.dev/artifacts/eas/abc.apk",
  buildId: "ed4da784-eabd-4564-a622-0f871b2599bd",
  buildUrl: "https://expo.dev/accounts/owner/projects/cogvest/builds/ed4da784-eabd-4564-a622-0f871b2599bd",
  commit: "35f0b14f0000000000000000000000000000000",
  knownIssues: [],
  pulls: [],
  runUrl: "https://github.com/owner/repo/actions/runs/1",
  version: "1.0.38",
  versionCode: 39,
};

describe("preview release notes (#827)", () => {
  it("finds the highest earlier preview tag, comparing versions numerically", () => {
    const tags = ["v1.0.9-preview.1", "v1.0.10-preview.1", "v1.0.10-preview.2", "v1.0.11-preview.1", "v1.0.12-preview.1", "v1.0.10"];

    expect(call("previousPreviewTag", "v1.0.11-preview.1", tags)).toBe("v1.0.10-preview.2");
    expect(call("previousPreviewTag", "v1.0.10-preview.2", tags)).toBe("v1.0.10-preview.1");
    expect(call("previousPreviewTag", "v1.0.9-preview.1", tags)).toBeNull();
  });

  it("reads PR numbers from merge-commit subjects only", () => {
    expect(
      call("mergedPullNumbers", [
        "Merge pull request #826 from owner/release/1.0.38-preview",
        "Merge pull request #824 from owner/fix/benchmark-old-nav",
        "Merge branch 'main' into feature",
        "",
      ]),
    ).toEqual([824, 826]);
  });

  it("uses the Release note section, else the title without its type prefix", () => {
    const body = "## Summary\nInternal detail.\n\n## Release note\n<!-- prompt -->\n**Compare:** works for older portfolios.\n- detail one\n\n## Verification\nTests.";

    expect(call("changeEntry", pull(824, "fix(xirr): read older NAVs", body))).toBe(
      "- **Compare:** works for older portfolios. (#824)\n  - detail one",
    );
    expect(call("changeEntry", pull(5, "fix(xirr): read older NAVs"))).toBe("- Read older NAVs (#5)");
    expect(call("changeEntry", pull(6, "Plain title", "## Release note\n<!-- only the prompt -->\n"))).toBe(
      "- Plain title (#6)",
    );
    expect(call("changeEntry", pull(7, "ci: tidy", "## Release note\nNone."))).toBeNull();
  });

  it("lists open bugs by label or [Bug] title, without the prefix", () => {
    expect(
      call("openBugs", [
        { labels: [], number: 737, title: "[Bug] Return to the same screen" },
        { labels: [{ name: "bug" }], number: 529, title: "Preserve layout" },
        { labels: [{ name: "feature" }], number: 823, title: "[Feature] Sectors" },
      ]),
    ).toEqual([
      { number: 529, title: "Preserve layout" },
      { number: 737, title: "Return to the same screen" },
    ]);
  });

  it("builds the notes, skipping release-prep PRs but keeping their verification", () => {
    const notes = call("buildReleaseNotes", {
      ...base,
      knownIssues: [{ number: 737, title: "Return to the same screen" }],
      pulls: [
        pull(824, "fix(xirr): read older NAVs", "## Release note\n**Compare** works for older portfolios."),
        pull(825, "ci: tidy", "## Release note\nNone"),
        pull(
          826,
          "chore(release): prepare 1.0.38 Android preview",
          "## Release verification\n- Smoke tier 15/15 on CogVest_UX_Proof.",
          "release/1.0.38-preview",
        ),
      ],
    }) as string;

    expect(notes).toBe(
      [
        "Android preview 1.0.38 (versionCode 39), commit 35f0b14.",
        "",
        "**Download:** [CogVest 1.0.38 APK](https://expo.dev/artifacts/eas/abc.apk) (64-bit ARM phones; [EAS build ed4da784](https://expo.dev/accounts/owner/projects/cogvest/builds/ed4da784-eabd-4564-a622-0f871b2599bd)). Expo keeps the file for about two weeks.",
        "",
        "## Changes",
        "- **Compare** works for older portfolios. (#824)",
        "",
        "## Verification",
        "- **Preview workflow** ([run](https://github.com/owner/repo/actions/runs/1)): the release version check, typecheck, lint, Maestro selector lint, tests and Expo doctor passed, and the release bundle has no QA harness.",
        "- Smoke tier 15/15 on CogVest_UX_Proof.",
        "- The EAS APK itself was not installed at publication time.",
        "",
        "## Known issues",
        "- #737: Return to the same screen",
        "",
      ].join("\n"),
    );
    expect(notes).not.toContain("#825");
    expect(notes).not.toContain("#826");
  });

  it("says so when nothing user-facing changed and no bugs are open", () => {
    const notes = call("buildReleaseNotes", base) as string;

    expect(notes).toContain("## Changes\n- No user-facing changes.\n");
    expect(notes).toContain("## Known issues\n- No open bugs.\n");
  });

  it("titles the release from the tag", () => {
    expect(call("releaseTitle", "v1.0.38-preview.1")).toBe("CogVest 1.0.38 preview 1");
  });

  it("refuses to publish without a well-formed EAS build", () => {
    const result = spawnSync(process.execPath, ["scripts/release-notes.mjs", "v1.0.38-preview.1"], { encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FAIL EAS_APK_URL is missing or malformed");
  });
});
