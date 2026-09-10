# Backup and Restore Verification (#24)

Run: 10 September 2026. Scope: manual backup format 1, portfolio schema 9,
replacement-only restore. Contract: [backup and restore](../roadmap/backup-restore-contract.md).

## Build and Data Safety

- Fresh local x86_64 release APK, version 1.0.1 / versionCode 2.
- SHA-256: `720F2858E447D76922F45AF6CC0A21195D93F00C4A9C9B04E1B5073C9C701D15`.
- Existing private local QA certificate, not a distribution or public debug key.
- Pixel_10_Pro, `emulator-5554`, Android 16 / API 36, 1280x2856.
- Installed in place with `adb install -r`. No uninstall, data reset, physical
  phone, Metro dependency, EAS build, tag push, or Play action.
- The emulator held the established synthetic visual-QA portfolio plus Guidance
  Holding: 6 assets, 5 opening positions, 4 cash entries, 29 monthly snapshots.
  No real source statements, passwords, or personal portfolio data were used.
- Compared the release bundle's source-map content with current backup domain,
  store, journal, service, bounded reader, screen, and root layout: all matched.

Built through the existing native project as documented in the
[V2 closeout](v2-closeout-evidence.md#data-and-build-procedure): no native config
or dependency changes. Load the existing private QA signing environment variables
without printing them, then run:

```powershell
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
./android/gradlew.bat -p android assembleRelease -PreactNativeArchitectures=x86_64
adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk
```

Gradle succeeded in 48 seconds. The APK is an emulator QA artifact, not a
phone-distribution build. Use the release guide for distribution signing/versioning.

## Automated Proof

`npm run test:v1:pc` passed: TypeScript, 111 Jest suites / 1,159 tests, Expo Doctor
17/17, Android doctor, and strict installed-package smoke. Maestro is available.
This command includes `npm run test:verify`; it does not itself establish APK
freshness or run the file-provider journey below.

Focused tests cover:

- SHA-256 round trip of mixed stock/ETF/fund/debt/crypto/PPF data, linked sells
  and cash, manual prices, original quote provenance, and preferences; equivalent
  derived results at the same clock. Also 500 assets/openings and 120 snapshots.
- Supported legacy unlinked cash transfer classifications remain restorable.
  Present links must still match their referenced trade exactly.
- Unknown/older/newer format or schema, missing/unknown fields, corrupt content,
  invalid dates/currencies, duplicates, dangling links, oversell, numeric bounds,
  excessive nesting/records/bytes, invalid UTF-8, and CAS salt requirements.
- Empty/populated/identical replacement, no merging, stale preview, forged token,
  and recovery from an unexportable destination using a valid backup.
- All five affected keys, rollback, partial writes, silent write failure,
  interrupted restart, failed rollback, journal deletion ambiguity, and legacy
  asset-graph recovery. Uncertain storage outcomes block further writes.
- Actual synthetic CAS parse/import, restore into fresh storage with its salt,
  then reparse: all source rows are duplicates with zero additions.
- Late Dashboard/Holdings quote responses and monthly automation after restore;
  old captured store actions are revoked. CAS/import/setup callbacks check epoch.
- Picker abort, corrupt input, read/write/readback failure, cleanup failure,
  cancellation during readback, and no mutation before confirmation.

No dependency was added. PDF extractor's unavailable-native notice in Jest and
the existing Maestro runner's Node shell deprecation warning are test-environment
notices; release document-provider operations were tested natively.

## Installed Results

Android Documents provider export succeeded into `Documents/CogVest-QA`, including
native saved-file readback. The file was 28,923 bytes. A later restore preview
showed the correct current/backup counts, creation date, and version; it warned
about replacement, preferences, unencrypted contents, and unchanged price sources.

Changed destination preferences to masked/Minimal after export. Back from final
confirmation returned to review without replacing data. Explicit confirmation
returned to Dashboard. HDFC still showed 25 units, average cost INR 1,450,
invested INR 36,250, and acquisition date 15 April 2024. After stopping and cold
launching the app, a new export's **entire payload matched the first export**:
portfolio records/preferences, current quotes, historical quotes, and CAS salt.
Only envelope creation metadata/checksum changed. Standard/unmasked preferences
were restored; the two test preference changes did not survive replacement.

Both pickers canceled without an error or mutation. An intentionally invalid
backup was rejected with no preview/confirmation, and HDFC's invested value
remained INR 36,250. Backup actions remained reachable in Minimal Mode.

Visual inspection covered export, preview, final confirmation, invalid-file
feedback, and restored holding/settings screens. Corrected touching cards by
using the established screen spacing. No clipped labels or inaccessible primary
actions were observed; the detailed replacement preview intentionally scrolls.
Impeccable's scoped source detector returned no findings. This was a native APK
review, not a browser/DOM overlay or a full TalkBack audit.

## Repeat the File-Provider Journey

Use **synthetic data only**. Preserve an existing real portfolio; do not reset it
for these flows. Prepare the standard visual-QA fixture using the documented
development setup, then install the fresh same-key release over it. Start with
Standard mode and unmasked values. The release build correctly blocks dev seeds.

Create the dedicated directory (does not remove existing files):

```powershell
adb -s emulator-5554 shell mkdir -p /sdcard/Documents/CogVest-QA
```

On the first export, navigate Android's picker to Documents > CogVest-QA and
choose Use this folder > Allow. Subsequent runs remember the folder. Do not use
the Android storage root, which cannot be granted. Back in a directory picker
can navigate to parent folders before canceling the activity.

```powershell
npm run maestro:test -- e2e/standalone/backup-roundtrip.yaml
adb -s emulator-5554 push e2e/fixtures/invalid-portfolio-backup.json /sdcard/Documents/CogVest-QA/invalid-portfolio-backup.json
npm run maestro:test -- e2e/standalone/backup-cancel-invalid.yaml
```

The round-trip flow captures the exact filename from its successful export, not
an arbitrary older backup. It restores that file and verifies cold-reopened
holding data, Standard mode, and unmasked values, then exports again. These are
opt-in standalone flows, not part of the default destructive developer-seed suite
or GitHub emulator checks. Picker labels assume English Android Documents UI.

Pull the two synthetic exports to ignored `.expo/backup-before.json` and
`.expo/backup-after.json` and compare complete payloads, not filenames/checksums:

```powershell
node -e "const f=require('fs');const a=JSON.parse(f.readFileSync('.expo/backup-before.json'));const b=JSON.parse(f.readFileSync('.expo/backup-after.json'));if(JSON.stringify(a.payload)!==JSON.stringify(b.payload))process.exit(1);console.log('Complete payload matches');"
```

Local screenshots use `.expo/backup-*.png`; exported financial JSON is ignored
and must not be committed. Keep or remove only the explicitly created QA files
after testing, never other backups.

## Limits of Evidence

Real low-storage, abrupt process death during a synchronous MMKV write, and
revoked document grants are injected tests, not forced device faults. The local
Android Documents provider was verified; third-party/cloud providers and
physical devices were not. A provider unable to report/read a supported file
fails safely rather than falling back to an unbounded read. Backups are neither
encrypted nor authenticated; a checksum detects corruption, not hostile editing.
