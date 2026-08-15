# Quick Portfolio Setup Verification

## Purpose

This record proves the V1 Quick Portfolio Setup contract from issue #239 on a
fresh local Android build. It covers recoverability, persisted data, financial
derivation, accessibility semantics, and the required visual states.

## Verified Build

- Date: 2026-08-15
- Branch: `v1/issue-239-quick-setup-verification`
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- APK SHA-256: `2DCEB1DEA86D485CCF60D1394335CE3A65E45C22512BECA449B80143D19C928D`
- Package: `com.abdulshaikh.cogvest`
- Version: `1.0.1` (`versionCode` 2)
- Install time: `2026-08-15 18:34:58`
- Emulator: `emulator-5554` (`Pixel_10_Pro` in Maestro)
- Android: 16 / API 36, x86_64, 1280 x 2856

The previous package was uninstalled before installation. The first install
attempt was rejected because emulator storage was low; Android package caches
were trimmed and the same hashed APK then installed successfully.

## Commands

```powershell
npm run android:apk:emulator
adb -s emulator-5554 uninstall com.abdulshaikh.cogvest
adb -s emulator-5554 install android/app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 reverse tcp:8081 tcp:8081
$env:MAESTRO_TEST_OUTPUT_DIR='docs/testing/artifacts/quick-setup/latest'
npm run maestro:test -- e2e/quick-portfolio-setup.yaml
npm run test:v1:pc
```

## Results

- Focused Quick Setup Maestro journey: passed.
- Full V1 gate: 77 suites and 684 tests passed.
- Expo Doctor: 17/17 checks passed.
- Android doctor: `emulator-5554` and Maestro detected.
- Strict Android smoke: fresh CogVest package found.

Focused component and semantic-flow coverage also proved that unfinished input
is not persisted, duplicate aggregate positions update instead of duplicating,
transaction-history conflicts block destructive replacement, pending valuations
can later be resolved through explicit manual-price handling, masking remains
available, and setup actions expose button semantics with readable labels.

The Android journey proved:

- two searched assets required explicit result selection and retained provider
  identity, quote source, and quote value;
- each holding persisted before the next item began;
- app stop/relaunch restored two confirmed holdings without persisting an
  unfinished draft;
- a known purchase date stayed `2026-05-29`, while an explicit unknown date
  stayed unknown;
- provider failure preserved manual fallback and an honest pending valuation;
- one PPF account contributed `₹1,00,000.00` to Debt allocation without a
  synthetic asset;
- complete-state totals were `₹1,03,800.00` invested and `₹1,04,377.78`
  current, with Debt allocation at `95.81%`;
- final incomplete-state invested value was `₹1,04,400.00`, with one pending
  valuation, three assets, three opening positions, one PPF account, no trades,
  and zero canonical identity conflicts;
- final review contained four confirmed setup items and Dashboard represented
  valuation incompleteness rather than inventing a partial portfolio total.

Provider lookup and quote behavior used the development-gated Visual QA
fixtures. This makes the flow deterministic and proves provider success and
failure handling, but it is not evidence of live Yahoo Finance availability.

## Screenshots

- [Empty launch](artifacts/quick-setup/latest/screenshots/quick-setup-empty-launch.png)
- [Explicitly selected asset](artifacts/quick-setup/latest/screenshots/quick-setup-selected-asset.png)
- [Resumed setup](artifacts/quick-setup/latest/screenshots/quick-setup-resumed.png)
- [Explicit unknown date](artifacts/quick-setup/latest/screenshots/quick-setup-unknown-date.png)
- [Final aggregate review](artifacts/quick-setup/latest/screenshots/quick-setup-final-review.png)
- [Populated Dashboard](artifacts/quick-setup/latest/screenshots/quick-setup-populated-dashboard.png)

These screenshots are evidence, not design sources of truth. `DESIGN.md` and
`docs/design/v1-screen-baseline.md` remain the UI contracts.
