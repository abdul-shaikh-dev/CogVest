import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const packageName = "com.abdulshaikh.cogvest";
let hardFailure = false;

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

function printInstallGuidance() {
  console.log("Install guidance:");
  console.log("- Install Java 17+ and set JAVA_HOME.");
  console.log("- Windows option 1: run the official Maestro installer script from a shell with curl.");
  console.log("- Windows option 2: download maestro.zip from Maestro releases, extract to C:\\maestro, and add C:\\maestro\\bin to PATH.");
  console.log("- Restart PowerShell, then run: maestro --help");
  console.log("- Official docs: https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli");
}

const javaPath = findExecutable("java");
if (!javaPath) {
  fail("java not found");
  warning("Maestro CLI requires Java 17 or newer.");
} else {
  const javaResult = run(javaPath, ["-version"]);
  const versionOutput = `${javaResult.stderr ?? ""}${javaResult.stdout ?? ""}`.trim();
  if (javaResult.status === 0) {
    pass("java found");
    console.log(versionOutput.split(/\r?\n/)[0]);
  } else {
    fail("java -version failed");
    if (versionOutput) {
      warning(versionOutput);
    }
  }
}

const adbPath = findExecutable("adb");
if (!adbPath) {
  fail("adb not found");
} else {
  pass("adb found");
  const devicesResult = run(adbPath, ["devices"]);
  if (devicesResult.status !== 0) {
    fail("adb devices could not run");
  } else {
    const readyDevices = parseAdbDevices(devicesResult.stdout).filter(
      (device) => device.state === "device",
    );
    if (readyDevices.length === 0) {
      fail("no Android emulator/device in device state");
    } else {
      readyDevices.forEach((device) => pass(`connected device: ${device.id}`));
    }
  }
}

const maestroPath = findExecutable("maestro");
if (!maestroPath) {
  fail("maestro not found");
  printInstallGuidance();
} else {
  const maestroResult = run(maestroPath, ["--version"]);
  if (maestroResult.status === 0) {
    pass(`maestro found: ${maestroResult.stdout.trim()}`);
  } else {
    fail("maestro --version failed");
    const details = `${maestroResult.stderr ?? maestroResult.stdout ?? ""}`.trim();
    if (details) {
      warning(details);
    }
  }
}

if (adbPath) {
  const devicesResult = run(adbPath, ["devices"]);
  const readyDevice = parseAdbDevices(devicesResult.stdout).find(
    (device) => device.state === "device",
  );

  if (readyDevice) {
    const packageResult = run(adbPath, [
      "-s",
      readyDevice.id,
      "shell",
      "pm",
      "list",
      "packages",
      packageName,
    ]);

    if (packageResult.stdout.includes(`package:${packageName}`)) {
      pass(`app package found: ${packageName}`);
    } else {
      fail(`app package not installed: ${packageName}`);
      console.log("Install an APK with: adb install -r path/to/app.apk");
    }
  }
}

console.log("DONE Maestro local E2E readiness check complete");
process.exit(hardFailure ? 1 : 0);
