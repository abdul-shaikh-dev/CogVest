import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const isRelease = process.argv.includes("--release");
const isE2e = process.argv.includes("--e2e");
// Inlined only into the e2e bundle; see docs/testing/e2e-build-variant.md.
const harnessFlag = "EXPO_PUBLIC_COGVEST_QA_HARNESS";
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
if (isRelease && isE2e) {
  console.error("FAIL Choose either --release or --e2e.");
  process.exit(1);
}

if (!isE2e && process.env[harnessFlag] !== undefined) {
  console.error(`FAIL ${harnessFlag} is set. Unset it, or use npm run android:e2e.`);
  process.exit(1);
}

const rootDir = process.cwd();
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const gradleCommand = path.resolve(
  rootDir,
  "android",
  process.platform === "win32" ? "gradlew.bat" : "gradlew",
);

function run(command, args, env = process.env) {
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
    env,
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

const variant = isRelease ? "release" : isE2e ? "e2e" : "debug";
const gradleTask = `assemble${variant[0].toUpperCase()}${variant.slice(1)}`;
const outputPath = `android/app/build/outputs/apk/${variant}/app-${variant}.apk`;
rmSync(path.resolve(rootDir, outputPath), { force: true });
console.log(`Building CogVest Android ${variant} APK...`);
run(gradleCommand, [
  "-p",
  "android",
  gradleTask,
  ...(architectures
    ? [`-PreactNativeArchitectures=${architectures}`]
    : []),
], isE2e ? { ...process.env, [harnessFlag]: "cogvest-qa-harness-on" } : process.env);

if (!existsSync(path.resolve(rootDir, outputPath))) {
  console.error(`FAIL Gradle completed without creating ${outputPath}`);
  process.exit(1);
}

console.log(`PASS APK created: ${outputPath}`);
