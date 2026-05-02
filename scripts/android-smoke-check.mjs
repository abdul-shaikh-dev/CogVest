import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const packageName = "com.abdulshaikh.cogvest";
const strict = process.argv.includes("--strict");
let hardFailure = false;

function run(command, args = []) {
  return spawnSync(command, args, {
    encoding: "utf8",
  });
}

function candidateNames(command) {
  if (process.platform !== "win32") {
    return [command];
  }

  return [`${command}.exe`, `${command}.cmd`, `${command}.bat`, command];
}

function findExecutable(command) {
  const pathValue = process.env.PATH ?? "";
  for (const directory of pathValue.split(process.platform === "win32" ? ";" : ":")) {
    for (const candidate of candidateNames(command)) {
      const fullPath = join(directory, candidate);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.log(`FAIL ${message}`);
  hardFailure = true;
}

function warning(message) {
  console.log(`WARNING ${message}`);
}

function parseAdbDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, state] = line.split(/\s+/);
      return { id, state };
    });
}

const adbPath = findExecutable("adb");
if (!adbPath) {
  const message = "adb not found. Install Android SDK Platform Tools and add platform-tools to PATH.";
  if (strict) {
    fail(message);
  } else {
    warning(message);
  }
  console.log("DONE Android smoke check complete");
  process.exit(strict ? 1 : 0);
}

pass("adb found");

const devicesResult = run(adbPath, ["devices"]);
if (devicesResult.status !== 0) {
  const details = `${devicesResult.stderr ?? devicesResult.stdout ?? devicesResult.error?.message ?? ""}`.trim();
  if (strict) {
    fail("adb devices could not run in this shell");
  } else {
    warning("adb devices could not run in this shell");
  }
  if (details) {
    warning(details);
  }
  console.log("DONE Android smoke check complete");
  process.exit(strict ? 1 : 0);
}

console.log(devicesResult.stdout.trim());

const devices = parseAdbDevices(devicesResult.stdout);
const readyDevices = devices.filter((device) => device.state === "device");

if (readyDevices.length === 0) {
  const message = "no emulator/device in device state";
  if (strict) {
    fail(message);
  } else {
    warning(message);
  }
  console.log("DONE Android smoke check complete");
  process.exit(strict && hardFailure ? 1 : 0);
}

readyDevices.forEach((device) => pass(`connected device: ${device.id}`));

const firstDevice = readyDevices[0].id;
const packageResult = run(adbPath, [
  "-s",
  firstDevice,
  "shell",
  "pm",
  "list",
  "packages",
  packageName,
]);

if (packageResult.status !== 0) {
  if (strict) {
    fail(`could not query package ${packageName}`);
  } else {
    warning(`could not query package ${packageName}`);
  }
} else if (packageResult.stdout.includes(`package:${packageName}`)) {
  pass(`app package found: ${packageName}`);
} else if (strict) {
  fail(`app package not installed: ${packageName}`);
  console.log("Install an APK with: adb install -r path/to/app.apk");
} else {
  warning(`app package not installed: ${packageName}`);
  console.log("Install an APK with: adb install -r path/to/app.apk");
}

console.log("DONE Android smoke check complete");
process.exit(strict && hardFailure ? 1 : 0);
