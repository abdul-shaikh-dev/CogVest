# Android Release Process

## Build Types

### Development Build

Purpose: local development and native integration checks.

Commands:

```powershell
npx expo run:android
npm run android:apk
```

`npm run android:apk` applies Expo config plugins and creates a debug-signed
APK at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Debug APKs are development-only and normally require Metro. They must not be
distributed as release candidates.

### Preview Build

Purpose: optional installable APK for internal distribution. For local
developer verification, prefer a PC-built APK installed on Android Emulator so
EAS cloud compute is not consumed.

Routine local testing must use the debug APK command above. A standalone local
release APK requires the owner-controlled private signing credentials described
under Signing Strategy.

Before any release build, run the QA harness check in the same shell:

```powershell
npm run release:check-harness
```

It bundles the production JavaScript with that shell's environment and `.env`
files, and fails if the E2E harness flag `EXPO_PUBLIC_COGVEST_QA_HARNESS` was
inlined. The release Gradle tasks also refuse to run while that flag is set.
See `docs/testing/e2e-build-variant.md`.

Private local release command:

```powershell
npm run android:apk:release
```

Local output:

```text
android/app/build/outputs/apk/release/
```

Command:

```bash
eas build --platform android --profile preview
```

Output: APK.

The GitHub workflow `.github/workflows/android-preview.yml` also builds this
profile. Push an annotated tag matching `v<version>-preview.<number>` to build
that immutable revision automatically, for example:

```bash
git tag -a v1.0.1-preview.2 -m "CogVest 1.0.1 preview 2"
git push origin v1.0.1-preview.2
```

Increment `android.versionCode` before creating another externally distributed
preview. The workflow can also be dispatched manually, but only against a tag:
its first step fails on a branch ref.

Before the signed build, the workflow runs typecheck, lint, the Maestro
selector lint, tests, Expo doctor and `npm run release:check-harness`. It also
runs `scripts/check-release-version.mjs`, which fails when:

- the tag's version differs from `app.json` or `package.json`;
- `android.versionCode` is not higher than the versionCode in `app.json` at
  every other `v*` tag.

The rule is that a `versionCode` is never reused once a binary carrying it has
been distributed. A build that was cancelled or blocked before it produced an
APK distributed nothing, so its `versionCode` was free: `v1.0.25-preview.2`
reused 26 and `v1.0.31-preview.2` reused 32 after the first preview of each
was cancelled without an APK. The check cannot tell which tags produced a
binary, so it is stricter and treats every tag as used. Give each new tag a
new `versionCode`, even after a cancelled build. A manual rebuild of
`v1.0.25-preview.2`, `v1.0.31-preview.2` or any older tag therefore fails.

Actions in both workflows are pinned to commit SHAs, with the release tag in a
comment, and `eas-cli` to an exact version. Update a pin deliberately: look up
the tag's commit (`gh api repos/<owner>/<action>/git/ref/tags/<tag>`) and
change the SHA and comment together.

Preview release checklist:

