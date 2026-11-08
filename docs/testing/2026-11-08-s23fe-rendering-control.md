# Physical-device rendering control: Galaxy S23 FE

Recorded 8 November 2026 for #299 and #138, on main `70d7f6d`. Synthetic data
only. This is the healthy native control that the emulator reports
([2026-10-01](2026-10-01-visible-rendering-control.md)) could not provide.

## Device and safety

- Samsung Galaxy S23 FE (SM-S711B), Android 16, arm64-v8a, connected by USB.
- Display 1080x2340. Density override 384 (physical 450), font scale 0.9 and
  dark mode, all left as the owner set them.
- Adaptive refresh rate: 60 Hz idle and 120 Hz during interaction. A 120 Hz
  frame budget is 8.3 ms. Battery saver off.
- Only the separate e2e package `com.abdulshaikh.cogvest.e2e` was installed,
  seeded with `e2e/visual/scale-prepare.yaml`, then uninstalled afterwards.
  The owner's production CogVest app was not opened, installed over or read;
  its last update time was unchanged (1 November). "Stay awake while charging"
  was on during the runs and was restored to off.
- Build: e2e variant, arm64-v8a, R8 on. APK SHA-256
  `ed474d7f51be8460e1dca44ebf970c4bf349b66980c886df80d293aa5cbb57e1`.
- Method: `scripts/measure-android-frames.ps1` with coordinates scaled to this
  display and three runs per journey. Settings and the scroll journeys used six
  up/down pairs per run. The range journeys used three cycles through four
  ranges with 700 ms pauses. Maestro was stopped during samples.

## Results

`gfxinfo` with the current jank definition. Each cell lists runs 1 / 2 / 3.

| Journey | Frames | Janky | P95 | P99 |
| --- | --- | --- | --- | --- |
| Settings scroll (native control) | 1,392 / 1,443 / 1,959 | 0.65 / 0.35 / 0.36% | 8 / 8 / 8 ms | 10 / 9 / 12 ms |
| Progress scroll | 1,274 / 1,310 / 1,284 | 0.24 / 0.00 / 0.16% | 10 / 6 / 6 ms | 10 / 6 / 6 ms |
| Holdings scroll (250 rows) | 1,297 / 1,312 / 1,308 | 0.31 / 0.46 / 0.23% | 10 / 9 / 9 ms | 12 / 10 / 11 ms |
| Progress ranges 3M/6M/1Y/All | 1,067 / 1,065 / 1,137 | 4.03 / 6.76 / 4.57% | 14 / 16 / 13 ms | 24 / 23 / 21 ms |
| Holding 10-year chart, ranges 3M/1Y/5Y/10Y | 555 / 592 / 572 | 5.23 / 6.42 / 5.42% | 11 / 10 / 11 ms | **81 / 113 / 117 ms** |

The emulator comparison, from 1 October: Settings scroll 94–99% janky, P95
57–65 ms.

The final screen state was checked after the runs: All selected on Progress,
10Y selected with the chart drawn on the holding, and the 250 synthetic rows on
Holdings. The holding showed "Yahoo historical request failed with status 404",
which is expected for a synthetic ticker; the chart draws from the seeded cache.

## FrameTimeline attribution: Progress ranges

A 30-second Perfetto trace covered three range cycles: FrameTimeline, gfx,
view, input and sched. It was analysed with
`scripts/analyze-android-rendering.sql`, with the package name changed to the
e2e app. `gfxinfo` for the traced window: 1,267 frames, 3.08% janky, P95 16 ms.

- SurfaceFlinger: 972 of 1,271 display slices presented on time. 286 were
  "SurfaceFlinger Stuffing" and only 11 were CPU-deadline misses. The emulator
  had 351 of 356. The compositor is healthy.
- CogVest: 32 slices with App Deadline Missed and 40 dropped frames. Most of
  the rest are "Buffer Stuffing" (the app queues frames ahead of the display),
  which adds latency, not visible jank.
- CPU over the trace: JS thread 6.6 s, main thread 6.4 s and RenderThread
  4.1 s. DrawFrames averaged 3.29 ms (maximum 15.3 ms) and dequeueBuffer
  0.23 ms, against 12.07 ms on the emulator.

## Conclusions

1. **Measurement validity is resolved.** The native control is healthy, so
   these numbers measure CogVest, not the host. The emulator's frame data
   should not be used for smoothness claims.
2. **Scrolling is smooth.** Progress and Holdings, the latter with 250 rows,
   match or beat the native Settings control.
3. **Chart range changes cause a small number of app-side misses.** About
   4–7% of frames are janky during repeated range taps, attributed to app work
   (JS and render) rather than the compositor. On Progress the worst frames are
   21–24 ms, about two or three refreshes at 120 Hz.
4. **The holding's 10-year chart has a visible hitch per range switch.** Its
   P99 is 81–117 ms: roughly one long frame each time 5Y or 10Y is drawn from
   up to 500 sampled daily points. This is the clearest optimisation target.
   It was not optimised here, because #299 owned attribution first.

Not covered: TalkBack, other devices, and 60 Hz-only displays. The raw traces
and `gfxinfo` dumps stay local; only these aggregates are published.

## Reproduction

```bash
adb -s <serial> install app-e2e.apk
maestro --device <serial> test -e APP_ID=com.abdulshaikh.cogvest.e2e -e SCHEME=cogvest-e2e e2e/visual/scale-prepare.yaml
```

```powershell
$env:ANDROID_SERIAL = '<serial>'
.\scripts\measure-android-frames.ps1 -Mode scroll -Label s23-settings-control -Package com.android.settings -ScrollX 540 -TopY 700 -BottomY 1900
.\scripts\measure-android-frames.ps1 -Mode ranges -Label s23-progress-ranges -Package com.abdulshaikh.cogvest.e2e -RangeX 149,340,532,724 -RangeY 1058
```

Range-chip coordinates come from `uiautomator dump`, using the
`portfolio-monthly-chart-range-*` and `asset-history-range-*` testIDs. Measure
them again on any other display.
