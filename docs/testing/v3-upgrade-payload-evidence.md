# V3 Full Backup-Payload Preservation

10 September 2026, #138. Follow-up to the sampled UI check in
[V3 verification](v3-closeout-evidence.md). No app feature or storage schema changed.

## Result And Limits

Both native exports passed the production backup parser, including checksums,
schema and record-graph validation. Their **complete payloads matched**, not just
their collection counts. Only envelope creation metadata/checksum differed.

Compared every exported field in:

- 6 assets, 5 opening positions, 4 cash entries and 29 monthly snapshots.
- Preferences, 4 current quotes and 37 historical month-end quotes.
- Trades, PPF accounts and PPF ledger entries (all empty in this fixture).
- CAS identity salt (null in this fixture).

This verifies the entire backup-format portfolio, not every app-private file.
Disposable daily-price cache, unfinished quick-setup drafts, recovery journals,
and native settings are outside the export contract. Non-empty trades, PPF and
CAS provenance still rely on automated backup tests, not this installed fixture.

The fresh rebuild was byte-identical to the installed baseline because PR #319
changed only tests/documentation. Therefore this is **same-version in-place
reinstall and cold-launch preservation**, not cross-version/schema-migration
proof. Repeat with distinct release binaries when production behavior changes.
No Android performance or #299 measurement-validity claim follows from this run.

## Artifact And Sequence

- Source checkout: `b3e8228` plus test-only work on this branch; production code
  unchanged from `473d2df`.
- Installed baseline hash verified directly with `adb shell sha256sum` on its
  `pm path` APK, not inferred from a workspace artifact.
- Baseline and rebuilt APK SHA-256:
  `403FDFFE083E8003C3F5F5CED7232699EE87F4B438CD4338199DBB67F59C7618`.
- Build: `npm run android:apk:release -- --architecture=x86_64`, successful in
  44 seconds; existing private local QA signing identity, version 1.0.1/code 2.
- `apksigner verify --verbose` passed; `adb install -r` succeeded. Release
  remains non-debuggable. No Metro, uninstall, reset, restore, seed or data edit.
- Environment: `emulator-5554`, Android 16/API 36, x86_64; same emulator as the
  preceding V3 verification. No display or font configuration changes.
- Wi-Fi/mobile data were initially enabled. Both were temporarily disabled
  around the exports to prevent network-driven quote changes, then restored
  and checked as enabled after the after-export was pulled.

Before export: Maestro run `2026-09-10_221520`, created at
`2026-09-10T16:45:33.132Z`, 28,900 bytes. File SHA-256:
`9e03200f93b0e495b4abef5a7191739d578f6092db0c22af35bd3913ffd154ee`.

After reinstall/cold launch: Maestro run `2026-09-10_221724`, created at
`2026-09-10T16:47:38.231Z`, 28,900 bytes. File SHA-256:
`71d1661661e2e96bd498cc50234c8673d01428519f4b3018194cde386a33d4fc`.

Each export completed successfully through Android's Documents provider into
`Documents/CogVest-QA`. Exact filenames were identified by the single newly
created file relative to the directory listing before each run, not by selecting
an arbitrary existing backup. Synthetic exports remain local and ignored.

## Repeat Safely

1. Use an already-authorized synthetic emulator portfolio. Never reset a private
   portfolio to run this flow. Record the installed APK identity and network state.
2. Pause app/network activity for a stable comparison; record and restore the
   previous network settings even if verification fails. Do not change portfolio
   preferences or freeze/modify saved timestamps to manufacture equality.
3. Record the QA directory's filenames. Run
   `npm run maestro:test -- e2e/standalone/upgrade-export.yaml`. The picker must
   already target `Documents/CogVest-QA`; navigate there manually on first use.
   Confirm exactly one new file and pull that file to `.expo/upgrade-before.json`.
4. Build/sign using the release guide, verify its signature/hash, install with
   `adb install -r`, and run the export flow again. It launches from a stopped
   process. Pull this run's exact new file to `.expo/upgrade-after.json`.
5. Run the configured comparison below. Restore network settings. Do not commit
   exports, credentials or private raw data. The test reports only counts/booleans.

```powershell
$env:COGVEST_UPGRADE_BEFORE = '.expo/upgrade-before.json'
$env:COGVEST_UPGRADE_AFTER = '.expo/upgrade-after.json'
try {
  npm test -- src/testing/__tests__/upgradeBackupComparison.test.ts
} finally {
  Remove-Item Env:COGVEST_UPGRADE_BEFORE,Env:COGVEST_UPGRADE_AFTER
}
```

The opt-in file assertion is skipped when neither path is supplied; supplying
only one fails. Invalid/corrupt backups fail safely. All payload fields and array
order are compared; object-key order and envelope metadata are not significant.
Equal counts alone cannot pass. A mismatch must be investigated, not solved by
dropping changed fields from comparison. This test does not perform an install
or independently prove that the operator supplied correctly sequenced exports.

For a cross-version run where normal startup may add month-end snapshots, set
the additive-snapshot mode. This still requires every pre-existing snapshot and
every other payload field to match exactly:

```powershell
$env:COGVEST_UPGRADE_BEFORE = '.expo/upgrade-before.json'
$env:COGVEST_UPGRADE_AFTER = '.expo/upgrade-after.json'
$env:COGVEST_UPGRADE_ALLOW_SNAPSHOT_ADDITIONS = '1'
try {
  npm test -- src/testing/__tests__/upgradeBackupComparison.test.ts
} finally {
  Remove-Item Env:COGVEST_UPGRADE_BEFORE,Env:COGVEST_UPGRADE_AFTER,Env:COGVEST_UPGRADE_ALLOW_SNAPSHOT_ADDITIONS
}
```

## Cross-Version Scale Result

On 19 September 2026, EAS-signed internal preview version 1.0.7/code 8
(`b270ef3`, build `5986f4cd-55b8-474c-b923-e9e25f52ed2a`) was upgraded in place
to preview version 1.0.8/code 9 (`d4eebcc`, build
`a0deeefa-5b92-4c96-961e-95cd813aadc3`). The signing certificates matched and
`adb install -r` preserved app data. Production exports before and after upgrade
were validated and compared exactly:

- 250 assets, 250 opening positions and 1,000 trades were unchanged.
- Current quotes, preferences, CAS salt and all other exported fields were
  unchanged.
- All 60 pre-upgrade monthly snapshots were unchanged.
- The complete payloads matched; only backup-envelope creation metadata and
  checksum differed.

The installed app also opened Dashboard and rendered/scrolled all 250 Holdings
rows without Metro. Daily price history is an intentionally disposable cache
outside the backup contract. The original five-asset synthetic emulator
portfolio was restored after verification. The resulting `npm run test:verify`
passed typecheck, 1,713 tests across 164 passing suites, and Expo Doctor 17/17.

## Status

`npm run test:v1:pc` passed: typecheck, 1,261 tests across 129 suites, Expo
Doctor 17/17, Android Doctor and strict installed-package smoke. Two tests were
skipped in the default run: the existing skip and the opt-in export assertion.
With both actual export paths configured, all five comparison tests passed.

The former full-payload comparison gap is resolved for both the original
same-version synthetic fixture and the 1.0.7-to-1.0.8 combined-scale fixture
with populated trades. Populated PPF/CAS installed fixtures and standalone
release Android performance are not fully proven. CDSL/NSDL evaluation #248 was
removed from V3 scope by owner decision on 19 September 2026. Keep #138 open and
#299 parked.
