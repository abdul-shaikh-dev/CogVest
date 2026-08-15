import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const defaultFlows = [
  "e2e/smoke-launch.yaml",
  "e2e/navigation.yaml",
  "e2e/add-trade.yaml",
  "e2e/add-holding-lookup.yaml",
  "e2e/add-holding-manual-semantics.yaml",
  "e2e/add-holding-pending-valuation.yaml",
  "e2e/add-holding-edited-quote.yaml",
  "e2e/add-holding-asset-switch.yaml",
  "e2e/quick-portfolio-setup.yaml",
  "e2e/holdings-csv-import.yaml",
  "e2e/holdings.yaml",
  "e2e/ppf-account.yaml",
  "e2e/opening-position-correction.yaml",
  "e2e/trade-correction.yaml",
  "e2e/asset-correction.yaml",
  "e2e/cash.yaml",
  "e2e/funded-buy-cash.yaml",
  "e2e/snapshot-review.yaml",
  "e2e/value-masking.yaml",
  "e2e/persistence.yaml",
];

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

const requestedFlows = process.argv.slice(2);
const flows = requestedFlows.length > 0 ? requestedFlows : defaultFlows;
const holdingsCsvFlow = "e2e/holdings-csv-import.yaml";
const holdingsCsvFixture = "e2e/fixtures/holdings-import-v1.csv";

for (const flow of flows) {
  if (!existsSync(flow)) {
    console.log(`FAIL flow not found: ${flow}`);
    process.exit(1);
  }
}

for (const flow of flows) {
  if (flow.replaceAll("\\", "/") === holdingsCsvFlow) {
    const adbPath = findExecutable("adb");
    if (!adbPath || !existsSync(holdingsCsvFixture)) {
      console.log("FAIL holdings CSV fixture or adb not found");
      process.exit(1);
    }
    const push = run(adbPath, [
      "push",
      holdingsCsvFixture,
      "/sdcard/Download/holdings-import-v1.csv",
    ]);
    if (push.status !== 0) {
      console.log("FAIL unable to copy the holdings CSV fixture to Android Downloads");
      process.exit(push.status ?? 1);
    }
    const scan = run(adbPath, [
      "shell",
      "am",
      "broadcast",
      "-a",
      "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
      "-d",
      "file:///sdcard/Download/holdings-import-v1.csv",
    ]);
    if (scan.status !== 0) {
      console.log("FAIL unable to register the holdings CSV fixture with Android");
      process.exit(scan.status ?? 1);
    }
  }
  console.log(`RUN maestro test ${flow}`);
  const outputArgs = process.env.MAESTRO_TEST_OUTPUT_DIR
    ? [`--test-output-dir=${process.env.MAESTRO_TEST_OUTPUT_DIR}`]
    : [];
  const result = run(maestroPath, ["test", flow, ...outputArgs]);
  if (result.status !== 0) {
    console.log(`FAIL Maestro flow failed: ${flow}`);
    process.exit(result.status ?? 1);
  }
}

console.log("DONE Maestro local E2E flows complete");
