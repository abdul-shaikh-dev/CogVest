# Cached navigation performance follow-up

Date: 1 October 2026. References: #138, #299, merged PR #461.
This supplements, rather than rewrites, the earlier large-portfolio report.

## Scope and environment

Baseline: main `4a03578ca1f3bd366bfe5e1903008a065361c352` (PR #461).
The only production change is lazy reuse of fixed-locale number/date formatter
instances. Values are not cached; normalization, currencies, rounding, UTC date
semantics and financial calculations are unchanged. No dependencies or schemas
changed. Each formatter is created on first use, avoiding eager startup work.

Same synthetic-only `CogVest_Perf` AVD, emulator-5554, API 36, Android 36.1 Google
Play x86_64 image, four CPUs, 2 GB RAM, 6 GB userdata, 1280x2856, density 480,
font scale 1.0, host GPU. NVIDIA RTX 4060 Ti / driver 596.36 as recorded in the
earlier report. Existing user AVDs were not modified. The emulator's Android
foreground activity was verified; host-window visibility/occlusion was not
independently confirmed.

Data preserved across APK replacement: 250 assets/openings, 1,000 trades,
93 monthly snapshots (January 2019 through September 2026), ten daily caches
with 3,653 observations each. Native version 1.0.12 / code 13, non-debuggable
standalone x86_64 release, private local QA signing identity, opt-in heartbeat
probe enabled. Not a distribution build. No Metro or reverse connection needed.

Baseline APK SHA256:
`811922E6F3FADA035577BA330F3E56D4A6B599CE2D98B7714D85E65A817D6732`

Fixed APK SHA256:
`74681774809C814D2F991490A26557738E6B1332E2F078DEC820DCCB0D9D990D`

Build, test and Maestro workers completed before timing samples. Gradle daemon
was stopped. Raw traces/screenshots remain local under `.expo/performance/`;
native-control counters are under `.expo/frame-probes/cached-nav-native-control/`.

## Findings and measurements

Holding rows repeatedly construct identical Intl formatters for exact values
and accessibility labels. The regression test exercises 750 rows and confirms
only three NumberFormat constructions (plain INR, currency INR, currency USD)
and one DateTimeFormat construction, instead of constructing each per call.

Before the change, four Dashboard/Holdings round trips in a 20-second Perfetto
capture produced heartbeat maxima 1,460.92 / 1,378.82 / 1,362.89 ms. After the
change, the same tap cadence produced 563.04 / 466.27 / 437.60 / 438.42 ms.
These are timer/event-loop delays, not pure JavaScript execution durations.
The 563 ms sample is retained: the under-500-ms gate is **not fully passed**.

| Trace metric | Before | After |
| --- | ---: | ---: |
| JavaScript thread CPU | 10,637.3 ms | 3,604.7 ms |
| HeapTaskDaemon CPU | 2,981.5 ms | 167.2 ms |
| RenderThread CPU | 507.2 ms | 485.7 ms |
| DrawFrames mean (120 samples each) | 21.67 ms | 22.17 ms |
| dequeueBuffer mean | 17.32 ms | 17.88 ms |
| eglSwapBuffersWithDamageKHR mean | 18.43 ms | 19.15 ms |

This supports substantial removal of app-side work, not a universal speedup
ratio. Nested rendering phases overlap and must not be added together. Buffer
waits did not improve with the formatter fix; app CPU and frame pacing are
different outcomes.

Three cached Dashboard revisit captures completed 932 / 829 / 835 ms after
the injected tab tap, including a deliberate 400 ms pause, screencap and pull.
All three inspected images show the populated Dashboard: INR 10.29L portfolio,
INR 8.42L invested, INR 1.87L gain, +22.24%. The previous three captures still
showed Holdings at similar times. The new samples meet the one-second
device-framebuffer visibility gate; they are upper bounds, not exact TTI or
host-window presentation latency, and do not prove every revisit is under 1 s.
Files: `revisit-fixed-1.png` through `revisit-fixed-3.png`.

Cold captures completed 2,154 / 2,204 / 2,242 ms after launch invocation,
including 1,200 ms deliberate waits. All show populated Dashboard values;
the second still shows a small transition offset. This is populated-frame
evidence below 3 s, not proof of fully settled animation or touch readiness.
Files: `cold-fixed-1.png` through `cold-fixed-3.png`.

## Native control and remaining limits

Three native Android Settings scroll runs, same display and script:

| Run | Frames | Janky frames | P95 |
| --- | ---: | ---: | ---: |
| 1 | 333 | 326 (97.90%) | 61 ms |
| 2 | 336 | 331 (98.51%) | 61 ms |
| 3 | 330 | 317 (96.06%) | 65 ms |

The Settings scroll area was inspected before measurement and its post-run
screenshot inspected afterward. This is still an unhealthy native control.
Do not claim chart smoothness or attribute the remaining misses solely to
CogVest. #299 stays open for healthy visible-window/presentation control and
reliable attribution. #138 stays open for full journey stall coverage and
remaining performance acceptance. No budget was relaxed. TalkBack excluded.

## Verification

- `npm run test:v1:pc`: typecheck, 1,898 tests / 184 suites passed; three tests
  and one suite intentionally skipped; Expo Doctor 17/17; Android readiness
  and strict installed-package smoke passed.
- Fresh local `assembleRelease`, followed by `adb install -r`; fixture preserved.
- `npm run maestro:test -- e2e/visual/scale-verify.yaml` passed against that APK:
  release seed route blocked, 250 market positions, asset 001 quantity 15,
  ten-year daily chart present, all-month chart January 2019 to September 2026.
- Inspected fresh daily/monthly screenshots and all six timing screenshots.
  Daily view retained synthetic cached prices with the expected provider 404
  warning for the synthetic symbol; no claim of successful live quote fetching.
- Owned diff reviewed for currency cross-contamination, rounding/sign changes,
  invalid-date recovery, stale financial values and eager initialization.
- Initial sandbox Maestro launch failed accessing its profile log directory;
  retry with that access passed. A sandbox Gradle stop command attempted an
  unavailable wrapper download; the existing build environment stopped the
  daemon successfully. Neither failure was an application failure.

## Reproduction

Use the fixture/build procedure in the earlier report. Confirm current native
tab bounds before using these coordinates: Dashboard `[0,2647][256,2820]`,
Holdings `[256,2647][512,2820]`. Start on Holdings with no search/detail modal.

```powershell
adb logcat -c
adb shell perfetto -D -t 20s -b 32mb -o /data/misc/perfetto-traces/cached-nav.perfetto-trace sched freq gfx view input
for ($run=1; $run -le 4; $run++) {
  adb shell input tap 128 2734
  Start-Sleep -Seconds 2
  adb shell input tap 384 2734
  Start-Sleep -Seconds 2
}
Start-Sleep -Seconds 5
adb pull /data/misc/perfetto-traces/cached-nav.perfetto-trace .expo/performance/cached-nav.perfetto-trace
python .expo/trace_processor query -f scripts/analyze-android-rendering.sql .expo/performance/cached-nav.perfetto-trace
adb logcat -d -s ReactNativeJS:I
```

For each revisit: navigate to Holdings, wait two seconds, start a Stopwatch,
tap Dashboard, wait 400 ms, `adb shell screencap -p`, `adb pull`, stop timer;
inspect the resulting image. For cold capture: force-stop, start timer,
`am start -W`, wait 1,200 ms, capture/pull and inspect. ActivityManager timings
alone are not the readiness assertion.

```powershell
adb shell am start -a android.settings.SETTINGS
# Inspect actual scroll bounds first; then:
./scripts/measure-android-frames.ps1 -Mode scroll -Label cached-nav-native-control -Package com.android.settings -ScrollX 640 -TopY 1100 -BottomY 2200 -Runs 3
```
