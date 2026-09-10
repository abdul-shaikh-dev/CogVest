# Phone Preview 1.0.2

Owner-requested local phone APK, built 10 September 2026 from `489e2b2` plus
the version-only changes in this release branch. No domain, UI or schema change.

## Artifact

- Version 1.0.2, Android versionCode 3 (reserved in version history).
- Package `com.abdulshaikh.cogvest`; Android 7/API 24 minimum, target API 36.
- Architectures verified in the APK: arm64-v8a, armeabi-v7a and x86_64.
- Standalone privately signed release preview; no Metro or Expo Go required.
- Local delivery file: `.expo/releases/CogVest-1.0.2-build3.apk`.
- Size: 78,973,089 bytes (about 75.3 MiB).
- SHA-256: `E49965C5E4D2F85B40540A91A86CDDBC60AFEBB6BF8184129D248C898086658C`.
- Existing owner-controlled local QA signing identity, not a public debug key.
  This is not an EAS/Play-signed distribution or store release candidate.

Build through the documented private-signing environment without logging secrets:

```powershell
npm run android:apk:release -- --architecture=arm64-v8a,armeabi-v7a,x86_64
```

Build succeeded in 7m 17s. Signature verification passed. The APK reports the
expected version/architectures; the release manifest retains Android backup
exclusions and excludes overlay/broad storage permissions. Existing native
deprecation/path-length warnings did not prevent the build.

## Installation Safety

Transfer the APK to the phone and open it through its file manager. If Android
requests it, allow installation from that source. Export a CogVest backup before
updating an existing portfolio. An installed copy signed by EAS or another key
may reject this APK as an update: do not uninstall to bypass the error and lose
local data. Resolve signing compatibility or use a separately verified backup
and restore procedure first. Future updates must retain the signing identity.

## Verification

- `npm run test:v1:pc`: typecheck passed, 1,261 tests passed across 129 suites,
  Expo Doctor 17/17, Android Doctor and strict package smoke passed. Two default
  skips include the opt-in export comparison.
- Installed this exact APK with `adb install -r` on `emulator-5554`, Android
  16/API 36 x86_64, over version 1.0.1/code 2. No reset, restore or reseed.
- Native export flow passed before/after. The five configured comparison tests
  passed against both actual exports: entire payload equal, not just counts.
- Standalone navigation/holding/restart smoke passed on an unchanged rerun.
  The first run reached the launcher during the final keyboard-dismiss step;
  no corresponding CogVest crash entry was observed. This intermittent test
  interaction remains a limitation, not a silently discarded result.
- Matched 6 assets, 5 openings, 4 cash entries, 29 snapshots, preferences and
  quote caches. Trade/PPF collections were empty; CAS salt was null.
- Networking was temporarily disabled to stabilize the comparison and restored
  to the original enabled Wi-Fi/mobile-data state afterwards.

Unlike the preceding same-binary verification, this checks a real versionCode
2-to-3 replacement. Financial schema is unchanged; it is not migration evidence
for an older schema, populated PPF/CAS/trades, or excluded disposable caches.
ARM phone execution and device-specific layout/performance have not been tested
by the agent. No EAS build or Play submission was triggered. APK and raw exports
remain local/ignored rather than in Git.
