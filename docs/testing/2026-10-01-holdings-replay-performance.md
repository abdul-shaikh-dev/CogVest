# Holdings replay performance follow-up

References: #138 and #299. Baseline is merged PR #462, main
`d8730ac9f4f2d35611766d74691cf0a20842312d`. Earlier evidence reports remain unchanged.

## Change and correctness

Holdings previously replayed every transaction on tab focus/blur and local UI
updates. Reuse the derived financial view only while assets, openings, trades,
quotes, PPF accounts, PPF entries and local calendar date are unchanged.
Quote freshness remains outside that memo and uses the actual observation time.
No new persisted data, dependencies, schema or financial formula changes.

Replay now explicitly receives the same accounting date as the hook's other
calculations. Previously the injected `now` was omitted from that call, allowing
PPF and holdings to use different dates in historical/test observations. The
production default remains today's local calendar date. The memo changes only
on render; it does not add a midnight timer or freshness polling.

Tests verify reuse at scale, invalidation for every financial collection, quote
value updates, backup replacement clearing prior values, same-day freshness
expiry, and future transactions becoming effective on date rollover. Existing
demerger and quote refresh hook tests pass. Owned-diff review checked all memo
dependencies, date precision, restore and immutable-store assumptions.

## Environment and verification

Same synthetic-only CogVest_Perf / emulator-5554: API 36, Android 36.1 Google Play
x86_64, four CPUs, 2 GB RAM, 6 GB userdata, 1280x2856, density 480, font 1.0,
host GPU. SurfaceFlinger reports 60 Hz. User's other AVDs/data untouched.
Host-window visibility was requested but not confirmed during these samples.

Fresh QA-signed, non-debuggable standalone x86_64 release, version 1.0.12/code13,
with opt-in heartbeat diagnostic; no Metro required. APK SHA256:
`86A4E1270FB784CB654AF545FAC97B37ECD5A280A43DA6515C1D73D9DDFE2297`.

Preserved fixture: 250 assets/openings, 1,000 trades, 93 monthly snapshots,
ten 3,653-point daily histories. Builds, tests and Maestro finished before
measurements; Gradle daemon stopped. No cloud build, release or TalkBack test.

`npm run test:v1:pc` passed: 1,900 tests / 185 suites; three tests and one suite
intentionally skipped; typecheck, Expo Doctor 17/17, Android readiness and strict
smoke passed. Fresh-APK `e2e/visual/scale-verify.yaml` passed: release seeding
blocked, 250 positions, asset 001 quantity 15, daily ten-year chart, monthly
January 2019 to September 2026. Inspected daily/monthly screenshots and three
Dashboard captures. Synthetic daily symbol retains its expected provider 404
warning and cached chart; this is not successful live quote verification.

## Navigation evidence

Same four Dashboard/Holdings round trips and 20-second Perfetto capture as the
previous report, then eight further round trips without tracing. Native tab
bounds verified before coordinates were used. Raw files remain local in
`.expo/performance/`.

| Metric | PR #462 baseline | This change |
| --- | ---: | ---: |
| JS CPU in trace | 3,604.7 ms | 2,407.6 ms |
| HeapTaskDaemon CPU | 167.2 ms | 128.7 ms |
| RenderThread CPU | 485.7 ms | 477.8 ms |
| Mean DrawFrames, 120 samples | 22.17 ms | 21.90 ms |
| Mean dequeueBuffer | 17.88 ms | 17.88 ms |

Heartbeat window maxima during traced cycles: 323.23 / 315.32 / 297.98 /
280.89 ms. Eight additional round trips: 282.01 / 289.18 / 264.55 / 275.49 /
270.90 / 270.83 / 241.45 / 279.72 ms. No recorded foreground heartbeat delay
exceeded 500 ms in these samples; baseline maximum was 563.04 ms. This is an
event-loop timer diagnostic, not pure JS execution or a guarantee for every
journey, initial mount, data mutation or device.

Three populated Dashboard screenshots completed within 855 / 903 / 856 ms of
tab injection, including a deliberate 400 ms pause and capture/pull overhead.
All inspected images show INR 10.29L value, INR 8.42L invested, INR 1.87L gain,
+22.24%. These retain the sampled under-one-second framebuffer visibility
result, not exact TTI or host-window latency. Files: `replay-revisit-1.png`
through `replay-revisit-3.png`. Crash log buffer was empty after these samples.

## Rendering remains unresolved

Native Settings scroll control, same measured scroll bounds/cadence:
316 frames / 85.76% janky / P95 65 ms; 336 / 97.62% / 57 ms;
333 / 98.80% / 61 ms. Post-run screenshot inspected. A 20-second native trace
covers the beginning of those runs, not all three: 562 DrawFrames samples,
mean 32.37 ms, mean dequeueBuffer 29.06 ms, mean swap 30.61 ms. Nested phases
overlap and must not be summed. Settings RenderThread CPU totals 1,884.2 ms
across two threads, main CPU 429.1 ms.

Substantial native buffer waits support a presentation-path investigation,
not blaming chart calculations alone. They do not identify the exact host,
compositor or GPU cause. #299 still needs a confirmed visible/unoccluded window
and healthy matched control. No smoothness claim or budget relaxation. #138
remains open for the wider performance acceptance work.

## Reproduce

Use the previous cached-navigation report's build, seed, tap and capture
commands, with trace names `holdings-replay-after` and screenshots
`replay-revisit-*`. Repeat eight round trips at the same two-second cadence.
Analyze app trace with `scripts/analyze-android-rendering.sql`.

For native control, start Android Settings, inspect scroll bounds, start a
20-second Perfetto trace named `native-replay-control`, then run:

```powershell
./scripts/measure-android-frames.ps1 -Mode scroll -Label holdings-replay-native-control -Package com.android.settings -ScrollX 640 -TopY 1100 -BottomY 2200 -Runs 3
$query=(Get-Content scripts/analyze-android-rendering.sql -Raw).Replace('com.abdulshaikh.cogvest','com.android.settings')
$query | python .expo/trace_processor query .expo/performance/native-replay-control.perfetto-trace
```

The direct positional SQL attempt treated leading SQL comments as CLI flags;
piping SQL via stdin succeeded. This was a tooling invocation failure, not an
app failure. Initial new restore test omitted the required revision/payload
wrapper; it was corrected and both focused and full verification passed.
