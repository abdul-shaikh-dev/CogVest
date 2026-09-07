# Contextual Guidance Verification (#21)

## Contract

Canonical behavior: `docs/roadmap/v2-behaviour-spec.md`, Contextual Guidance
Contract. UI uses the shared typography, neutral text, and minimum-touch-target
ghost button. Heading and dismissal share a row; text wraps without a fixed
height. Guidance follows the main display choices/insight observation. Optional
Add Holding details must be explicitly opened first. No extra Dashboard cards,
rapid-entry prompts, mandatory fields, financial rules, dependencies, or native
configuration changes were introduced.

## Automated Coverage

`src/features/onboarding/__tests__/ContextualNudge.test.tsx` covers first exposure,
all three dismissals, remount/hydration, legacy preferences, reset, malformed
guidance metadata, monotonic acknowledgment, draft versus saved completion,
Minimal suppression, and storage failure/recovery safety. Existing Add Holding,
Settings, and insight tests remain regression coverage for their core actions.

`e2e/contextual-nudges.yaml` uses the existing explicitly confirmed synthetic
developer seed, not physical-device data. It checks guidance and dismissal,
saves an opening holding without optional metadata, asserts resulting invested
and current values, cold-restarts, and checks Standard/Minimal navigation.
Run only on a disposable developer portfolio: seeding replaces local records.

## Android Procedure

Use a fresh local debug build and Metro for this JS-only change:

```powershell
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
./android/gradlew.bat -p android assembleDebug -PreactNativeArchitectures=x86_64
adb -s emulator-5556 install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5556 reverse tcp:8081 tcp:8081
# Start Metro with the documented development loop; the debug bundle host is localhost:8081.
& C:/Users/abdul/.maestro/bin/maestro.bat --device emulator-5556 test e2e/contextual-nudges.yaml --test-output-dir=.expo/issue21-maestro-final
```

Wait for `adb shell getprop sys.boot_completed` to return `1` before installation;
`adb wait-for-device` alone does not mean the package service is ready. Do not
edit bundled source during Maestro execution: Fast Refresh can reset navigation
and invalidate the journey. Do not clear debug app data merely to reset guidance;
that also erases its Metro host configuration. The confirmed developer seed resets
guidance versions for repeatability.

## Review

Impeccable-assisted source and screenshot review found excessive guidance height
and precedence over the actual settings/observation. Corrected by moving guidance
after the main content, shortening copy, and placing dismissal beside the heading.
Detector returned no findings; its TSX/native support is limited, so this is not
visual proof. No browser HTML proxy was substituted for Android screenshots and
no independent subagent was available.

## Recorded Results (2026-09-08)

- `npm run test:v1:pc`: passed, including typecheck, 104 suites / 1,074 tests,
  Expo Doctor 17/17, Android Doctor, and strict installed-package smoke.
- Local `assembleDebug` succeeded and the resulting APK was installed on
  disposable Android emulator `emulator-5556`. Current JS was loaded via Metro;
  this was not verification of the older APK on emulator 5554.
- `contextual-nudges.yaml`: passed end to end after correcting a missing ticker
  in the new test input. Saving without optional metadata produced the expected
  invested/current values (INR 200 / 250, quantity 2). Dismissal survived cold
  restart, and switching display modes left navigation usable.
- Inspected Android screenshots for Settings, insight guidance, expanded optional
  metadata, and Minimal Mode. Local evidence is in
  `.expo/issue21-maestro-final/screenshots/.expo/issue21-*.png`; raw synthetic
  screenshots/logs are local artifacts, not committed product assets.
- Initial installation was attempted before the Android package service was
  ready; retry after completed boot succeeded. An earlier journey was invalidated
  by source reload during testing. Neither failed attempt is counted as a pass.

## Limits

Debug + Metro evidence is not standalone-release performance evidence. No EAS
build, physical phone, TalkBack, or large-font certification is claimed. Existing
emulator/render-performance investigation #299 remains parked. Original emulator
5554 and its retained data must remain untouched.
