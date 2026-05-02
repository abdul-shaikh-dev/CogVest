import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const defaultFlows = [
  "e2e/smoke-launch.yaml",
  "e2e/add-trade.yaml",
  "e2e/holdings.yaml",
  "e2e/cash.yaml",
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

for (const flow of flows) {
  if (!existsSync(flow)) {
    console.log(`FAIL flow not found: ${flow}`);
    process.exit(1);
  }
}

for (const flow of flows) {
  console.log(`RUN maestro test ${flow}`);
  const result = run(maestroPath, ["test", flow]);
  if (result.status !== 0) {
    console.log(`FAIL Maestro flow failed: ${flow}`);
    process.exit(result.status ?? 1);
  }
}

console.log("DONE Maestro local E2E flows complete");
