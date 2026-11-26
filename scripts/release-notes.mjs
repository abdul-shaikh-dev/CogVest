import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Preview release notes (#827). After the EAS build, the preview workflow runs
// this to publish the GitHub pre-release for the tag: the APK link, what the
// PRs merged since the previous preview tag changed, the release gates that
// ran, and the open bugs. An existing release is never overwritten.
// Usage: node scripts/release-notes.mjs <tag> [--dry-run]
// Env: EAS_BUILD_ID, EAS_APK_URL, RUN_URL (placeholders when missing in a dry run).

const previewTagPattern = /^v(\d+)\.(\d+)\.(\d+)-preview\.(\d+)$/u;
const apkUrlPattern = /^https:\/\/expo\.dev\/artifacts\/eas\/[\w-]+\.apk$/u;
const buildIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u;
const runUrlPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/u;

function tagParts(tag) {
  const match = previewTagPattern.exec(tag);
  return match ? match.slice(1).map(Number) : undefined;
}

function compareParts(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

/** The highest preview tag below `tag`, or undefined for the first preview. */
export function previousPreviewTag(tag, tags) {
  const current = tagParts(tag);
  if (!current) throw new Error(`"${tag}" is not a preview tag (v<version>-preview.<n>).`);
  let best;
  for (const other of tags) {
    const parts = tagParts(other);
    if (!parts || compareParts(parts, current) >= 0) continue;
    if (!best || compareParts(parts, best.parts) > 0) best = { parts, tag: other };
  }
  return best?.tag;
}

/** PR numbers from first-parent merge-commit subjects ("Merge pull request #N from ..."). */
export function mergedPullNumbers(subjects) {
  const numbers = new Set();
  for (const subject of subjects) {
    const match = /^Merge pull request #(\d+) /u.exec(subject.trim());
    if (match) numbers.add(Number(match[1]));
  }
  return [...numbers].sort((left, right) => left - right);
}

/** The text under a `## <heading>` line up to the next `## ` heading, without HTML comments. */
export function markdownSection(body, heading) {
  const lines = (body ?? "").replace(/\r\n/gu, "\n").replace(/<!--[\s\S]*?-->/gu, "").split("\n");
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`);
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/u.test(line));
  const text = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return text === "" ? undefined : text;
}

export function isReleasePrep(pull) {
  return /^chore\(release\)/u.test(pull.title) || (pull.headRefName ?? "").startsWith("release/");
}

function titleNote(title) {
  const text = title.replace(/^\w+(?:\([^)]*\))?!?:\s*/u, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One list item per PR: its Release note section, else its title. "None" leaves it out. */
export function changeEntry(pull) {
  const section = markdownSection(pull.body, "Release note");
  if (section && /^none\.?$/iu.test(section)) return undefined;
  const lines = (section ?? titleNote(pull.title)).split("\n");
  const first = lines[0].replace(/^[-*]\s+/u, "");
  const rest = lines.slice(1).map((line) => (line.trim() === "" ? "" : `  ${line}`));
  return [`- ${first} (#${pull.number})`, ...rest].join("\n").trimEnd();
}

export function releaseTitle(tag) {
  const parts = tagParts(tag);
  if (!parts) throw new Error(`"${tag}" is not a preview tag.`);
  return `CogVest ${parts.slice(0, 3).join(".")} preview ${parts[3]}`;
}

/** Open issues labelled bug or titled "[Bug] ...", without the title prefix. */
export function openBugs(issues) {
  return issues
    .filter((issue) => issue.labels?.some((label) => label.name === "bug") || /^\[bug\]/iu.test(issue.title))
    .map((issue) => ({ number: issue.number, title: issue.title.replace(/^\[bug\]\s*/iu, "") }))
    .sort((left, right) => left.number - right.number);
}

export function buildReleaseNotes({ apkUrl, buildId, buildUrl, commit, knownIssues, pulls, runUrl, version, versionCode }) {
  const changes = pulls.filter((pull) => !isReleasePrep(pull)).map(changeEntry).filter(Boolean);
  const prepVerification = pulls
    .filter(isReleasePrep)
    .map((pull) => markdownSection(pull.body, "Release verification"))
    .filter(Boolean);
  const lines = [
    `Android preview ${version} (versionCode ${versionCode}), commit ${commit.slice(0, 7)}.`,
    "",
    `**Download:** [CogVest ${version} APK](${apkUrl}) (64-bit ARM phones; [EAS build ${buildId.slice(0, 8)}](${buildUrl})). Expo keeps the file for about two weeks.`,
    "",
    "## Changes",
    ...(changes.length > 0 ? changes : ["- No user-facing changes."]),
    "",
    "## Verification",
    `- **Preview workflow** ([run](${runUrl})): the release version check, typecheck, lint, Maestro selector lint, tests and Expo doctor passed, and the release bundle has no QA harness.`,
    ...prepVerification,
    "- The EAS APK itself was not installed at publication time.",
    "",
    "## Known issues",
    ...(knownIssues.length > 0
      ? knownIssues.map((issue) => `- #${issue.number}: ${issue.title}`)
      : ["- No open bugs."]),
  ];
  return `${lines.join("\n")}\n`;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function gather(tag, env, dryRun) {
  const placeholder = (name, value, pattern, fallback) => {
    if (value && pattern.test(value)) return value;
    if (dryRun) return fallback;
    throw new Error(`${name} is missing or malformed: "${value ?? ""}".`);
  };
  const apkUrl = placeholder("EAS_APK_URL", env.EAS_APK_URL, apkUrlPattern, "https://expo.dev/artifacts/eas/APK.apk");
  const buildId = placeholder("EAS_BUILD_ID", env.EAS_BUILD_ID, buildIdPattern, "00000000-0000-0000-0000-000000000000");
  const runUrl = placeholder("RUN_URL", env.RUN_URL, runUrlPattern, "https://github.com/OWNER/REPO/actions/runs/0");

  const app = JSON.parse(run("git", ["show", `${tag}:app.json`])).expo;
  const previous = previousPreviewTag(tag, run("git", ["tag", "--list", "v*-preview.*"]).split("\n").map((line) => line.trim()));
  const subjects = previous
    ? run("git", ["log", "--first-parent", "--merges", "--format=%s", `${previous}..${tag}`]).split("\n")
    : [];
  const pulls = mergedPullNumbers(subjects).map((number) =>
    JSON.parse(run("gh", ["pr", "view", String(number), "--json", "number,title,body,headRefName"])),
  );
  const knownIssues = openBugs(
    JSON.parse(run("gh", ["issue", "list", "--state", "open", "--limit", "200", "--json", "number,title,labels"])),
  );
  return {
    apkUrl,
    buildId,
    buildUrl: `https://expo.dev/accounts/${app.owner}/projects/${app.slug}/builds/${buildId}`,
    commit: run("git", ["rev-list", "-n", "1", tag]).trim(),
    knownIssues,
    pulls,
    runUrl,
    version: app.version,
    versionCode: app.android.versionCode,
  };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const tag = args.find((arg) => !arg.startsWith("--")) ?? process.env.GITHUB_REF_NAME;
  const notes = buildReleaseNotes(gather(tag, process.env, dryRun));
  if (dryRun) {
    process.stdout.write(notes);
    return;
  }
  if (spawnSync("gh", ["release", "view", tag], { encoding: "utf8" }).status === 0) {
    console.log(`SKIP A release for ${tag} already exists; it was left unchanged.`);
    return;
  }
  const file = join(mkdtempSync(join(tmpdir(), "release-notes-")), "notes.md");
  writeFileSync(file, notes);
  run("gh", ["release", "create", tag, "--verify-tag", "--prerelease", "--title", releaseTitle(tag), "--notes-file", file]);
  console.log(`PASS Published the ${tag} pre-release.`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/release-notes.mjs")) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exit(1);
  }
}
