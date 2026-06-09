import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const appId = "com.abdulshaikh.cogvest";
const artifactDir = join("docs", "testing", "artifacts", "visual-qa", "latest");
const visualQaToken = "cogvest-local-visual-qa";

function runAdb(args, options = {}) {
  const result = spawnSync("adb", args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 1024 * 1024 * 20,
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    const stdout = result.stdout?.toString().trim();
    throw new Error(stderr || stdout || `adb ${args.join(" ")} failed`);
  }

  return result.stdout;
}

function sleep(ms) {
  execFileSync(process.execPath, ["-e", `setTimeout(() => {}, ${ms})`]);
}

function ensureReady() {
  const devicesOutput = runAdb(["devices"]);
  const connectedDevice = devicesOutput
    .split(/\r?\n/u)
    .find((line) => /\tdevice$/u.test(line));

  if (!connectedDevice) {
    throw new Error("No Android emulator/device in `device` state.");
  }

  const packages = runAdb(["shell", "pm", "list", "packages", appId]);
  if (!packages.includes(appId)) {
    throw new Error(
      `CogVest package not installed. Run \`npm run android\` first.`,
    );
  }

  console.log(`PASS connected device: ${connectedDevice.split("\t")[0]}`);
  console.log(`PASS app package found: ${appId}`);
  runAdb(["reverse", "tcp:8081", "tcp:8081"]);
  console.log("PASS adb reverse configured: tcp:8081");
}

function openDeepLink(path) {
  const url = `cogvest:///${path}`;
  const shellSafeUrl = url.replaceAll("&", "\\&");
  console.log(`OPEN ${url}`);
  runAdb(["shell", "am", "force-stop", appId]);
  const result = spawnSync("adb", [
    "shell",
    "am",
    "start",
    "-W",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    shellSafeUrl,
  ], { stdio: "ignore" });
  if (result.status !== 0) {
    throw new Error(`Failed to open ${url}`);
  }
  sleep(1800);
}

function capture(name) {
  const outputPath = join(artifactDir, `${name}.png`);
  const png = execFileSync("adb", ["exec-out", "screencap", "-p"], {
    maxBuffer: 1024 * 1024 * 20,
  });
  writeFileSync(outputPath, png);
  console.log(`CAPTURE ${outputPath}`);
}

function dumpUi() {
  return runAdb(["exec-out", "uiautomator", "dump", "/dev/tty"]);
}

function hasUiMarker(xml, marker) {
  return xml.toLowerCase().includes(marker.toLowerCase());
}

function waitForUiMarkers(markers, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const startedAt = Date.now();
  let latestXml = "";

  while (Date.now() - startedAt < timeoutMs) {
    latestXml = dumpUi();

    if (latestXml.includes("Process system isn") || latestXml.includes("Close app")) {
      throw new Error("Android system ANR dialog is visible; visual QA capture is invalid.");
    }

    if (latestXml.includes("Unable to load script")) {
      throw new Error(
        "Android app cannot load the Metro bundle. Start Metro with `npm run start:clear`, rebuild/install the debug app with `npm run android` if needed, then rerun visual QA.",
      );
    }

    const missing = markers.filter((marker) => !hasUiMarker(latestXml, marker));
    if (missing.length === 0) {
      return latestXml;
    }

    sleep(500);
  }

  throw new Error(
    `Timed out waiting for UI markers: ${markers.join(", ")}`,
  );
}

function captureWhenReady(name, markers) {
  waitForUiMarkers(markers);
  capture(name);
}

function tapNodeContaining(needle, fallback) {
  const xml = dumpUi();
  const nodePattern = new RegExp(
    `<node[^>]*(?:text|content-desc|resource-id)="[^"]*${needle}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    "iu",
  );
  const match = xml.match(nodePattern);

  if (!match) {
    console.log(`WARNING UI node not found for ${needle}; using fallback tap`);
    runAdb(["shell", "input", "tap", String(fallback.x), String(fallback.y)]);
    return;
  }

  const [, left, top, right, bottom] = match.map(Number);
  const x = Math.round((left + right) / 2);
  const y = Math.round((top + bottom) / 2);
  runAdb(["shell", "input", "tap", String(x), String(y)]);
}

function typeText(text) {
  runAdb(["shell", "input", "text", text.replaceAll(" ", "%s")]);
}

function scrollDown() {
  runAdb(["shell", "input", "swipe", "540", "1850", "540", "850", "650"]);
  sleep(900);
}

function prepareArtifactDir() {
  if (existsSync(artifactDir)) {
    rmSync(artifactDir, { force: true, recursive: true });
  }
  mkdirSync(artifactDir, { recursive: true });
}

try {
  ensureReady();

  openDeepLink(`visual-qa-seed?token=${visualQaToken}`);
  waitForUiMarkers(["Visual QA portfolio seeded."], { timeoutMs: 25000 });
  prepareArtifactDir();
  openDeepLink("dashboard");
  captureWhenReady("dashboard", ["Dashboard", "Portfolio value"]);

  openDeepLink("holdings");
  captureWhenReady("holdings", ["Holdings", "HDFC Bank"]);

  openDeepLink("add-holding");
  captureWhenReady("add-holding-initial", ["Add Holding", "Search asset"]);

  openDeepLink(`add-holding?visualQaState=lookup&token=${visualQaToken}`);
  waitForUiMarkers(["Add Holding", "Search asset"]);
  tapNodeContaining("asset-lookup-input", { x: 260, y: 360 });
  typeText("HDFC");
  runAdb(["shell", "input", "keyevent", "111"]);
  captureWhenReady("add-holding-lookup", ["HDFC Bank", "HDFCBANK.NS"]);

  openDeepLink(`add-holding?visualQaState=review&token=${visualQaToken}`);
  captureWhenReady("add-holding-review", ["Add Holding", "Derived preview"]);

  openDeepLink("cash");
  captureWhenReady("cash", ["Cash Ledger", "Cash balance"]);

  openDeepLink("progress");
  captureWhenReady("progress", ["Monthly Progress", "Value Trend"]);
  scrollDown();
  captureWhenReady("progress-assets-chart", ["Asset Trend", "Equity", "Debt", "Crypto"]);

  openDeepLink("settings");
  captureWhenReady("settings", ["Settings", "Local-first controls"]);

  console.log("DONE Android seeded visual QA screenshots captured");
} catch (error) {
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
