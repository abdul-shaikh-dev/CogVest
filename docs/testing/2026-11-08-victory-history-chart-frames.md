# Holding history chart on Victory Native: S23 FE frames

Recorded 8 November 2026 for #138, on branch `feat/asset-history-victory`
(commit `68a43e1`). Synthetic data only. This is the after-measurement for the
10-year hitch found in [the S23 FE rendering control](2026-11-08-s23fe-rendering-control.md).

## Device and build

- Samsung Galaxy S23 FE (SM-S711B), Android 16, arm64-v8a, USB. Density
  override 384, font scale 0.9, dark mode, adaptive 60/120 Hz: unchanged from
  the control run.
- e2e variant, arm64-v8a, R8 on. APK SHA-256
  `21e7bd9803318419c7a6dd801f410aae493f94dd22e12afd4169d96366cc9ca1`,
  60.5 MB (adds Skia's native library).
- Only `com.abdulshaikh.cogvest.e2e` was installed over the existing e2e app;
  the owner's production app was not touched.
- Same method as the control: `scripts/measure-android-frames.ps1 -Mode ranges`
  on the holding opened by `e2e/visual/scale-daily-ready.yaml`, range chips
  3M/1Y/5Y/10Y at x 229/364/498/634, y 1063. Three invocations of three runs.

## Result

| Holding 10-year chart, ranges 3M/1Y/5Y/10Y | Janky | P95 | P99 |
| --- | --- | --- | --- |
| Before: Gifted Charts (control run) | 5.23 – 6.42% | 10 – 11 ms | 81 – 117 ms |
| After: Victory Native, 9 runs | 1.02 – 2.25% | 6 – 7 ms | 8 – 10 ms |

The per-switch long frame is gone. Two causes were removed together: the
renderer (Gifted Charts mounted a label tree per point; Skia draws one path)
and two app-side costs measured on the control build: an empty render on every
range switch before the cached range arrived, and an unmemoised history
rebuild of about 30 ms per render.

## Interaction checks on the phone

- Press and hold, then drag: the readout followed the finger and release kept
  the selection.
- On the first build a one-finger drag on a zoomed chart was taken by the pan
  instead of the inspection. Fixed in `c163e6e`: one finger inspects, two
  fingers zoom and pan. Pinch, two-finger pan and Reset zoom on the fixed build
  still await a hands-on check (Samsung blocks injected multi-touch).

Not covered: Progress charts on device (moved to Victory in `0f2c76f`, verified
in Jest only at the time of writing), TalkBack, and 60 Hz-only displays.
