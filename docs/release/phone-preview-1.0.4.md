# Phone Preview 1.0.4

Owner-requested standalone APK from merged `3845cd7` (Zerodha import fix #330)
plus version-only release records. This branch carries forward PR #329's build-4
record, so #329 can be closed as superseded after this replacement PR merges.

## Artifact

- Version 1.0.4, Android versionCode 5, package `com.abdulshaikh.cogvest`.
- Local artifact: `.expo/releases/CogVest-1.0.4-build5.apk` (79,010,893 bytes).
- SHA-256: `E323475948595E8587063C7035D56CEA0EA35237AB81A32FFFC2B829F0F1A292`.
- Minimum API 24, target API 36; arm64-v8a, armeabi-v7a and x86_64.
- Signature verified and certificate confirmed equal to distributed build 4.
- No Metro, Expo Go, EAS build, published tag or Play submission.

Using the existing private signing environment and `EXPO_OFFLINE=1`:

```powershell
npm run android:apk:release -- --architecture=arm64-v8a,armeabi-v7a,x86_64
```

Build succeeded in 2m 50s; existing Gradle deprecation warnings remain.

## Verification

- `npm run test:verify`: typecheck passed, 141 suites / 1,355 tests passed;
  one suite and two tests skipped. Expo Doctor 17/17 passed.
- Exact artifact installed as an update with `adb install -r` on emulator-5554,
  Pixel_10_Pro AVD, API 36, x86_64, 1280 x 2856, density 480, font scale 1.0.
- Cold launch succeeded without Metro; Dashboard was present in the UI hierarchy.
  Installed identity confirmed as 1.0.4 / code 5. Strict Android smoke passed.
- Import/save/restart/duplicate E2E passed on the same feature code before this
  version-only release, as recorded in the Zerodha regression document. That
  full journey was not repeated on this exact universal artifact.
- ARM execution and phone behavior remain for owner verification.

## Install

Export a CogVest backup first. Install over build 4 without uninstalling; the
certificate is unchanged and versionCode increases. Do not uninstall to work
around a signature error. Confirm 1.0.4 in Android app information after updating.
APK, private broker data and signing credentials remain outside Git.
