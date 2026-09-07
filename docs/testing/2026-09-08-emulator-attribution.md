# Emulator Rendering Attribution

Follow-up to #299 and the [release investigation](2026-09-08-release-performance.md).
Repository base: `9fea9a4`. No production app code or AVD configuration changed.

## Finding

The retained CogVest trace spends most render-frame wall time waiting for a
buffer, not executing JavaScript. Native Android Settings remains similarly
slow. This supports a shared rendering/presentation bottleneck, but does not
identify a particular driver bug or certify app performance. Keep #299 open.

The official Perfetto v58.2 Windows reader was downloaded through
`https://get.perfetto.dev/trace_processor`. Analysis was entirely local; no trace
or crash report was uploaded, and no project dependency was added.

Run [the reusable SQL](../../scripts/analyze-android-rendering.sql) with:

```powershell
python .expo/trace_processor query -f scripts/analyze-android-rendering.sql .expo/cogvest-scroll.perfetto-trace
```

Results are restricted to CogVest. Across 345 render-frame samples:

| Phase | Mean wall time | Maximum |
| --- | ---: | ---: |
| DrawFrames | 32.62ms | 35.63ms |
| eglSwapBuffersWithDamageKHR | 30.79ms | 34.30ms |
| dequeueBuffer | 29.64ms | 33.67ms |

These phases are nested; do not sum them. Recorded CPU time was 929.8ms on
RenderThread, 480.4ms on the main thread, and 315.6ms on `mqt_v_js`.
RenderThread additionally spent 10,428.7ms sleeping versus 265.2ms runnable but
not running. This is not a JS flamegraph or proof that no JS bottleneck exists.
The local trace identity is recorded in the preceding report.

## Reversible Experiments

Same native Android Settings scroll probe, six gesture pairs per run; no
build/test workers running. Original screen: 1280x2856, density 480, 60Hz.
Emulator 36.5.11.0 / build 15261927; WHPX check passed. GPU auto selected the
NVIDIA RTX 4060 Ti host path. Window and cold-boot changes introduce confounders,
so these experiments exclude fixes rather than establish precise rankings.

| Condition | Runs | Missed frames | P95 |
| --- | ---: | --- | --- |
| Original, before resolution test | 1 | 98.79% | 61ms |
| 960x2142 / density 360 | 3 | 98.77%, 98.78%, 98.77% | 61ms each |
| Original, restored resolution | 1 | 98.46% | 61ms |
| Cold boot, auto GPU | 2 | 81.29%, 77.27% | 73ms each |
| Cold boot, window explicitly restored/activated | 2 | 82.82%, 82.21% | 73ms, 77ms |
| Software GPU (`swangle`), visible window | 2 | 84.62%, 85.49% | 89ms, 85ms |

The lower resolution preserved logical dimensions and scaled gesture coordinates
by 0.75. Size and density overrides were reset afterward. Cold boots used
`-no-snapshot-load -no-snapshot-save`, not wipe-data. Backend changes were launch
flags only. The software window was visible, but Windows rejected the foreground
request; do not call it a perfectly matched foreground comparison.

The software launch logged a missing `opengl32sw` module with a fallback and
paused on an emulator crash-report consent dialog. **Don't send** was selected.
Boot subsequently completed and SurfaceFlinger confirmed Google SwiftShader.
The original renderer was restored after testing; a first restoration attempt
hit a still-exiting emulator lock and was retried after that process exited.
No lock files were deleted. Logs also warn about unsupported VulkanVirtualQueue;
that warning is a lead, not a demonstrated cause of the measured buffer waits.

## Evidence And Decision

Filtered trace results and native frame counters are in
[the artifact directory](artifacts/2026-09-08-attribution/). Only trailing
whitespace is normalized; the original trace and emulator logs remain local.
SQL executed successfully against the retained trace. This is an analysis/docs
change, not a new APK implementation. The installed release baseline and
synthetic data were preserved. The prior full-test teardown blocker is #300;
this investigation does not claim to fix that gate.

After restoration, strict installed-app smoke passed; the installed APK hash
still matched `3861E1905928203518A2DA1C7B39DCE43D1B8D94AB229D2FAE3E4DB278E697D9`.
The native hierarchy confirmed Progress and its retained August 2026 summary.
No full Jest rerun was needed for the SQL/documentation-only changes; the
existing #300 failure remains explicitly unresolved.

Do not switch production chart libraries or permanently enable software
rendering on this evidence. Next: test a separate AVD or a validated emulator/
system-image update, with the native Settings control first. Obtain owner
approval before installing/upgrading SDK components or replacing their AVD.
Only optimize app rendering after a healthy control or stronger app-specific
trace attribution is available. Physical-phone testing remains optional.

References: [Perfetto reader](https://github.com/google/perfetto/blob/main/docs/analysis/trace-processor.md)
and [Android emulator acceleration](https://developer.android.com/studio/run/emulator-acceleration).
