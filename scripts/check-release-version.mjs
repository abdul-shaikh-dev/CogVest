import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Release workflow step (#672): the tag must name the version in app.json and
// package.json, and android.versionCode must be higher than the one in every
// other release tag, since each tag is a distributed (or quota-blocked) build
// and Android never accepts a reused versionCode.
// Usage: node scripts/check-release-version.mjs <tag>   (defaults to GITHUB_REF_NAME)

const tagPattern = /^v(\d+\.\d+\.\d+)(?:-preview\.\d+)?$/u;

export function checkReleaseVersion({ tag, appVersion, packageVersion, versionCode, taggedVersionCodes }) {
  const errors = [];
  const match = tagPattern.exec(tag ?? "");
  if (!match) {
    errors.push(`"${tag ?? ""}" is not a release tag (v<version> or v<version>-preview.<n>).`);
  } else if (match[1] !== appVersion) {
    errors.push(`Tag ${tag} names ${match[1]}, but app.json has version ${appVersion}.`);
  }
  if (packageVersion !== appVersion) {
    errors.push(`package.json has version ${packageVersion}, but app.json has ${appVersion}.`);
  }
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    errors.push(`app.json android.versionCode ${versionCode} is not a positive integer.`);
  }
  for (const [otherTag, otherCode] of Object.entries(taggedVersionCodes)) {
    if (otherTag !== tag && Number.isInteger(otherCode) && otherCode >= versionCode) {
      errors.push(`versionCode ${versionCode} is not higher than ${otherCode}, already used by ${otherTag}.`);
    }
  }
  return errors;
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout : undefined;
}

export function readTaggedVersionCodes() {
  const tags = git(["tag", "--list", "v*"]);
  if (tags === undefined) throw new Error("git tag --list failed; fetch the tags first.");
  const codes = {};
  for (const tag of tags.split("\n").map((line) => line.trim()).filter(Boolean)) {
    const appJson = git(["show", `${tag}:app.json`]);
    if (appJson === undefined) continue;
    const code = JSON.parse(appJson).expo?.android?.versionCode;
    if (Number.isInteger(code)) codes[tag] = code;
  }
  return codes;
}

function main() {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
  const app = JSON.parse(readFileSync("app.json", "utf8")).expo;
  const errors = checkReleaseVersion({
    tag,
    appVersion: app.version,
    packageVersion: JSON.parse(readFileSync("package.json", "utf8")).version,
    versionCode: app.android?.versionCode,
    taggedVersionCodes: readTaggedVersionCodes(),
  });
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exit(1);
  }
  console.log(`PASS ${tag}: version ${app.version}, versionCode ${app.android.versionCode}`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/check-release-version.mjs")) main();
