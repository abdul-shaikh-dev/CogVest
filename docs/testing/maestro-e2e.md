# Maestro E2E On Android Emulator

## Purpose

Maestro runs black-box mobile E2E flows against the installed CogVest Android
app. It drives the Android Emulator like a user by launching the app, tapping
tabs, entering form values, saving records, and asserting stable `testID`s or
visible text.

Maestro is optional local tooling. It is not an app runtime dependency and is
not part of default GitHub PR CI.

## Prerequisites

- Java 17 or newer.
- `JAVA_HOME` points to the Java installation.
- Android Studio and a running Android Emulator.
- `adb devices` shows an emulator in `device` state.
- CogVest package `com.abdulshaikh.cogvest` is installed on the emulator.
- Maestro CLI is installed and available on `PATH`.

Official install docs:

- https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli
- https://docs.maestro.dev/getting-started/installing-maestro/

## Windows Install Notes

The official Maestro CLI docs support Windows. Use either:

- The official installer script from a shell with `curl`.
- The GitHub release `maestro.zip`, extracted to a stable location such as
  `C:\maestro`, with `C:\maestro\bin` added to `PATH`.

After installing, restart PowerShell and run:

```powershell
maestro --help
```

If Java is missing, install Java 17+ first and set `JAVA_HOME`.

## CogVest Commands

Check readiness:

```powershell
npm run maestro:check
```

Run the full local flow suite:

```powershell
npm run maestro:test
```

Run one flow:

```powershell
npm run maestro:test -- e2e/smoke-launch.yaml
```

## Flow Set

- `e2e/smoke-launch.yaml`: cold-launch and Dashboard smoke.
- `e2e/add-trade.yaml`: add a buy trade with stable form IDs.
- `e2e/holdings.yaml`: create a trade and verify Holdings.
- `e2e/cash.yaml`: add cash and verify Cash.
- `e2e/value-masking.yaml`: open Settings by deep link and toggle masking.
- `e2e/persistence.yaml`: create local data, close/reopen, and verify it remains.

## Expected Missing-Tool Behavior

If Maestro is not installed:

```text
FAIL maestro not found
Install guidance:
...
```

This is expected on machines that have not opted into Maestro. Default static
checks and Android smoke checks should still work.

## Troubleshooting

- `maestro not found`: add Maestro `bin` folder to `PATH`, restart PowerShell,
  and rerun `npm run maestro:check`.
- `java not found`: install Java 17+ and set `JAVA_HOME`.
- `no Android emulator/device`: start Pixel 8 from Android Studio and confirm
  `adb devices`.
- `app package not installed`: install a local APK with
  `adb install -r path/to/app.apk`.
- Flow cannot find a control: verify the app build includes the stable testIDs
  from issue #50 and rerun from a clean app state.
