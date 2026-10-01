# Visible-window rendering control

Issue #299 follow-up after PR #463. Main:
`c49ecb2081791ad65a7763ece2a0a69ef4c95c94`. No application behavior changes.

## Setup and safety

User agreed to proceed after the request to keep the emulator visible and
unminimized. These are user-assisted visible-window samples, not instrumented
proof that the host window remained unobscured throughout. Android foreground
activity and native control bounds were checked before measurement.

CogVest_Perf, emulator-5554, Android 36.1 Google Play x86_64 / API 36, emulator
36.5.11.0, four CPUs, 2 GB RAM, 6 GB userdata, 1280x2856, density 480, font 1.0,
reported display refresh 60 Hz. Host renderer: NVIDIA RTX 4060 Ti, driver
596.36, GLES 3.1. Temporary comparison: Google SwiftShader, GLES 3.0.

Rebuilt and installed standalone non-debuggable main, private local QA signing,
version 1.0.12/code13, opt-in heartbeat enabled. SHA256 remains:
`86A4E1270FB784CB654AF545FAC97B37ECD5A280A43DA6515C1D73D9DDFE2297`.
Build/test/Maestro workers completed before samples; Gradle daemon stopped.

Only this synthetic AVD was restarted; no wipe, image swap, driver installation,
resolution change or budget change. Renderer selected by launch flag, not a
persisted configuration edit. Restored `-gpu host` and verified NVIDIA GLES
afterward. User's other AVDs and portfolio files were not touched.

## Native control

Same six up/down Settings scroll pairs per run, X=640, Y=1100..2200, 450 ms
gesture and 350 ms pauses. Native scroll bounds `[0,336][1280,2856]`.

| Mode/run | Frames | Janky | P95 |
| --- | ---: | ---: | ---: |
| Visible host 1 | 322 | 94.10% | 65 ms |
| Visible host 2 | 343 | 97.67% | 65 ms |
| Visible host 3 | 336 | 98.51% | 65 ms |
| SwiftShader 1 | 270 | 68.89% | 77 ms |
| SwiftShader 2 | 325 | 66.77% | 69 ms |
| SwiftShader 3 | 287 | 64.46% | 77 ms |
| Restored host, traced | 332 | 96.99% | 57 ms |

Neither backend establishes a healthy control. The software comparison changes
the backend and requires a cold emulator boot, so do not treat the difference
as a normalized performance gain. Post-run Settings screenshots inspected.

## CogVest samples on restored host renderer

Monthly ranges 3M/6M/1Y/All, three cycles per run, 700 ms pauses. Bounds measured
before and after: X centers 202/413/624/836, Y=1428; final All selection verified.

| Journey/run | Frames | Janky | P95 |
| --- | ---: | ---: | ---: |
| Range 1 | 236 | 57.63% | 61 ms |
| Range 2 | 240 | 30.00% | 61 ms |
| Range 3 | 238 | 84.87% | 65 ms |
| Progress scroll 1 | 336 | 98.81% | 57 ms |
| Progress scroll 2 | 353 | 97.73% | 61 ms |
| Progress scroll 3 | 328 | 90.55% | 93 ms |

Range-run heartbeat maxima: 282.36 / 285.44 / 309.59 / 299.68 / 281.47 /
283.94 ms. This timer diagnostic is not a frame-smoothness assertion.
Twenty-second range trace: JS CPU 9,122.7 ms, RenderThread CPU 1,186.4 ms;
482 DrawFrames samples, mean 14.56 ms, mean dequeueBuffer 12.07 ms.
The trace covers the beginning of the range runs, not their entire duration.

## FrameTimeline attribution

Extended `scripts/analyze-android-rendering.sql` to summarize FrameTimeline
classifications for CogVest, Settings and SurfaceFlinger, excluding unrelated
processes. Validated the query on both new traces. App counts are surface
slices; compositor counts are display slices, and must not be added together.
Multiple classifications can apply to one slice.

- Restored native control: 350 of 354 Settings slices include SurfaceFlinger
  CPU Deadline Missed; only five include App Deadline Missed, all overlapping
  compositor misses. SurfaceFlinger has 351 CPU-deadline misses of 356 slices.
- CogVest ranges: 265 of 480 app slices include compositor CPU-deadline misses;
  95 include app-deadline misses, with 79 overlapping. 188 other app slices
  have Prediction Error / Early Present. SurfaceFlinger has 265 CPU-deadline
  misses, 215 prediction errors and 19 dropped slices.

This is stronger evidence of a shared presentation-path problem than aggregate
jank percentages alone, but does not exonerate CogVest: app misses also exist.
It does not identify a particular Windows, GPU-driver or emulator defect.
The healthy-control requirement remains unmet; **keep #299 open**. Next useful
step is a physical Android device or a host with a healthy matched native
control, not another speculative chart-library change. #138 remains open too.

Interpretation follows [Perfetto FrameTimeline documentation](https://perfetto.dev/docs/data-sources/frametimeline).
Backend selection follows [Android emulator acceleration guidance](https://developer.android.com/studio/run/emulator-acceleration)
and the installed emulator's `-help-gpu`. Raw system traces remain local; only
filtered aggregates are published.

## Verification and reproduction

`npm run test:verify`: 1,900 tests / 185 suites pass; three tests and one suite
intentionally skipped; typecheck and Expo Doctor 17/17 pass. Android doctor and
strict smoke pass after restoration. Fresh-APK Maestro scale verification
passes: 250 holdings, asset 001 quantity 15, ten-year daily cached chart, 93
monthly snapshots through September 2026. Screenshots inspected; synthetic
symbols retain their expected provider failure warning. No live-price claim.

Use existing `measure-android-frames.ps1` after native bounds inspection:
labels `visible-host-settings`, `visible-swift-settings`,
`visible-host-restored-settings`, `visible-host-monthly`,
`visible-host-progress-scroll`. Raw counters are `.expo/frame-probes/<label>/`.

Capture `perfetto -D -t 20s -b 32mb -o <device-path> sched freq gfx view input`,
wait for completion, pull and analyze with:

```powershell
python .expo/trace_processor query -f scripts/analyze-android-rendering.sql .expo/performance/visible-monthly.perfetto-trace
python .expo/trace_processor query -f scripts/analyze-android-rendering.sql .expo/performance/visible-native.perfetto-trace
```

Rendering comparison launch flags: `-avd CogVest_Perf -no-snapshot -gpu host`
versus `-gpu swiftshader`, with ANDROID_AVD_HOME set to the workspace synthetic
AVD directory. First software start collided with the old shutdown lock;
waiting for process exit resolved it. First host restoration exited during
boot without an established cause; retry booted successfully and data checks
passed. These are retained environmental failures, not app failures.

No TalkBack, cloud build, release, schema or portfolio mutation work performed.
