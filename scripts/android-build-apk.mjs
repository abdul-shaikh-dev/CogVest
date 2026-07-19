import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const isRelease = process.argv.includes("--release");
const architectureArg = process.argv.find((argument) =>
  argument.startsWith("--architecture="),
);
const architectures = architectureArg?.slice("--architecture=".length);

if (
  architectures &&
  !/^(armeabi-v7a|arm64-v8a|x86|x86_64)(,(armeabi-v7a|arm64-v8a|x86|x86_64))*$/u.test(
    architectures,
  )
) {
  console.error("FAIL Unsupported Android architecture list.");
  process.exit(1);
}
const rootDir = process.cwd();
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const gradleCommand = path.resolve(
  rootDir,
  "android",
  process.platform === "win32" ? "gradlew.bat" : "gradlew",
);

function run(command, args) {
  const executable =
    process.platform === "win32"
      ? (process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe")
      : command;
  const commandArgs =
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          `call ${[command, ...args]
            .map((value) =>
              /[\s&|<>^]/u.test(value)
                ? `"${value.replaceAll('"', '""')}"`
                : value,
            )
            .join(" ")}`,
        ]
      : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`FAIL ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Applying durable Expo Android configuration...");
run(npxCommand, ["expo", "prebuild", "--platform", "android", "--no-install"]);

const gradleTask = isRelease ? "assembleRelease" : "assembleDebug";
const outputPath = isRelease
  ? "android/app/build/outputs/apk/release/app-release.apk"
  : "android/app/build/outputs/apk/debug/app-debug.apk";
rmSync(path.resolve(rootDir, outputPath), { force: true });
console.log(`Building CogVest Android ${isRelease ? "release" : "debug"} APK...`);
run(gradleCommand, [
  "-p",
  "android",
  gradleTask,
  ...(architectures
    ? [`-PreactNativeArchitectures=${architectures}`]
    : []),
]);

if (!existsSync(path.resolve(rootDir, outputPath))) {
  console.error(`FAIL Gradle completed without creating ${outputPath}`);
  process.exit(1);
}

console.log(`PASS APK created: ${outputPath}`);
