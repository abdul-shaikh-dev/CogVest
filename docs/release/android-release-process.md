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

Purpose: installable APK for manual testing on real Android devices.

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
- `npm run typecheck`
- `npm test`
- `npx expo doctor`
- app starts with `npx expo start`
- core manual flows pass
- preview APK builds
- preview APK installs on a real Android device

V1 release-candidate requires:
- production AAB builds successfully
- EAS build URL is recorded
- Play Console internal testing upload is ready/manual

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

Recommended `eas.json`:

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
