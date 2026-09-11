# Phone Preview 1.0.3

Owner-requested local phone APK built from merged `8ecc62c` plus version-only
changes on `codex/phone-preview-1.0.3`. Includes the phone onboarding fixes,
scoped market history with incomplete PPF history, and PPF CSV import from #328.

## Artifact

- Version 1.0.3, Android versionCode 4.
- Package `com.abdulshaikh.cogvest`; minimum API 24, target API 36.
- Verified architectures: arm64-v8a, armeabi-v7a, x86_64.
- Local file: `.expo/releases/CogVest-1.0.3-build4.apk`.
- Size: 79,003,701 bytes (about 75.3 MiB).
- SHA-256: `CA4E873B3B1141C64C548CF762C5B3FD1AA0702F619501AA2911F270E80E503B`.
- Standalone release, signed with the existing owner-controlled local QA key;
  not the public debug key. Signature verified. No Metro or Expo Go needed.
- No EAS build, tag publication, or Play submission.

Built with the existing private signing environment, without logging passwords:

```powershell
npm run android:apk:release -- --architecture=arm64-v8a,armeabi-v7a,x86_64
```

Build passed in 1m 56s. Existing native/Gradle deprecation warnings remain.

## Verification And Limits

- `npm run test:verify`: typecheck passed; 139 suites / 1,337 tests passed,
  one suite / two tests skipped; Expo Doctor 17/17 passed.
- APK signature, version identity, and native architectures verified directly.
- Emulator installation of this exact artifact failed with
  `INSTALL_FAILED_INSUFFICIENT_STORAGE` (445 MiB free on a 5.8 GiB data volume).
  Android cache trimming and a non-streaming retry did not resolve it.
- No uninstall, app-data reset, or test of the older installed APK was used as
  evidence for this build. Installed-build smoke verification remains pending.
- The unchanged feature code has prior standalone emulator evidence in
  `docs/testing/ppf-csv-import.md`; that is not verification of this artifact.
- ARM execution and physical-phone behavior await the owner's testing.

## Install Safely

Export a CogVest backup before updating. Install this APK over the existing
local-QA-signed phone preview; the signing identity is unchanged and versionCode
increases from 3 to 4. Do not uninstall to work around a signature mismatch.
APK and private credentials stay outside Git. The user-facing version can be
checked in Android app information after installation.
