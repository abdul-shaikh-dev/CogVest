import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const defaultFlows = [
  "e2e/smoke-launch.yaml",
  "e2e/navigation.yaml",
  "e2e/dashboard-valuation-basis.yaml",
  "e2e/add-trade.yaml",
  "e2e/add-holding-lookup.yaml",
  "e2e/add-holding-back.yaml",
  "e2e/add-holding-manual-semantics.yaml",
  "e2e/add-holding-pending-valuation.yaml",
  "e2e/add-holding-unknown-date.yaml",
  "e2e/add-holding-edited-quote.yaml",
  "e2e/add-holding-asset-switch.yaml",
  "e2e/add-holding-asset-class.yaml",
  "e2e/add-holding-review-hierarchy.yaml",
  "e2e/quick-portfolio-setup.yaml",
  "e2e/sell-quote-context.yaml",
  "e2e/holdings-csv-import.yaml",
  "e2e/transactions-csv-import.yaml",
  "e2e/cas-native-import.yaml",
  "e2e/cas-native-fresh-portfolio.yaml",
  "e2e/zerodha-tradebook-import.yaml",
  "e2e/futures-manual-wallet.yaml",
  "e2e/futures-draft-protection.yaml",
  "e2e/futures-timestamp-evidence.yaml",
  "e2e/futures-cash-funding.yaml",
  "e2e/investing-cash-migration.yaml",
  "e2e/epf-persistence.yaml",
  "e2e/epf-reporting.yaml",
  "e2e/epf-accounts.yaml",
  "e2e/epf-entries.yaml",
  "e2e/epf-corrections.yaml",
  "e2e/epf-matrix.yaml",
  "e2e/epf-progress-empty.yaml",
  "e2e/epf-year-summary.yaml",
  "e2e/holdings.yaml",
  "e2e/holdings-list-first.yaml",
  "e2e/holdings-list-first-layout.yaml",
  "e2e/ppf-account.yaml",
  "e2e/ppf-history-fallback.yaml",
  "e2e/opening-position-correction.yaml",
  "e2e/trade-correction.yaml",
  "e2e/bulk-transaction-delete.yaml",
  "e2e/asset-correction.yaml",
  "e2e/cash.yaml",
  "e2e/cash-entry-focus.yaml",
  "e2e/funded-buy-cash.yaml",
  "e2e/record-purchase.yaml",
  "e2e/payouts.yaml",
  "e2e/snapshot-review.yaml",
  "e2e/progress-chart-range.yaml",
  "e2e/progress-chart-month-navigation.yaml",
  "e2e/progress-snapshot-history.yaml",
  "e2e/value-masking.yaml",
  "e2e/minimal-mode.yaml",
  "e2e/insight-details.yaml",
  "e2e/holding-duration.yaml",
  "e2e/contextual-nudges.yaml",
  "e2e/persistence.yaml",
  "e2e/privacy-settings.yaml",
  "e2e/settings-preference-hierarchy.yaml",
  "e2e/shared-ui-hierarchy.yaml",
  "e2e/workflow-exit-navigation.yaml",
];

// One flow per primary journey, each asserting stored results. Run it for every
// change to UI or e2e/; run the full default list weekly and before a release gate.
const smokeFlows = [
  "e2e/smoke-launch.yaml",
  "e2e/navigation.yaml",
  "e2e/add-holding-lookup.yaml",
  "e2e/record-purchase.yaml",
  "e2e/payouts.yaml",
  "e2e/cash.yaml",
  "e2e/trade-correction.yaml",
  "e2e/holdings-csv-import.yaml",
  "e2e/epf-accounts.yaml",
  "e2e/ppf-account.yaml",
  "e2e/progress-snapshot-history.yaml",
  "e2e/value-masking.yaml",
  "e2e/persistence.yaml",
];
const smokeBudgetMs = 15 * 60 * 1000;

function candidateNames(command) {
  if (process.platform !== "win32") {
    return [command];
  }

  return [`${command}.exe`, `${command}.cmd`, `${command}.bat`, command];
}

