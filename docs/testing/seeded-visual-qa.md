# Seeded Android Visual QA

## Purpose

This harness seeds a deterministic V1 portfolio on the Android Emulator and
captures screenshots for screen-to-mock comparison against:

- `docs/design/v1-screen-baseline.md`
- `docs/design/v1-research-preview/index.html`

It is local-only. It does not require a physical phone, EAS cloud builds, or
default GitHub Actions.

## Prerequisites

- Android Emulator running and visible in `adb devices`.
- CogVest local Android build installed with either:

```powershell
npm run android
```

or a local release APK installed with `adb install -r`.

The seed route is hidden and only writes data in development builds. For a
local release APK visual QA run, build with `EXPO_PUBLIC_COGVEST_VISUAL_QA=1`
and use the local visual QA token supplied by `npm run visual-qa:android`.

## Run

```powershell
npm run visual-qa:android
```

Output is written to:

```text
docs/testing/artifacts/visual-qa/latest
```

Expected screenshots:

- `dashboard.png`
- `holdings.png`
- `add-holding-initial.png`
- `add-holding-lookup.png`
- `add-holding-review.png`
- `cash.png`
- `progress.png`
- `progress-assets-chart.png`
- `settings.png`

## Manual Bundled APK Flow

Use this flow when you specifically need to populate and inspect seeded visual
QA data on an installed emulator APK without depending on Metro. This is useful
for chart review because release-style bundles load their JavaScript from the
APK instead of requiring a running dev server.

### 1. Confirm Emulator

```powershell
adb devices
```

Expected:

```text
emulator-5554    device
```

### 2. Build a Seed-Enabled Release APK

The seed route only works in release-style builds when the JavaScript bundle was
built with `EXPO_PUBLIC_COGVEST_VISUAL_QA=1`.

If the normal Gradle command works on the machine, use:

```powershell
$env:EXPO_PUBLIC_COGVEST_VISUAL_QA = "1"
$env:NODE_ENV = "production"
.\android\gradlew.bat -p android app:assembleRelease -x lint -x test `
  --configure-on-demand --build-cache `
  -PreactNativeDevServerPort=8081 `
  "-PreactNativeArchitectures=x86_64" `
  --console=plain
```

If Gradle or Kotlin tries to write outside the workspace and fails with access
errors, redirect temp/cache paths into ignored workspace folders and disable the
Kotlin daemon:

```powershell
New-Item -ItemType Directory -Force ".expo\tmp", ".expo\localappdata", ".expo\kotlin-home" | Out-Null

$jdk17 = "G:\tmp\gradle-cogvest\jdks\eclipse_adoptium-17-amd64-windows.2"
$workspace = (Get-Location).Path

$env:JAVA_HOME = $jdk17
$env:PATH = "$jdk17\bin;$env:PATH"
$env:GRADLE_USER_HOME = "$workspace\.g"
$env:TEMP = "$workspace\.expo\tmp"
$env:TMP = "$workspace\.expo\tmp"
$env:LOCALAPPDATA = "$workspace\.expo\localappdata"
$env:KOTLIN_USER_HOME = "$workspace\.expo\kotlin-home"
$env:EXPO_PUBLIC_COGVEST_VISUAL_QA = "1"
$env:NODE_ENV = "production"

.\android\gradlew.bat -p android app:assembleRelease -x lint -x test `
  --no-daemon --configure-on-demand --build-cache `
  "-Dkotlin.compiler.execution.strategy=in-process" `
  "-Dkotlin.daemon.enabled=false" `
  "-Dorg.gradle.java.installations.paths=$jdk17" `
  "-Dorg.gradle.java.installations.auto-download=false" `
  -PreactNativeDevServerPort=8081 `
  "-PreactNativeArchitectures=x86_64" `
  --console=plain
```

Expected output includes:

```text
> Task :app:createBundleReleaseJsAndAssets
Android Bundled ... index.ts
> Task :app:assembleRelease
BUILD SUCCESSFUL
```

The APK is written to:

```text
android/app/build/outputs/apk/release/app-release.apk
```

### 3. Install the APK

If a debug build is currently installed, uninstall first to avoid Android
signature mismatch errors:

```powershell
adb -s emulator-5554 uninstall com.abdulshaikh.cogvest
adb -s emulator-5554 install -r android\app\build\outputs\apk\release\app-release.apk
```

### 4. Seed the Visual QA Portfolio

```powershell
adb -s emulator-5554 shell am start -W `
  -a android.intent.action.VIEW `
  -d "cogvest:///visual-qa-seed?token=cogvest-local-visual-qa"
```

Verify the route succeeded:

```powershell
adb -s emulator-5554 shell uiautomator dump /sdcard/window.xml
adb -s emulator-5554 shell cat /sdcard/window.xml
```

Expected text:

```text
Visual QA portfolio seeded.
```

If the screen says visual QA seeding is unavailable, the APK was not bundled
with `EXPO_PUBLIC_COGVEST_VISUAL_QA=1`. Rebuild the APK with that environment
variable set before Gradle runs `createBundleReleaseJsAndAssets`.

### 5. Open Progress and Capture Chart Evidence

