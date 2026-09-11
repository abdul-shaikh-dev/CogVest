# Zerodha Batch Import Regression

## Scope

Fix repeated matching, excessive review content, and rejected ordinary NSE BE /
BSE B equity transactions. Unknown series, rights entitlements, conflicting asset
identity, incomplete history and genuine overselling remain blocked.

Matches are proposed using symbol, exchange and currency, excluding conflicting
ISINs. Bulk acceptance is explicit and does not save transactions. Ambiguous
listings still require a choice. Adding or reordering files preserves compatible
confirmed matches. Provider lookup is not proof of historical corporate actions.

## Local Data Replay

Six private annual tradebooks were replayed locally, without uploading or committing
them. The original 267 rows were accepted after the parser fix; previously nine
ordinary series rows were rejected. Identity-only assets isolated parsing and
financial reconciliation from provider lookup. The store saved/reloaded 267
transactions for 27 identities. Reimport detected 267 duplicates and no additions.

This is not verification of every live provider match or of reconciliation with
the user's existing phone balances. Private files and screenshots are excluded
from this repository.

## Automated Checks

- Typecheck passed.
- Jest: 141 suites passed, one skipped; 1,355 tests passed, two skipped.
- Expo Doctor: 17/17 passed with network access. The sandboxed retry initially
  failed two remote metadata checks with EACCES; no dependency changes were needed.
- Independent owned-diff review: no remaining material findings after fixes for
  renamed-symbol lookup and currency-sensitive candidate caching.

## Standalone Android Reproduction

Environment: Pixel_10_Pro AVD, API 36, x86_64, 1280 x 2856, density 480,
font scale 1.0. Local signed release APK, no Metro. This emulator architecture is
not the phone distribution artifact.

Build with the documented local signing environment and `EXPO_OFFLINE=1`:

```powershell
npm run android:apk:release -- --architecture=x86_64
adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk
adb -s emulator-5554 push e2e/fixtures/zerodha-tradebook-2024.csv /sdcard/Download/
adb -s emulator-5554 push e2e/fixtures/zerodha-series-2025.csv /sdcard/Download/
npm run maestro:test -- e2e/standalone/zerodha-batch-review.yaml
```

The flow clears synthetic app data. Use only a disposable emulator. It requires
live Yahoo asset lookup and tests explicit batch acceptance, preserving a match
after another file is added, overlapping-file deduplication, resulting quantity
and cost, save/restart, and duplicate-only reimport. Android's picker helper
checks the Downloads header rather than assuming its initial location.

Fresh APK SHA-256:
`1BAF7F48B26B74E2C7FA55226A269F08ECB4BBB970216793CE6163EDE0186E2C`.

Native journey result: passed on the fresh APK above. The preview showed three
new transactions, one overlapping duplicate, 20 remaining units and INR 1,450
average cost. Saving returned to Holdings. After process restart, reimport showed
three duplicates and zero additions. Synthetic screenshots were inspected for
matching, balance review and duplicate-only states.

Earlier runs stopped on picker navigation, an off-screen test control, and a
blank-window/deep-link timing state. The final run waits for initial hydration
before navigation and verifies picker readiness. No financial assertion was
removed. These runs do not establish that all device-specific navigation races
are absent.