function findExecutable(command) {
  const delimiter = process.platform === "win32" ? ";" : ":";
  const pathValue = [process.env.PATH, process.env.Path, process.env.path]
    .filter(Boolean)
    .join(delimiter);

  for (const directory of pathValue.split(delimiter)) {
    for (const candidate of candidateNames(command)) {
      const fullPath = join(directory, candidate);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

function run(command, args = []) {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(command)) {
    return spawnSync(command, args, {
      encoding: "utf8",
      shell: true,
      stdio: "inherit",
    });
  }

  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "inherit",
  });
}

const maestroPath = findExecutable("maestro");
if (!maestroPath) {
  console.log("FAIL maestro not found");
  console.log("Run `npm run maestro:check` for install guidance.");
  process.exit(1);
}

// Flows declare `appId: ${APP_ID}` and open `${SCHEME}://` links. COGVEST_APP_ID
// picks the debug app served by Metro (default) or the local E2E build, which has
// its own scheme so both can be installed; see docs/testing/e2e-build-variant.md.
const debugAppId = "com.abdulshaikh.cogvest";
const e2eAppId = "com.abdulshaikh.cogvest.e2e";
const appId = process.env.COGVEST_APP_ID ?? debugAppId;
if (appId !== debugAppId && appId !== e2eAppId) {
  console.log(`FAIL COGVEST_APP_ID must be ${debugAppId} or ${e2eAppId}, not ${appId}`);
  process.exit(1);
}
const scheme = appId === e2eAppId ? "cogvest-e2e" : "cogvest";
console.log(`Target app: ${appId} (${scheme}://)`);

const isSmoke = process.argv.includes("--smoke");
const requestedFlows = process.argv.slice(2).filter((arg) => arg !== "--smoke");
const flows = requestedFlows.length > 0 ? requestedFlows : isSmoke ? smokeFlows : defaultFlows;
const holdingsCsvFlow = "e2e/holdings-csv-import.yaml";
const holdingsCsvFixture = "e2e/fixtures/holdings-import-v1.csv";
const transactionsCsvFlow = "e2e/transactions-csv-import.yaml";
const transactionsCsvFixture = "e2e/fixtures/transactions-import-v1.csv";
const casNativeFlow = "e2e/cas-native-import.yaml";
const casNativeFreshPortfolioFlow = "e2e/cas-native-fresh-portfolio.yaml";
const zerodhaTradebookFlow = "e2e/zerodha-tradebook-import.yaml";
const zerodhaTradebookFixtures = [
  "e2e/fixtures/zerodha-tradebook-2024.csv",
  "e2e/fixtures/zerodha-tradebook-2025.csv",
];

function pushFixture(adbPath, fixture) {
  if (!existsSync(fixture)) return `fixture not found: ${fixture}`;
  const fileName = fixture.split(/[\\/]/u).at(-1);
  const destination = `/sdcard/Download/${fileName}`;
  const push = run(adbPath, ["push", fixture, destination]);
  if (push.status !== 0) return `unable to copy ${fileName} to Android Downloads`;
  const scan = run(adbPath, [
    "shell",
    "am",
    "broadcast",
    "-a",
    "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
    "-d",
    `file://${destination}`,
  ]);
  if (scan.status !== 0) return `unable to register ${fileName} with Android`;
  return null;
}

for (const flow of flows) {
  if (!existsSync(flow)) {
    console.log(`FAIL flow not found: ${flow}`);
    process.exit(1);
  }
}

// Android 15+ blocks network for apps behind another activity, such as the
// system file picker. A debug build then loses its Metro Fast Refresh socket and
// shows a warning banner over bottom-of-screen actions. Allowlisting the app
// from background network restrictions keeps that socket open; it does not
// change app behaviour under test and is reset by reinstalling the app. The E2E
// build bundles its JavaScript, so it has no socket and is not allowlisted.
const allowlistAdbPath = appId === debugAppId ? findExecutable("adb") : null;
if (allowlistAdbPath) {
  const allowlist = run(allowlistAdbPath, [
    "shell",
    "dumpsys",
    "deviceidle",
    "whitelist",
    `+${debugAppId}`,
  ]);
  if (allowlist.status !== 0) {
    console.log("WARN unable to exempt CogVest from background network restrictions");
  }
}

