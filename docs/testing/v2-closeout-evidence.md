# V2 Standalone Closeout Evidence (#137)

Run: 10 September 2026. App source: `64cca92733e178d64a94737e7c83b3d9a5b002df`
(merged PR #308). This closeout adds tests/documentation, not production logic.

## Build Identity

- Local x86_64 release APK, version 1.0.1 / versionCode 2, for emulator-only QA.
- Path: `android/app/build/outputs/apk/release/app-release.apk` (ignored).
- SHA-256: `DFC319ABEE67BD2909F3DBC8EA1FC38606E709142D5649146D784EE1E50E20FF`.
- Signed with the existing private local QA certificate, not the public debug
  key or a production/distribution key. Signature verification passed.
- Connected emulator: Pixel_10_Pro, `emulator-5554`, Android 16 / API 36,
  x86_64, 1280x2856.
- Installed in place at 14:51:09 local time. `run-as` correctly rejected this
  package as not debuggable. The development seed route was blocked in release.
- Metro stopped and adb reverse removed before testing. The APK cold-launched
  and restarted using bundled JavaScript; no EAS, tag push, AAB, or Play action.

This APK is not a phone-distribution artifact. External distribution requires
the version/signing process in `docs/release/android-release-process.md`.

## Data And Build Procedure

The connected emulator had no CogVest package at the start. Installed the existing
QA-signed debug shell only to prepare the standard synthetic visual-QA portfolio
with current JavaScript and its explicit confirmation. No existing user portfolio
was erased. Upgraded that populated installation with `adb install -r` using the
fresh same-key release, rather than uninstalling or resetting it.

`npm run android:apk:release -- --architecture=x86_64` stalled at Expo native
directory discovery. No app/native configuration or dependency changed, so the
existing native project was used, consistent with prior V2 evidence:

```powershell
# Load existing owner-controlled QA credentials into the four COGVEST_RELEASE_*
# environment variables described in the release guide. Never print/persist them.
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
./android/gradlew.bat -p android assembleRelease -PreactNativeArchitectures=x86_64
adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk
# Stop only the Metro process started for preparation, then:
adb -s emulator-5554 reverse --remove-all
npm run maestro:test -- e2e/standalone/v2-closeout.yaml
# Once on this synthetic portfolio; adds a clearly named test holding:
npm run maestro:test -- e2e/standalone/v2-guidance-save.yaml
```

Gradle succeeded in 5m 8s, including a newly generated current JS bundle. The
merged release manifest retains `allowBackup=false`, full backup/extraction
rules, and excludes app data from backup/transfer. No SYSTEM_ALERT_WINDOW or
legacy broad-storage permission appears. Generated XML excludes all app domains.

## Verification

- `npm test -- --watchman=false`: 104 suites / 1,079 tests passed.
- Unmodified `npm run test:verify`: passed, 1,079 tests, Expo Doctor 17/17.
- Final `npm run test:v1:pc`: passed against the installed release APK, including
  typecheck, 1,079 tests, Doctor 17/17, Android readiness and strict package smoke.
- `e2e/standalone/v2-closeout.yaml`: passed without Metro. It preserves financial
  records while changing/restoring display preferences and dismissing guidance.
- HDFC retained 25 units, average cost INR 1,450, invested INR 36,250, and
  15 April 2024 purchase date across the debug-to-release upgrade and restart.
- Holding duration showed the recorded stock interval and unavailable ETF
  comparison; masking and Back worked. No tax eligibility claim was introduced.
- Conviction displayed the actual HDFC 4/5 source record and insufficient-data
  state; frequency and patience screens rendered with their methodology/limits.
  The fixture has no trades in the current frequency window; zero activity is
  legitimate, not fabricated history. Invalid insight links exited safely.
- Settings and insight guidance were visibly dismissed, and remained dismissed
  after cold restart. Minimal Mode persisted, hid optional analysis, preserved
  core Holdings/Cash/Progress navigation, and could return to Standard Mode.
- `e2e/standalone/v2-guidance-save.yaml`: passed. Optional metadata guidance
  appeared only after opening the optional section and could be dismissed. Saved
  Guidance Holding without conviction/intended-hold fields; list assertions
  verified INR 200 invested and INR 250 current value before and after a cold
  restart. The test is single-run on a synthetic portfolio, not an idempotent
  production-data journey. The final app remains Standard and unmasked.
- The default-flow inventory test passed; both standalone flows are opt-in, not
  automatically added to the destructive developer-seed suite or CI.

## Visual Review

Actual release screenshots were inspected for readable text, complete records,
masked states, unobstructed controls and local/non-advisory copy. This is not a
pixel-parity or animation/performance certification.

- [Retained holding](artifacts/v2-closeout/holding.png)
- [Holding duration](artifacts/v2-closeout/duration.png)
- [Conviction source record](artifacts/v2-closeout/conviction.png)
- [Minimal Holdings](artifacts/v2-closeout/minimal.png)
- [New holding retained after restart](artifacts/v2-closeout/guidance-retained.png)

## Tooling And Limits

The first aggregate run was silent for several minutes before reporting passes;
it was interrupted, not counted as passed. A Watchman-disabled diagnostic passed,
then two normal aggregate runs passed. No failing test or permanent Jest fix was
established. Metro preparation also needed a temporary Watchman-disabled config
and `localhost:8081` bundle host; that config was removed, not committed.

The initial debug preparation failed before Dashboard because its bundle host
was unreachable. The corrected run seeded successfully before release upgrade.
These are preparation failures, not passing release evidence.

This scoped pass supplements the domain/component and Android evidence for
#17-#21; it does not repeat every onboarding, import, or failure-injection test.
TalkBack, physical-device performance, populated five-rating analytics, and
standalone frame smoothness are not certified. #299 remains parked and unresolved;
the earlier unhealthy native-control results are not dismissed as an app pass.

## Approved Deferral

Owner @abdul-shaikh-dev explicitly deferred #218 outside V2 on 10 September 2026.
Reason: retain current Android app-private storage/backup exclusions rather than
add an unapproved key-lifecycle migration. Target: post-V2 backlog, version/date
unassigned, resume only on owner request. The issue remains open; neither
application-layer encryption nor a completed threat assessment is claimed.
