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

## EAS Profiles

Configured in root `eas.json`:

```json
{
  "cli": {
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

## Versioning

- `versionName`: user-facing app version, e.g. `0.1.0`.
- `versionCode`: monotonically increasing Android integer.
- Git tag format: `v0.1.0`.
