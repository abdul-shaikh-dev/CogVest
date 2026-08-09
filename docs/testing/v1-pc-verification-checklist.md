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

### 2026-08-09 Android UI Hardening Verification (#222)

- Branch: `v1/issue-222-final-android-qa` at baseline `927a58d`.
- Emulator: `emulator-5554`, Android 16; package
  `com.abdulshaikh.cogvest`.
- A fresh local x86_64 debug APK was built, installed, and verified. APK
  SHA-256: `D0EB24C0F189DE4ADABBDD6D1EC973B0D1742FCC0AC32F8366F7578F58F4DBCB`.
- `npm run visual-qa:android` passed at font scales `1.0`, `1.3`, and `1.5`.
  All nine normal-scale artifacts were refreshed. Dashboard, Holdings, Add
  Holding, Cash, Progress, and Settings were inspected at the larger scales.
- At font scale `2.0`, navigation, Add Holding save, Cash add/review/delete,
  and snapshot review/cancel completed through adaptive wrapping and scrolling.
- Android accessibility hierarchy inspection confirmed clean bottom-tab labels,
  selected-tab state, and labelled Dashboard icon actions. Holding rows expose
  expanded/collapsed state in React Native and tests; device hierarchy confirmed
  the expanded details appear only after disclosure.
- One genuine adaptive-layout defect was fixed: Dashboard's Allocation heading
  and action now stack instead of overlapping at increased font scales.
- The visual-QA harness now waits on current Holdings and Add Holding contracts.
  Canonical correction/accounting flows no longer expect the opening-position
  manual-entry toggle on the internal buy/sell route.
- All 16 registered Maestro journeys passed. Outcome assertions covered saved
  holdings, cash accounting and deletion, correction persistence, value masking,
  snapshot review exit, and app-process persistence.
- `npm run test:v1:pc` passed: 67 suites, 583 tests, Expo Doctor 17/17,
  Android readiness, and strict installed-package smoke.
- A transient Metro-connect LogBox during one capture was rejected; adb reverse
  was restored and the clean capture rerun passed. Initial APK installation also
  required Android's external install-location option because emulator data
  storage was low; neither condition was an app defect.

```text
Date: 2026-08-09
Branch/commit: v1/issue-222-final-android-qa / baseline 927a58d
Emulator: emulator-5554
Android version: Android 16
APK source: android/app/build/outputs/apk/debug/app-debug.apk
APK SHA-256: D0EB24C0F189DE4ADABBDD6D1EC973B0D1742FCC0AC32F8366F7578F58F4DBCB
Installed package: com.abdulshaikh.cogvest
Commands run: npm run visual-qa:android at 1.0/1.3/1.5; focused Maestro at 2.0; npm run maestro:test; npm run test:v1:pc
Maestro status: 16 flows passed
Result: PASS - issue #222 final Android UI verification complete
Defects fixed: Dashboard font-scale overlap and stale Android QA selectors
```
