# Android Release Process

## Build Types

### Development Build

Purpose: local development and native integration checks.

Commands:

```bash
npx expo run:android
eas build --platform android --profile development
```

### Preview Build

Purpose: optional installable APK for internal distribution. For local
developer verification, prefer a PC-built APK installed on Android Emulator so
EAS cloud compute is not consumed.

Local PC command:

```powershell
.\android\gradlew.bat -p android assembleRelease
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

Use Expo-managed Android credentials through EAS for V1 unless explicitly changed. Do not commit keystores. Document who controls the Expo account and how signing credential recovery is handled.

## Play Store Submission

V1 does not auto-submit. Build the production AAB and manually upload it to the Google Play Console internal testing track.

Future versions may add EAS Submit after manual release flow is proven.

## Versioning

- `versionName`: user-facing app version, e.g. `0.1.0`.
- `versionCode`: monotonically increasing Android integer.
- Git tag format: `v0.1.0`.
