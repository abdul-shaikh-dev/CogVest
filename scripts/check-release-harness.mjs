import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Release checklist step: bundle the production JavaScript exactly as a release
// build would (same environment and .env files) and fail if the QA harness flag
// was inlined. The flag's value never appears in source, only in a flagged bundle.
// See docs/testing/e2e-build-variant.md.
const harnessFlagValue = "cogvest-qa-harness-on";
const rootDir = process.cwd();
const outputDir = mkdtempSync(path.join(tmpdir(), "cogvest-release-harness-"));
const bundlePath = path.join(outputDir, "index.android.bundle");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function fail(message) {
  console.error(`FAIL ${message}`);
  rmSync(outputDir, { force: true, recursive: true });
  process.exit(1);
}

const args = [
  "expo",
  "export:embed",
  "--platform",
  "android",
  "--dev",
  "false",
  "--minify",
  "true",
  "--reset-cache",
  "--entry-file",
  "index.ts",
  "--bundle-output",
  bundlePath,
  "--assets-dest",
  path.join(outputDir, "assets"),
];
console.log("Bundling production JavaScript to check the QA harness flag...");
const result = spawnSync(
  process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : npxCommand,
  process.platform === "win32"
    ? [
        "/d",
        "/s",
        "/c",
        `call ${[npxCommand, ...args]
          .map((value) =>
            /[\s&|<>^]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value,
          )
          .join(" ")}`,
      ]
    : args,
  { cwd: rootDir, env: { ...process.env, NODE_ENV: "production" }, stdio: "inherit" },
);

if (result.error || result.status !== 0) {
  fail(`production bundle failed${result.error ? `: ${result.error.message}` : ""}`);
}

let bundle;
try {
  bundle = readFileSync(bundlePath, "utf8");
} catch {
  fail("production bundle was not written");
}

if (!bundle.includes("isQaHarnessEnabled") && !bundle.includes("cogvest-local-visual-qa")) {
  // Guard against checking an unrelated or empty bundle.
  fail("production bundle does not contain the QA harness gate; check the entry file");
}

if (bundle.includes(harnessFlagValue)) {
  fail("the QA harness flag is inlined into the production bundle. Unset EXPO_PUBLIC_COGVEST_QA_HARNESS and remove it from any .env file.");
}

rmSync(outputDir, { force: true, recursive: true });
console.log("PASS production bundle has the QA harness flag disabled.");
