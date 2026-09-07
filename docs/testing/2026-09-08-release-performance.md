# Release Rendering Investigation

Issue #299. Baseline `39b27b2`, including merged chart and allocation fixes.

## Decision

Do not change chart libraries, add blanket memoization, or claim smoothness from
this run. Frame misses reproduce in CogVest and in native Android Settings.
This strongly indicates a shared emulator/system rendering limitation, but does
not prove CogVest has no application-specific bottlenecks. Exact CPU/GPU/driver
attribution remains open in #299. No production source was changed.

## Identity And Method

- Fresh local x86_64 release APK, SHA-256
  `3861E1905928203518A2DA1C7B39DCE43D1B8D94AB229D2FAE3E4DB278E697D9`.
- Same private local QA signing identity; installed with `adb install -r`.
  Retained synthetic 63-month history, June 2021-August 2026. No data reset,
  production signing changes, EAS build, or Metro development server.
- Two Expo prebuild attempts stalled in template file discovery. The existing
  native configuration was unchanged by the merged UI commits; built directly
  with `android/gradlew.bat -p android assembleRelease -PreactNativeArchitectures=x86_64`
  using existing local QA signing environment variables. Gradle succeeded in
  5m 6s and regenerated the release JavaScript bundle.
- Pixel_10_Pro / emulator-5554; 1280x2856, density 480, font scale 1.0, 60Hz.
  OpenGL ES Translator on NVIDIA GeForce RTX 4060 Ti, driver 596.36;
  application pipeline Skia/OpenGL. No display overrides were applied.
- Build, test and Maestro workers finished before each measurement group.
  Android Studio and ordinary host applications remained open: this is a
  controlled task workload, not a laboratory host-load guarantee.
- Custom-range Maestro journey passed and positioned Portfolio Growth. Native
  hierarchy confirmed range centers X=202/413/624/835, Y=1494. Latest summary
  remained August 2026; historical May assertion remained 19.87L / 15.48%.
- Range samples: three cycles of 3M/6M/1Y/All, 700ms pauses. Scroll samples:
  six up/down pairs, x=640, y=2200 to 1100, 450ms gestures, 350ms pauses.
  Reset gfxinfo for every sample. Three samples per workload.
- Dashboard is a same-app control without Gifted line charts. Native Android
  Settings is a separate non-React-Native control; its scroll container bounds
  were verified before using the same gesture coordinates. Different content
  and scroll distances mean these are diagnostic controls, not identical work.

## Measurements

First aggregate gfxinfo block per sample; GPU histogram overflow values are
excluded from interpretation, as in the previous report.

| Workload | Run | Frames | Missed frames | P95 |
| --- | ---: | ---: | ---: | ---: |
| Chart ranges | 1 | 245 | 204 / 83.27% | 61ms |
| Chart ranges | 2 | 258 | 212 / 82.17% | 69ms |
| Chart ranges | 3 | 281 | 235 / 83.63% | 57ms |
| Chart scrolling | 1 | 327 | 323 / 98.78% | 61ms |
| Chart scrolling | 2 | 328 | 324 / 98.78% | 61ms |
| Chart scrolling | 3 | 327 | 303 / 92.66% | 69ms |
| Dashboard scrolling | 1 | 353 | 341 / 96.60% | 57ms |
| Dashboard scrolling | 2 | 329 | 310 / 94.22% | 57ms |
| Dashboard scrolling | 3 | 328 | 328 / 100.00% | 57ms |
| Native Settings scrolling | 1 | 330 | 325 / 98.48% | 61ms |
| Native Settings scrolling | 2 | 328 | 327 / 99.70% | 61ms |
| Native Settings scrolling | 3 | 328 | 323 / 98.48% | 65ms |

Raw samples and input metadata: [artifacts](artifacts/2026-09-08-performance/).
Do not interpret differences from September 7 as an optimization result: this
is not a randomized before/after experiment, and both host state and code differ.

## Trace And Limits

A separate 20-second system trace was captured during a Progress scroll probe:

```powershell
adb shell perfetto -D -t 20s -b 32mb -o /data/misc/perfetto-traces/cogvest-scroll.perfetto-trace sched freq gfx view input
```

Local file: `.expo/cogvest-scroll.perfetto-trace` (12,677,871 bytes), SHA-256
`C2B32140099E589DB6FBA085621185C6F65CC91698244B1C76C11C304194E03F`.
Not committed or uploaded: system traces can contain unrelated process details.
The traced sample is excluded from the comparison table (328 frames, 90.55%
missed, P95 57ms). Capture alone is not trace attribution. No local trace reader
was available; call-stack/JS attribution was not performed. The installed app
did not advertise debuggable/profileable flags, and these were not enabled.

## Verification And Next Step

- Typecheck passed; both full Jest runs passed all 97 suites / 1,019 assertions
  but exited 1 on the pre-existing MonthlyHistoryPanel teardown timer error.
  Thus `test:verify` did not pass. Cleanup is tracked in #300; no assertions were
  disabled and no unrelated timer code was modified.
- Expo doctor run separately: 17/17 passed. Strict installed-app smoke passed.
- Probe executed against both packages. Initial foreground guard only supported
  an older dumpsys field; corrected to recognize this Android version before
  accepting any samples. Default mode still requires the target app foreground.
- CogVest restored to foreground; synthetic data and release APK remain installed.

Next, inspect the local trace and establish a healthy emulator/native-control
baseline (or a physical-device comparison if the owner wants one). Only then
attribute remaining excess chart cost and compare one targeted optimization
against the same baseline. Performance remains unverified, not fixed.

Reproduce from the repo root after positioning and checking the intended screen:

```powershell
./scripts/measure-android-frames.ps1 -Mode ranges -Label repeat-ranges -RangeX 202,413,624,835 -RangeY 1494
./scripts/measure-android-frames.ps1 -Mode scroll -Label repeat-chart-scroll
# Open native Android Settings first; never run coordinate probes blindly.
./scripts/measure-android-frames.ps1 -Mode scroll -Label repeat-native-scroll -Package com.android.settings
```

Method guidance: [Android performance measurement](https://developer.android.com/topic/performance/measuring-performance)
and [Perfetto system tracing](https://perfetto.dev/docs/getting-started/system-tracing).