1. Prepare the version on a `release/<version>-preview` branch: `app.json`
   `version` and `android.versionCode`, `package.json`, the root entries of
   `package-lock.json`, and a new `current` entry in
   `android-version-history.json`. Merge it after CI passes.
   Check that the PPF rate schedule covers the current quarter (see
   [PPF Interest Rate Schedule](#ppf-interest-rate-schedule)).
2. Tag the merge commit on `main` (annotated) and push the tag.
3. Publish a GitHub pre-release for the tag: what changed since the previous
   preview, the verification evidence, and any known gaps. Say whether the EAS
   APK was verified at publication time.
4. When the workflow finishes, add the EAS build link to the pre-release.

The preview profile builds `arm64-v8a` only, through
`ORG_GRADLE_PROJECT_reactNativeArchitectures`. The four-ABI 1.0.31 preview hit
the 45-minute EAS limit and was cancelled, after Skia, Reanimated 4 and R8
joined the build. A preview APK therefore installs on 64-bit ARM phones but not
on x86 emulators; use a local build there. The production AAB keeps every ABI.

`eas build` exits 0 when EAS cancels a build, so the workflow reads the build
status from `--json` and fails unless it is `FINISHED`.

The Expo free plan has a small monthly Android build quota. Tag a preview only
for a set of changes worth a real release. When the quota blocks or cancels a
tag's build, no binary is distributed, but the version check still counts the
tag, so bump `versionCode` and tag again (`v<version>-preview.<number + 1>`).

### PPF Interest Rate Schedule

PPF interest estimates use the official rates in
`src/domain/ppf/interestRates.ts`, which stop at the latest notified quarter.
The Department of Economic Affairs notifies the next quarter's small-savings
rates near the end of each quarter. After each notification, add one period
(rate, effective dates, notification date and the DEA source link), bump
`ppfInterestRateScheduleVersion`, and update the boundary tests in
`src/domain/ppf/__tests__/calculations.test.ts`. Never extend a period past
its notified quarter. Until a rate is added, the PPF screen shows the estimate
through the last notified month and says the next rate is not yet notified.

### Production Build

Purpose: Google Play Store release candidate.

Command:

```bash
eas build --platform android --profile production
```

Output: AAB.

## V1 Gate Split

V1 dev-complete requires:
- `npm run test:v1:pc`
- app starts on Android Emulator
- local APK builds on the developer PC
- local APK installs on Android Emulator
- core V1 flows pass through `docs/testing/v1-core-flow-test-matrix.md`
- Excel parity passes through `docs/testing/excel-parity-checklist.md`
- defects are logged with `docs/testing/v1-defect-report-template.md`

V1 release-candidate requires:
- production AAB builds successfully
- EAS build URL is recorded
- Play Console internal testing upload is ready/manual
- Google Play auto-submit remains disabled

## Android Identity

Recommended package name:

```text
com.abdulshaikh.cogvest
```

Before production build:
- confirm package name
- set app name to `CogVest`
- increment `versionCode`
- set `versionName`
- verify icon, adaptive icon, and splash screen

## Local Data And Backup Policy

CogVest V1 stores portfolio records in app-private Android storage and excludes
all app data from Android cloud backup, device-to-device transfer, and
cross-platform transfer. V1 relies on Android/device security and does not add
separate application-layer MMKV encryption.

The durable Expo configuration must generate all three controls:

- `android:allowBackup="false"`
- `android:fullBackupContent="@xml/cogvest_backup_rules"`
- `android:dataExtractionRules="@xml/cogvest_data_extraction_rules"`

Both XML resources exclude every supported app-data domain. After Expo prebuild
or before a release candidate, inspect the merged manifest and generated XML
resources. Settings and store copy must not promise cloud recovery or encrypted
MMKV.

## EAS Profiles

Configured in root `eas.json`:

- `cli.appVersionSource` is `local`, so committed `app.json` values remain the
  source of truth and EAS does not silently change release identity.

```json
{
  "cli": {
    "appVersionSource": "local",
    "version": ">= 13.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "ORG_GRADLE_PROJECT_reactNativeArchitectures": "arm64-v8a"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "distribution": "store",
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

## Required Secrets

Do not commit secrets.

GitHub Actions secrets:
- `EXPO_TOKEN`

Draft GitHub Actions workflows are documented in
`docs/release/github-actions-drafts.md`.

Future Play submission secrets:
- Google Play service account JSON, only if EAS Submit is configured.

## Signing Strategy

Use Expo-managed Android credentials through EAS for V1 release candidates.
EAS injects its signing configuration during cloud builds; no local release
credentials are required for normal EAS use.

Local `assembleRelease` and `bundleRelease` tasks must never use the public
debug key. CogVest's Expo config plugin requires these four values through
environment variables or `~/.gradle/gradle.properties`:

```properties
COGVEST_RELEASE_STORE_FILE=C:/secure/cogvest/cogvest-upload.jks
COGVEST_RELEASE_STORE_PASSWORD=replace-with-private-value
COGVEST_RELEASE_KEY_ALIAS=replace-with-private-value
COGVEST_RELEASE_KEY_PASSWORD=replace-with-private-value
```

Do not put these values in the repository's `android/gradle.properties`.
The release build fails before execution when any value is missing.

To reuse the EAS-managed upload key locally:

1. Run `eas credentials`.
2. Select Android and the CogVest build profile.
3. Choose the credentials upload/download option.
4. Download `credentials.json` and its keystore.
5. Move the keystore to owner-controlled encrypted storage.
6. Transfer its path, alias, and passwords into user-level Gradle properties.
7. Delete transient credential exports after confirming the secure backup.

The Expo account owner controls the upload key. Back up the keystore and its
passwords in two owner-controlled secure locations. Losing the key can prevent
future updates; exposing it allows unauthorized update signing.

After a privately signed local build, inspect the certificate:

```powershell
$apksigner = "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat"
& $apksigner verify --print-certs `
  android\app\build\outputs\apk\release\app-release.apk
```

Record the expected SHA-256 certificate fingerprint in the private release
record, not in source control if the release policy treats it as restricted.

## Play Store Submission

V1 does not auto-submit. Build the production AAB and manually upload it to the Google Play Console internal testing track.

Future versions may add EAS Submit after manual release flow is proven.

Any future Play automation is optional and requires explicit owner authorization.
Use a manually approved release environment and least-privilege service-account
credentials supplied through repository/environment secrets. Never put credential
JSON, tokens or signing passwords in logs, artifacts, or source control. Submission
must not run on ordinary pull requests; a successful CI check is not permission
to publish. Existing preview-build triggers do not authorize Play submission.

## Versioning

- `versionName`: semantic user-facing version shared by `app.json`,
  `package.json`, and the current release-history entry.
- `versionCode`: strictly increasing Android integer for every APK or AAB
  distributed outside the developer machine, including previews.
- Never reuse a `versionCode` once a binary carrying it has been distributed,
  even when that preview is later discarded. A build cancelled before it
  produced a binary distributed nothing; see
  [Preview APK](#preview-build) for why a new tag still needs a new one.
- Record every distributed identity in
  `docs/release/android-version-history.json` before building it.
- Git tag formats, both annotated and on the merge commit on `main`:
  - preview: `v<version>-preview.<number>`, for example `v1.0.32-preview.1`;
    this is the only format that triggers the preview workflow;
  - release: `v<version>`, for example `v1.0.32`. The version check accepts
    it, but no workflow builds it; run the production `eas build` by hand.

## Release Permissions

The durable Expo permission plugin removes legacy external-storage permissions
and `SYSTEM_ALERT_WINDOW` from the main/release manifest. Expo debug manifests
may add `SYSTEM_ALERT_WINDOW` for developer tooling; it must not appear in the
merged release manifest. V1 release permissions are limited to documented
runtime needs such as internet access and vibration.

The plugin also removes
`com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`, which
`expo-application`'s Play Install Referrer library merges in. CogVest reads only
the application id from that module and never requests the install referrer.
The "Block screenshots" setting uses the local
`modules/cogvest-screen-security` module, which only sets FLAG_SECURE and needs
no permission. Do not replace it with `expo-screen-capture`: that module
registers a screenshot-detection callback on load, which needs
`DETECT_SCREEN_CAPTURE` and crashes on Android 14+ without it.
After a dependency change, check the built APK with
`aapt dump permissions <apk>`. A release should list only
`android.permission.INTERNET`, `android.permission.VIBRATE`, and the app's own
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` signature permission.