```powershell
adb -s emulator-5554 shell am start -W `
  -a android.intent.action.VIEW `
  -d "cogvest:///progress"

Start-Sleep -Seconds 3

adb -s emulator-5554 exec-out screencap -p > .expo\progress-charts-seeded.png
```

Scroll down and capture the asset chart:

```powershell
adb -s emulator-5554 shell input swipe 640 2350 640 1100 600
Start-Sleep -Seconds 1
adb -s emulator-5554 exec-out screencap -p > .expo\progress-asset-trend-seeded.png
```

Expected Progress evidence:

- Value Gap chart renders Portfolio vs Invested.
- Value Gap has y-axis INR labels, sparse chart-native x-axis month labels
  similar to the research preview (`Dec`, `Mar`, `May` for the seeded 6M
  window), and chart-local `3M`, `6M`, `1Y`, `All` chips.
- Asset Momentum chart renders Equity, Debt, and Crypto lines with cash excluded.
- Asset Momentum has y-axis INR labels, sparse chart-native x-axis month labels,
  chart-local timeframe chips, a legend, and per-asset insight rows.
- Seeded Progress defaults to the `6M` range while keeping `All` available.
- Seeded chart data should stay calm and preview-like: latest Progress values
  should be around Portfolio `₹19.87L`, Monthly gain `+₹58K`, Monthly
  investment `₹45K`, Value move `+₹13K`, Value Gap around `+15.5%`, and Asset
  Momentum led by Equity around `+4.9%`.

### 6. Clean Local Build Cache

The `.g/` Gradle home is only a local cache. It must not be committed.

```powershell
$target = [System.IO.Path]::GetFullPath(".g")
$workspace = [System.IO.Path]::GetFullPath(".")
if ($target.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $target)) {
  Remove-Item -LiteralPath $target -Recurse -Force
}

git status --short
```

Expected:

```text
# no .g/ entry
```

## Seeded Dataset

The visual QA seed includes:

- Equity: HDFC Bank
- ETF: Nifty 50 ETF
- Debt: Sovereign Gold Bond
- Crypto: Bitcoin
- Cash ledger additions and withdrawals
- Yahoo, CoinGecko, and manual quote metadata
- Optional conviction on one opening position
- Seven monthly snapshots so Progress defaults to the latest `6M` range while
  still allowing the `All` range

## Compare

Open the latest screenshots beside the HTML preview and V1 screen baseline.
Check:

- Dashboard hierarchy and density
- Holdings populated row layout
- Add Holding initial, lookup selection, and review states
- Cash Ledger hero, metrics, entry form, and ledger rows
- Monthly Progress `Value Gap` and `Asset Momentum` charts
- Settings local-first trust sections

Log any mismatch as a focused GitHub issue with screenshot evidence.

## Safety

The route `cogvest:///visual-qa-seed` only seeds data when `__DEV__` is true or
when `EXPO_PUBLIC_COGVEST_VISUAL_QA=1` was set at build time and the local
visual QA token is provided by the harness script. Do not link this route from
the UI. Do not add this command to default PR CI. Do not ship Play Store builds
with `EXPO_PUBLIC_COGVEST_VISUAL_QA=1`.

## Troubleshooting Notes

### Debug APK Shows "Unable to Load Script"

A debug APK usually expects Metro. If Metro is not running, Android shows a
React Native redbox:

```text
Unable to load script.
Make sure you're running Metro or that your bundle index.android.bundle is packaged correctly.
```

For quick visual QA, prefer the bundled release APK flow above. If you really
need the debug APK path, run:

```powershell
adb -s emulator-5554 reverse tcp:8081 tcp:8081
$env:EXPO_PUBLIC_COGVEST_VISUAL_QA = "1"
npm run start:clear
```

Then reload the app and open the seed route.

### Background Metro Starts but Port 8081 Is Closed

Hidden `Start-Process` attempts can exit silently because of quoting or process
lifetime issues. Verify Metro before relying on it:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8081/status
```

If it refuses the connection, do not assume the app is broken. Either run Metro
in the foreground or use the bundled release APK flow.

### Kotlin Daemon Access Denied

If the build fails with an error like:

```text
java.nio.file.AccessDeniedException:
C:\Users\<user>\AppData\Local\kotlin\daemon\...
Could not connect to Kotlin compile daemon
```

Use the fallback build command above with:

- workspace-local `TEMP`, `TMP`, `LOCALAPPDATA`, and `KOTLIN_USER_HOME`
- `--no-daemon`
- `-Dkotlin.compiler.execution.strategy=in-process`
- `-Dkotlin.daemon.enabled=false`

PowerShell treats dotted `-D...` arguments strangely unless they are quoted.
Always quote those Gradle system properties.

### Signature Mismatch on Install

If `adb install -r` fails because the installed APK has a different signature,
uninstall first:

```powershell
adb -s emulator-5554 uninstall com.abdulshaikh.cogvest
adb -s emulator-5554 install -r android\app\build\outputs\apk\release\app-release.apk
```

This clears local app data, which is acceptable for seeded visual QA because
the next step repopulates deterministic test data.