/** Copies the files a flow picks through the system picker; returns a setup error. */
function prepareFlow(flow) {
  const normalized = flow.replaceAll("\\", "/");
  const fixtures = {
    [holdingsCsvFlow]: [holdingsCsvFixture],
    [transactionsCsvFlow]: [transactionsCsvFixture],
    [zerodhaTradebookFlow]: zerodhaTradebookFixtures,
    [casNativeFlow]: ["e2e/fixtures/cas-native-synthetic.pdf"],
    [casNativeFreshPortfolioFlow]: ["e2e/fixtures/cas-native-synthetic.pdf"],
  }[normalized];
  if (!fixtures) return null;
  const adbPath = findExecutable("adb");
  if (!adbPath) return "adb not found";
  if (normalized === holdingsCsvFlow) {
    const directory = run(adbPath, [
      "shell",
      "rm",
      "-rf",
      "/sdcard/Documents/CogVestTemplateTest",
    ]);
    if (directory.status !== 0) {
      return "unable to reset the Android CSV template test folder";
    }
  }
  for (const fixture of fixtures) {
    const error = pushFixture(adbPath, fixture);
    if (error) return error;
  }
  return null;
}

/** Streams Maestro's output live and keeps it to name the failing step. */
function runMaestro(flow) {
  const outputArgs = process.env.MAESTRO_TEST_OUTPUT_DIR
    ? [`--test-output-dir=${process.env.MAESTRO_TEST_OUTPUT_DIR}`]
    : [];
  return new Promise((resolve) => {
    let output = "";
    const child = spawn(maestroPath, ["test", "-e", `APP_ID=${appId}`, "-e", `SCHEME=${scheme}`, flow, ...outputArgs], {
      shell: process.platform === "win32" && /\.(cmd|bat)$/iu.test(maestroPath),
      stdio: ["inherit", "pipe", "pipe"],
    });
    const collect = (stream, target) => stream.on("data", (chunk) => {
      target.write(chunk);
      output += chunk.toString();
    });
    collect(child.stdout, process.stdout);
    collect(child.stderr, process.stderr);
    child.on("error", (error) => resolve({ output: error.message, status: 1 }));
    child.on("close", (status) => resolve({ output, status: status ?? 1 }));
  });
}

function failingStep(output) {
  const lines = output
    .replace(/\u001b\[[0-9;]*m/gu, "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.findLast((line) => /FAILED/u.test(line)) ??
    lines.findLast((line) => /error|not found|timeout/iu.test(line)) ??
    "see Maestro output above"
  );
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

const results = [];
const suiteStart = Date.now();
for (const flow of flows) {
  const flowStart = Date.now();
  const setupError = prepareFlow(flow);
  if (setupError) {
    console.log(`FAIL setup for ${flow}: ${setupError}`);
    results.push({ flow, passed: false, durationMs: 0, step: `setup: ${setupError}` });
    continue;
  }
  console.log(`RUN maestro test ${flow}`);
  const { output, status } = await runMaestro(flow);
  const passed = status === 0;
  if (!passed) console.log(`FAIL Maestro flow failed: ${flow}`);
  results.push({ flow, passed, durationMs: Date.now() - flowStart, step: passed ? "" : failingStep(output) });
}

const totalMs = Date.now() - suiteStart;
const failures = results.filter((result) => !result.passed);
console.log("");
console.log(`SUMMARY ${isSmoke && requestedFlows.length === 0 ? "smoke" : "Maestro"} run: ${results.length - failures.length} passed, ${failures.length} failed, ${formatDuration(totalMs)}`);
for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${formatDuration(result.durationMs).padStart(7)}  ${result.flow}${result.passed ? "" : `\n       ${result.step}`}`);
}
if (isSmoke && requestedFlows.length === 0 && totalMs > smokeBudgetMs) {
  console.log(`WARN smoke tier took ${formatDuration(totalMs)}, over its ${formatDuration(smokeBudgetMs)} budget`);
}
if (failures.length > 0) process.exit(1);

console.log("DONE Maestro local E2E flows complete");
