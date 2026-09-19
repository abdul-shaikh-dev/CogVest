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

## Cross-Version Combined-Scale Follow-Up

Recorded 19 September 2026 on `emulator-5554`, Android 16/API 36, x86_64,
1280x2856, density 480 and font scale 1.0. EAS internal-distribution preview
version 1.0.7/code 8 (`b270ef3`) was upgraded in place to version 1.0.8/code 9
(`d4eebcc`). Both standalone APKs used the same remote signing certificate;
`adb install -r` succeeded without uninstalling or clearing app data.

- 1.0.7 build: `5986f4cd-55b8-474c-b923-e9e25f52ed2a`, SHA-256
  `842886B1AEC97199EE0A20F474F7A0EF106E3EAB9CA4139149F4DBB7F55CF5E1`.
- 1.0.8 build: `a0deeefa-5b92-4c96-961e-95cd813aadc3`, SHA-256
  `E7C193E0A903E3399B6FA522DAA73B3275139A1D3C099A09A42A1D5830C61445`.

The scale fixture was serialized through the production backup creator and
restored through the normal review and replacement flow. Before upgrade it
contained 250 assets, 250 opening positions, 1,000 trades and 60 monthly
snapshots. The upgraded app opened Dashboard, rendered all 250 Holdings rows,
scrolled the list and exported another production backup. Maestro completed the
functional scale flow. The emulator's original synthetic five-asset portfolio
was restored afterward through the same production restore flow.

The validated before/after production backup payloads matched exactly: 250
assets, 250 openings, 1,000 trades, 60 monthly snapshots, quotes, preferences,
CAS salt and all other exported fields. The additive-snapshot comparison mode is
also covered for runs where normal startup automation advances history; it fails
if any existing snapshot or any other payload field changes. Daily price
histories are intentionally disposable cache data outside the backup contract,
so this restore route does not install the fixture's ten daily histories.

Five standalone-preview ActivityManager cold-start samples reported 1,237,
2,025, 1,848, 2,759 and 1,667ms. These pass the 3s ActivityManager threshold but
are not time-to-interactive measurements. The 250-row Holdings list opened and
scrolled under Maestro, and Android exit history showed only requested force
stops, with no observed crash or ANR. A chart-range probe could not proceed:
without the disposable daily-history cache, Progress correctly showed that
monthly history was still rebuilding and did not expose chart controls. Hot
deep-link dispatch samples are excluded because dispatch latency is not visible
cached-revisit latency. No JS-thread stall measurement or smoothness claim is
made while #299 remains parked.

`npm run test:verify` passed after the follow-up changes: typecheck, 1,713 tests
across 164 passing suites (one suite and three tests skipped), and Expo Doctor
17/17.

## Verification Results

`npm run test:v1:pc` passed:

- Typecheck passed.
- Jest: 1,257 tests passed across 128 suites; one existing test/suite skipped.
- Expo Doctor: 17/17 checks passed.
- Android Doctor: emulator, adb, Expo and Maestro detected.
- Strict Android smoke: `com.abdulshaikh.cogvest` installed.

## Remaining Gates

- The combined asset/transaction/snapshot fixture has been installed and
  functionally exercised in a standalone signed preview. ActivityManager cold
  starts were below 3s and list scrolling completed without an observed crash or
  ANR. Visible cached revisit, the ten-history fixture, chart range changes and
  measured JS stalls <=500ms remain unproven.
- #299's native-control/measurement-validity investigation remains parked; this
  pass did not resume or duplicate it.
- Full backup-contract payload preservation is verified across the 1.0.7/code 8
  to 1.0.8/code 9 in-place upgrade at combined scale. App-private disposable
  caches remain outside that contract.
- CDSL/NSDL statement import evaluation #248 was closed as not planned by owner
  decision on 19 September 2026 and is no longer a V3 gate.
- #218's native encryption blocker remains unchanged; no encryption is claimed.

Keep #138 open. No Android performance gate has been waived by this verification
pass.
