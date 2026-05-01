import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const requiredScripts = [
  "typecheck",
  "test",
  "doctor",
  "start",
  "start:clear",
  "android",
  "android:doctor",
  "android:smoke",
  "test:verify",
];

function run(command, args = []) {
  return spawnSync(command, args, {
    encoding: "utf8",
  });
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.log(`FAIL ${message}`);
}

function warning(message) {
  console.log(`WARNING ${message}`);
}

function candidateNames(command) {
  if (process.platform !== "win32") {
    return [command];
  }

  if (/\.(exe|cmd|bat)$/i.test(command)) {
    return [command];
  }

  return [`${command}.exe`, `${command}.cmd`, `${command}.bat`, command];
}

function findExecutable(command) {
  if (command.includes("\\") || command.includes("/")) {
    return existsSync(command) ? command : null;
  }

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

function checkExecutable(name, label = name) {
  const executable = findExecutable(name);
  if (executable) {
    pass(`${label} found`);
    return executable;
  }

  fail(`${label} not found`);
  return null;
}

const nodeOk = existsSync(process.execPath);
if (nodeOk) {
  pass(`node found: ${process.version}`);
} else {
  fail("node not found");
}

const npmPath = checkExecutable("npm");
const npxPath = checkExecutable("npx");
const adbPath = checkExecutable("adb");

if (!adbPath) {
  const sdkPath = join(homedir(), "AppData", "Local", "Android", "Sdk", "platform-tools");
  warning(`adb was not found. On Windows, check this SDK path: ${sdkPath}`);
}

if (adbPath) {
  const devicesResult = run(adbPath, ["devices"]);
  if (devicesResult.status !== 0) {
    warning("adb devices could not run in this shell");
    const details = `${devicesResult.stderr || devicesResult.stdout}`.trim();
    if (details) {
      warning(details);
    }
  } else {
    const devices = parseAdbDevices(devicesResult.stdout);
    const ready = devices.filter((device) => device.state === "device");
    if (ready.length > 0) {
      ready.forEach((device) => pass(`emulator detected: ${device.id}`));
    } else if (devices.length > 0) {
      warning(`adb found devices, but none are ready: ${devices.map((device) => `${device.id}:${device.state}`).join(", ")}`);
    } else {
      warning("adb devices returned no connected emulators/devices");
    }
  }
}

if (npxPath && existsSync(join("node_modules", ".bin", process.platform === "win32" ? "expo.cmd" : "expo"))) {
  pass("Expo CLI can be invoked through npx");
} else {
  fail("Expo CLI could not be invoked through npx");
}

if (existsSync("package.json")) {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const scripts = packageJson.scripts ?? {};
  for (const scriptName of requiredScripts) {
    if (scripts[scriptName]) {
      pass(`package script: ${scriptName}`);
    } else {
      fail(`package script missing: ${scriptName}`);
    }
  }
} else {
  fail("package.json not found");
}

if (findExecutable("maestro")) {
  pass("Maestro found");
} else {
  warning("Maestro not found");
}

if (!nodeOk || !npmPath) {
  warning("Node/npm must be fixed before Expo Android testing can run.");
}

console.log("DONE Android PC test harness check complete");
