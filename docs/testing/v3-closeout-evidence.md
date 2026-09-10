# V3 Verification Evidence

Recorded 10 September 2026 for #138. This is a partial closeout, not a claim that
all V3 performance or preservation gates have passed.

## Correctness And Scale Diagnostic

`src/testing/v3ScaleFixture.ts` creates 250 assets, 250 opening positions,
1,000 transactions, 60 monthly snapshots, and ten linked daily histories with
3,653 observations each (2016-01-01 through 2025-12-31). It never seeds the app or
writes production storage. Monthly snapshots are synthetic aggregate records,
not reconstructed valuations of the fixture's trades.

Tests validate the backup payload shape, asset/history linkage, chronological
snapshots and their component totals, remaining units, finite recorded gains,
monthly chart transformation, and history sampling bounded to 500 points per
asset. They supplement, not replace, the focused financial correctness suites.

Reproduce the opt-in PC diagnostic in PowerShell:

```powershell
$env:COGVEST_V3_BENCHMARK = '1'
npm test -- src/testing/__tests__/v3ScaleFixture.test.ts
Remove-Item Env:COGVEST_V3_BENCHMARK
```

Raw Windows/Node 24.11.1 Jest measurements, milliseconds:

| Run | Holdings | Recorded sale gains | Monthly transform | Ten histories + sampling |
| --- | ---: | ---: | ---: | ---: |
| 1 | 27 | 14 | 12 | 60 |
| 2 | 23 | 14 | 15 | 58 |
| 3 | 36 | 13 | 11 | 63 |

Each run produced 250 holdings, 500 sale results, 60 chart months and 5,000
sampled history points. These are non-isolated PC diagnostic measurements,
excluding fixture creation, storage, React rendering and native chart work.
They are not Android latency, frame-time or JS-stall acceptance evidence.

## Fresh Standalone Upgrade Smoke

- Production source: `473d2df`, merged PR #318. This verification branch changes
  only test fixtures, opt-in E2E and documentation.
- Build: `npm run android:apk:release -- --architecture=x86_64` using the existing
  owner-controlled local QA signing identity. No EAS build or Play submission.
- Artifact: `android/app/build/outputs/apk/release/app-release.apk`, version
  1.0.1/code 2. Emulator-only QA artifact, not a phone or store release build.
- SHA-256: `403FDFFE083E8003C3F5F5CED7232699EE87F4B438CD4338199DBB67F59C7618`.
- Environment: `emulator-5554`, Android 16/API 36, x86_64, 1280x2856,
  density 480, font scale 1.0. Device model is not an acceptance requirement.
- Signature verification passed; `adb install -r` succeeded without uninstall,
  reset or reseeding. The release package is non-debuggable (`run-as` refused).
- Metro port forwarding was removed. Metro itself need not be stopped: this
  standalone release uses its bundled JavaScript.

Run `npm run maestro:test -- e2e/standalone/v3-preservation.yaml` on the existing
standard synthetic portfolio before and after the external upgrade installation.
Do not run this fixture-specific flow against a private portfolio or reset data
to make it pass.

Both runs passed. Post-upgrade output records all 30 commands completed in local
Maestro run `2026-09-10_215906`. The sampled HDFC holding retained 25 units,
average cost INR 1,450, invested basis INR 36,250 and date 15 April 2024.
Dashboard, Holdings, holding details, Progress, Cash and Settings opened;
the invested basis remained visible after stop/relaunch. The captured holding
detail screenshot was visually inspected: labels and retained values were
readable, with the historical-price controls present.

This is sampled UI preservation evidence, not complete before/after payload
equality. The flow does not install an APK itself, compare every transaction or
snapshot, or measure navigation/scrolling performance. Current quote values can
change independently of the preserved raw holding records.

The merged release manifest retains package identity, disables Android backup,
and references all-domain backup/data-transfer exclusions. Permissions are
INTERNET, VIBRATE and the app-specific non-exported receiver permission; no
overlay or broad storage permission is present. Optional Play automation's
manual authorization and secret-handling requirements are documented in
`docs/release/android-release-process.md`; no automation was enabled.

## Verification Results

`npm run test:v1:pc` passed:

- Typecheck passed.
- Jest: 1,257 tests passed across 128 suites; one existing test/suite skipped.
- Expo Doctor: 17/17 checks passed.
- Android Doctor: emulator, adb, Expo and Maestro detected.
- Strict Android smoke: `com.abdulshaikh.cogvest` installed.

## Remaining Gates

- The combined scale fixture has not been installed/measured on Android.
  Cold Dashboard <=3s, cached revisit <=1s, and list/chart JS stalls <=500ms
  remain unproven. No smoothness conclusion follows from this smoke run.
- #299's native-control/measurement-validity investigation remains parked; this
  pass did not resume or duplicate it.
- Full persisted-portfolio comparison across upgrade remains unverified; only
  the selected holding and navigation/restart assertions above were checked.
- #248's authorized CDSL/NSDL statement evidence gate remains open.
- #218's native encryption blocker remains unchanged; no encryption is claimed.

Keep #138 open. No Android performance gate or statement evidence requirement
has been waived by this verification pass.
