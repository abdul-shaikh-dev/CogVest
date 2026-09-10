# Asset History Verification (#22)

## Implemented Scope

See [the behavior contract](../roadmap/asset-history-contract.md). Both price and
historical holding-value modes extend the existing Holding details panel. No
portfolio records, current valuations, monthly snapshots or backups were changed.
The new daily cache is disposable. Corporate actions are not reconstructed.

## Reproduction

```powershell
npm run test:v1:pc
$env:COGVEST_HISTORY_BENCHMARK = '1'
npm test -- --runInBand src/domain/calculations/__tests__/assetHistory.test.ts
Remove-Item Env:COGVEST_HISTORY_BENCHMARK
$env:COGVEST_HISTORY_LIVE = '1'
npm test -- --runInBand src/services/quotes/__tests__/assetHistoryLive.test.ts
Remove-Item Env:COGVEST_HISTORY_LIVE
```

The public-provider probe is skipped in default CI, not silently counted as a
passed live-provider check. It sends only fixed public NIFTYBEES/Bitcoin IDs and
dates, never saved portfolio records or credentials.

Build a fresh local APK using `npm run android:apk:emulator`; install with the same
signing identity using `adb install -r`, never uninstall/reset existing data.
Run Metro on port 8081 and reverse the emulator port, then:

```powershell
npm run maestro:test -- e2e/discovery/asset-history.yaml
```

The token-gated development route uses an in-memory synthetic fixture, not the
portfolio MMKV store. It verifies price 200, held value 1,000 after a recorded buy,
ten-year range selection and masking. Long histories are capped at 500 plotted
observations. Invalid-token tests ensure the fixture is not initialized.

## Evidence: 10 September 2026

- Final `npm run test:v1:pc` passed: typecheck, 124 suites / 1,235 tests,
  Expo Doctor 17/17, Android doctor and strict smoke. The one opt-in live suite
  is skipped by default and was separately run successfully.

- Fresh x86_64 debug APK built and signed with the existing local QA identity;
  `adb install -r` succeeded without data reset. JavaScript came from current
  Metro. No EAS build or standalone-release performance claim.
- Native Maestro fixture passed mode changes, 10Y range, exact derived value and
  hiding/showing values. Screenshot `.expo/issue22-holding-history.png` inspected.
- Real Holding details was opened for the existing Nifty ETF. Yahoo data loaded,
  partial coverage was visible, and endpoint labels and the selected-point marker
  were inspected in `.expo/issue22-detail-loaded.png`. No holding was edited.
- Live adapter probe passed: Yahoo supplied 13 observations (partial) from
  2026-08-21 to 2026-09-08; CoinGecko supplied 20 completed-day observations from
  2026-08-21 to 2026-09-09. Availability is provider-dependent, not guaranteed.
- The 3,653-point ten-year PC transform plus sampling took 8 ms, below 100 ms.
- Native chart-container layout arrived 734.8 ms after the QA screen started,
  including synthetic cache creation. This measures JS-to-layout readiness, not
  compositor presentation time. Maestro separately exercised the controls.
- Device used: Pixel_10_Pro, Android 16/API 36, x86_64, emulator-5554, 1280x2856,
  density 480, font scale 1. Pixel 8 named in the issue is not installed here.

## Review And Limitations

Independent financial review led to session-level Yahoo adjustment verification:
if cache clearing fails after split detection, unverified holding-value history
cannot reappear on remount/restart. Cached price history may remain readable.
Tests cover identity/range races, failed clears, quantities/cutovers/transfers,
currency mismatch, partial prices, malformed responses and provider failures.

Native visual review corrected endpoint clipping, added a selected marker and
moved secondary explanation below the chart. The Impeccable source detector
reported no findings; native screenshots, not browser rendering, supplied visual
evidence. The 4 MiB provider guard is pre-parse, not a streaming-memory guarantee.

Pixel 8-specific acceptance remains pending unless the owner accepts the recorded
Pixel_10_Pro substitution. Stock splits, unsupported asset types and provider
history-access restrictions remain explicit limitations, not fabricated curves.

Final independent owned-diff review found no remaining blocking findings after
the failed-clear/session-verification regression was fixed and tested.
