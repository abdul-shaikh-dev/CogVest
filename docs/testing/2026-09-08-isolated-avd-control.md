# Isolated AVD Rendering Control

Issue #299 follow-up to [rendering attribution](2026-09-08-emulator-attribution.md).
Repository base: `54681ec`, after the #300 lifecycle fix. No app code changed.

## Decision

A new AVD with fresh data and ample free storage still exhibits heavy native
Settings frame misses. Disabling Vulkan for a separate cold boot does not
establish a healthy control either. Do not interpret these runs as an app
optimization result or claim CogVest is smooth. Keep #299 open.

Next useful comparison: a separate Android 15 / API 35 system image, using the
same native control before testing CogVest. Only Android 16.1 is installed.
Installing another image or upgrading SDK/emulator components requires owner
approval; neither was done here. The existing AVD must not be replaced or wiped.

## Method

- Created a disposable `CogVest_Render_Control` AVD under ignored
  `.expo/isolated-avd/`, using the already-installed Android 16.1 Google Play
  x86_64 image. No account, CogVest installation, or portfolio data was added.
- Matched the original screen at 1280x2856, density 480, 60Hz, 2GB RAM,
  four virtual CPU cores, auto GPU, and Pixel 10 Pro skin. Same emulator binary
  and host renderer as the preceding report. SurfaceFlinger confirmed host
  OpenGL ES translation in both graphics conditions.
- Original AVD was stopped during isolated measurements. Its Settings UI
  reported 93% storage used and about 544MB free. The disposable AVD's `df -h
  /data` reported 31GB total, 884MB used, and 30GB available.
- Both launches used cold boot with no snapshot loading/saving. The second
  additionally used `-feature -Vulkan`; this was a launch flag, not a saved
  configuration change. First boot took longer than an existing-AVD cold boot.
- Initial launch blocked on crash reporting. Desktop control was unavailable
  (`Computer Use native pipe is unavailable`). Retried with documented
  `-crash-report-mode never -no-metrics` flags. No report was sent, and no
  persistent reporting preference was changed. A later graphics-mode restart
  hit the still-exiting AVD lock and succeeded after process exit; no locks were
  deleted.
- Verified native Settings visually before measuring. Ran one warm-up and
  then three measured runs per condition using the existing frame probe:
  six up/down pairs, x=640, y=2200 to 1100, 450ms gestures, 350ms pauses.
  Each run reset gfxinfo. No build, Jest, Maestro, screenshot capture, or other
  task workload ran during the six measured samples.
- Windows were launched with `Start-Process -WindowStyle Hidden`. Foreground
  activation was not established; host applications remained open and first-
  boot background work was not independently traced. These are diagnostic
  controls, not laboratory rankings or a matched visible-window experiment.

## Results

First aggregate gfxinfo block per run:

| Condition | Run | Frames | Missed frames | P95 |
| --- | ---: | ---: | ---: | ---: |
| Fresh AVD, auto GPU | 1 | 328 | 324 / 98.78% | 61ms |
| Fresh AVD, auto GPU | 2 | 329 | 322 / 97.87% | 65ms |
| Fresh AVD, auto GPU | 3 | 325 | 321 / 98.77% | 65ms |
| Same AVD, Vulkan disabled | 1 | 326 | 320 / 98.16% | 65ms |
| Same AVD, Vulkan disabled | 2 | 349 | 327 / 93.70% | 61ms |
| Same AVD, Vulkan disabled | 3 | 326 | 310 / 95.09% | 61ms |

Warm-ups are excluded: auto GPU 326 frames / 88.96% / 65ms; Vulkan disabled
346 frames / 84.39% / 65ms. A pre-isolation original-AVD check yielded 328 frames,
98.78%, and 61ms. Its second run overlapped a screenshot capture and is excluded.

Raw counters and probe metadata remain local under
`.expo/frame-probes/isolated-native-measured/` and
`.expo/frame-probes/isolated-novulkan-measured/`. Full emulator logs, disk images,
and screenshots were not published. The table preserves the measured counters.

To repeat after explicitly selecting and booting the intended AVD, with only
that emulator connected and native Settings foreground:

```powershell
powershell -NoProfile -File scripts/measure-android-frames.ps1 -Mode scroll -Label isolated-native-measured -Package com.android.settings -Runs 3
```

Use a new label to preserve an earlier capture. Do not compare the warm-up to
the measured runs as evidence of an improvement.

## Verification Boundary

The disposable AVD is stopped. Original `Pixel_10_Pro` is running again on
`emulator-5554`, with auto GPU, the original display mode, and retained August
2026 synthetic Progress data verified through the UI hierarchy. Strict Android
smoke passed. Installed APK SHA-256 remains
`3861e1905928203518a2da1c7b39dce43d1b8d94ab229d2fae3e4db278e697d9`.
Its saved AVD configuration and app data were not edited. The disposable files
remain ignored locally, not registered in the owner's normal AVD directory.

This follow-up stopped at the unhealthy native-control gate. No fresh CogVest
APK was built or installed and no new app-performance claim is made. No Jest
rerun is warranted for this evidence-only change; #300 is now closed, with its
merged PR recording two successful full verification runs.

References: [Android emulator command-line options](https://developer.android.com/studio/run/emulator-commandline),
[graphics acceleration](https://developer.android.com/studio/run/emulator-acceleration).
The installed emulator's `-help-all` documents the reporting flags; Vulkan-off
is a diagnostic experiment, not a recommended permanent workaround.
