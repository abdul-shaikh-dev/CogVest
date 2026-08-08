# V1 PC Verification Checklist

Use this checklist before marking V1 core flows verified. It requires an
Android Emulator, not a physical Android phone.

## Static And Unit Gate

- [x] `npm install` has completed successfully.
- [x] `npm run test:v1:pc` passes.
- [x] `npm run doctor` reports 17/17 checks passing.
- [x] `npm run android:doctor` reports adb and emulator readiness.
- [x] `npm run android:smoke -- --strict` finds `com.abdulshaikh.cogvest`.
- [x] `docs/testing/excel-parity-checklist.md` is completed or every failed row has a linked defect.

## Local APK Gate

- [x] Local APK is built on this PC, not through EAS cloud build.
- [x] APK is installed on the emulator with `adb install -r path/to/app.apk`.
- [x] App cold-launches from launcher or `.MainActivity`.
- [x] Dashboard opens, not Unmatched Route.
- [x] App closes and reopens without losing local data.

## Core Flow Gate

- [x] Dashboard shows portfolio value and bottom tabs.
- [x] Add Holding can save an opening/buy entry.
- [x] Holdings reflect the saved trade.
- [x] Invalid trade data shows validation errors.
- [x] Cash can be added.
- [x] Cash balance appears on Dashboard.
- [x] Monthly Progress automatically generates the missing previous completed month snapshot after portfolio data exists.
- [x] Monthly Progress shows compact `Month-end snapshot` status by default.
- [x] `Review snapshot` opens the dedicated `Review Snapshot` screen for correction/manual override.
- [x] Monthly Progress shows monthly gain, gain %, monthly investment, savings rate where derivable, and asset split.
- [x] Value masking can be toggled from Settings.
- [x] Masked state hides wealth values but not quantities or percentages.
- [x] Quote refresh or fallback state is visible where holdings exist.
- [x] No backend, auth, analytics, cloud sync, or push notifications are added.

## Optional Maestro Gate

- [x] `npm run maestro:check` works, or unavailable status is recorded.
- [x] `npm run maestro:test` passes.

## Evidence

### 2026-08-08 Final Verification Run

- Branch: `v1/issue-136-final-verification` at baseline `f52c153`.
- Emulator: `emulator-5554`; package `com.abdulshaikh.cogvest`.
- Fresh local debug APK built and installed with `adb install -r`.
- Upgrade retention passed: `mmkv.default` and its CRC file had identical
  SHA-256 hashes before and after installation; the seeded cash record remained
  visible after restart.
- Full canonical `npm run maestro:test` passed all 15 flows, including semantic
  Add Holding stored-outcome assertions.
- `npm run test:v1:pc` passed: 67 suites, 581 tests, Expo Doctor 17/17,
  Android readiness, and strict installed-package smoke.
- The capture harness keeps one app process, resets Add Holding between fixture
  states, rejects any visible LogBox warning, and uses an unsaved deterministic
  lookup result for selection-state evidence.
- `npm run visual-qa:android` passed and all nine canonical screenshots were
  reviewed. Add Holding lookup/review begin at the intended viewport, and both
  Progress chart captures are complete and warning-free. Progress shows the
  deterministic seven-snapshot fixture; persisted historical quotes and
  month-end automation cannot contaminate the visual QA session.

```text
Date: 2026-08-08
Branch/commit: v1/issue-136-final-verification / baseline f52c153
Emulator: emulator-5554
Android version: Android 16
APK source: android/app/build/outputs/apk/debug/app-debug.apk
Installed package: com.abdulshaikh.cogvest
Commands run: npm run test:v1:pc; npm run maestro:test; npm run visual-qa:android
Excel parity checklist: passed through automated, semantic E2E, and seeded visual evidence
Maestro status: 15 flows passed
Result: PASS - V1 developer gate complete
Defects logged: none remaining; first visual capture was rejected and recaptured cleanly
```
