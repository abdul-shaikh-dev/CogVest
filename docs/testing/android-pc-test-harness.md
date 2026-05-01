# Android PC Test Harness

## Purpose

This harness verifies CogVest Android behavior from a PC without requiring a
physical Android phone. It covers static checks, Jest/React Native Testing
Library tests, Expo health checks, Android Emulator smoke checks, optional APK
install smoke tests, and optional Maestro E2E flows.

Default GitHub PR CI remains lightweight. Emulator, APK, and Maestro checks are
manual PC-only verification steps.

## Required Tools

- Android Studio
- Android SDK
- Android Emulator
- Android SDK Platform Tools (`adb`)
- Node.js and npm
- Expo CLI through `npx expo`
- Optional: Maestro

## Create an Emulator

1. Open Android Studio.
2. Open Device Manager.
3. Select Create Virtual Device.
4. Choose Pixel 7 or Pixel 8.
5. Choose an Android 14 or Android 15 x86_64 system image.
6. Finish setup and start the emulator.

## Verify adb

Run:

```powershell
adb devices
```

Expected ready emulator output includes a row like:

```text
emulator-5554    device
```

If `adb` is not found on Windows, add this folder to `PATH`:

```text
C:\Users\<username>\AppData\Local\Android\Sdk\platform-tools
```

## Normal Checks

Run:

```powershell
npm run test:verify
```

This runs:

```powershell
npm run typecheck
npm test
npm run doctor
```

## Android Harness Checks

Run:

```powershell
npm run android:doctor
npm run android:smoke
```

`android:doctor` checks Node, npm, adb, connected emulators, Expo CLI through
`npx`, required package scripts, and optional Maestro availability.

`android:smoke` checks adb, lists connected devices, and warns if the CogVest
Android package is not installed.

Strict installed-app smoke mode:

```powershell
npm run android:smoke -- --strict
```

## Start Expo on Android Emulator

Run:

```powershell
npm run start:clear
```

When Metro starts, press:

```text
a
```

Expo should open CogVest on the running Android Emulator.

## Local Native Build

Run:

```powershell
npm run android
```

Use this when a local native build is needed. For normal JavaScript and
TypeScript iteration, start Metro and press `a`.

## Install a Preview APK

APK files can be installed locally on an emulator:

```powershell
adb install -r path/to/app.apk
```

Uninstall CogVest:

```powershell
adb uninstall com.abdulshaikh.cogvest
```

APK versus AAB:

- APK is installable locally on an emulator.
- AAB is for Play Store distribution and is not directly installable for local emulator testing.

Do not trigger EAS cloud builds from this harness unless explicitly approved.

## Optional Maestro E2E

The `e2e/` folder contains optional Maestro flow drafts. If Maestro is not
installed, the harness should not fail.

Check Maestro:

```powershell
maestro --version
```

Run a flow after CogVest is installed on the emulator:

```powershell
maestro test e2e/smoke-launch.yaml
```

## Recommended Future testIDs

Several screen-level testIDs already exist, but robust form E2E flows need more
stable controls. Recommended follow-up testIDs:

- `dashboard-screen`
- `holdings-screen`
- `add-trade-screen`
- `add-trade-button`
- `asset-input`
- `quantity-input`
- `price-input`
- `conviction-1`
- `conviction-2`
- `conviction-3`
- `conviction-4`
- `conviction-5`
- `save-trade-button`
- `value-mask-toggle`

## Troubleshooting

### adb not found

Install Android SDK Platform Tools and add this folder to `PATH`:

```text
C:\Users\<username>\AppData\Local\Android\Sdk\platform-tools
```

Close and reopen PowerShell, then run `adb devices`.

### No emulator detected

Start an emulator from Android Studio Device Manager, then run:

```powershell
adb devices
```

### Emulator offline

Cold boot the emulator from Device Manager. If it remains offline, restart the
adb server:

```powershell
adb kill-server
adb start-server
adb devices
```

### Metro cache issues

Run:

```powershell
npm run start:clear
```

### Expo Router unmatched route

Confirm the app starts through Expo Router and lands on the dashboard tab. If an
Unmatched Route screen appears, capture the route shown on screen and the Metro
logs before changing app code.

### App opens blank screen

Check Metro logs and Android logs:

```powershell
adb logcat
```

Restart Metro with `npm run start:clear`.

### Port 8081 already in use

Stop the old Metro process or use a different terminal. On Windows, inspect
processes with:

```powershell
netstat -ano | findstr :8081
```
