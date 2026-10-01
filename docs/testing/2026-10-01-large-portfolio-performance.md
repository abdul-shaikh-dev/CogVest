# Large Portfolio Android Performance

Issues #138 and #299. User explicitly resumed #299 on 1 October 2026;
TalkBack verification is excluded from this work.

## Scope And Identity

- Base: `f9f858cea3c7028b870b43525c0d0916499ccfd3`, version 1.0.12 / code 13.
- Disposable `CogVest_Perf` AVD, Android API 36, Google Play x86_64 Android
  36.1 image, four virtual CPUs, 2 GB RAM, 1280x2856, density 480, font 1.0.
- Host GPU: Android Emulator OpenGL ES Translator, NVIDIA GeForce RTX 4060 Ti,
  NVIDIA 596.36, OpenGL ES 3.1. No display/font overrides. Window visibility
  and foreground presentation have not been independently established.
- Existing user AVD data was not reset or seeded. Initial native control used
  CogVest_UX_Proof; the matched control below used the fresh CogVest_Perf AVD.
- Current debug APK seeded synthetic records through an explicitly confirmed,
  development-token-only route. Upgraded in place to a local QA-signed,
  non-debuggable release APK; no Metro or reverse port during measurements.
- Baseline standalone SHA-256:
  `3BB8F6A89D46F4157A9DD229B6EDDED6F94857A79455D124F93577980BEB9198`.
- Progress-fix standalone SHA-256:
  `F7A8D51AD2CD332835B652F057388C7B2476B12630D857DED8134A9BCFCCE80D`.
- Final standalone, also including endpoint-only daily-label formatting:
  `811922E6F3FADA035577BA330F3E56D4A6B599CE2D98B7714D85E65A817D6732`.
- Expo prebuild stalled at native-directory discovery and was cancelled.
  Existing generated native configuration was used with release identity
  corrected to 1.0.12 / 13. Direct Gradle builds regenerated the JavaScript
  bundle and succeeded. No dependency, signing policy, permission, persistence
  schema, EAS workflow, or production release changes.

## Combined Fixture And Functional Evidence

`createAndroidScaleFixture` adapts the existing V3 fixture to the current date:
250 assets, 250 opening records, 1,000 transactions, 93 monthly snapshots
(January 2019 through September 2026), and ten daily cache entries of 3,653
points each, ending 30 September 2026. All completed months are present to
avoid automatic backfill requests for fictional providers. Snapshot values
are synthetic display inputs, not reconstructed historical investment returns.

Production backup validation and production daily-cache write/read tests pass.
The seed writes all ten entries through the actual MMKV cache before restoring
the portfolio through the production store transition. No network history is
fabricated as real provider evidence.

Maestro `scale-prepare.yaml` passed in the fresh debug installation.
`scale-verify.yaml` passed before and after the standalone fix; the final run
also asserts the complete January 2019 to September 2026 range. It verifies:

- Release blocks the seed route even with the correct token.
- 250 market positions persist across the upgrade and restart.
- Sampled asset 001 has 15 units, current price INR 150 and average cost INR
  100.05 (the latter two also visually inspected).
- Its 10Y cached daily chart and readout exist, rather than an empty chart.
- Monthly All range and its selected-value panel exist.

`scale-daily-ready.yaml` passes after waiting for Dashboard startup readiness.
Earlier preparation attempts failed because a retained holding-detail modal
hid the list, and then because a deep link was sent before startup navigation
completed. These were corrected in the measurement flow without clearing data.
This is sampled upgrade evidence, not a fresh full-payload equality proof.

The synthetic Yahoo identifier predictably returns HTTP 404 during remote
verification; cached price observations remain displayed. This run measures
cached chart behavior, not live-provider success or verified split-adjusted
holding-value reconstruction. Ten entries were seeded; only asset 001's daily
chart was visually exercised.

Screenshots inspected locally:
`.expo/performance/scale-daily-chart.png` and
`.expo/performance/scale-monthly-chart.png`. They contain synthetic data only.

## Focused Fix

Progress previously recalculated the entire holdings, PPF, cash and allocation
view on chart-range-only state changes. Cache this derived view by its actual
raw financial inputs and local calendar day, and cache monthly summaries by
the snapshot collection. Financial formulas and saved records are unchanged.

A scale regression test checks calculation reuse across both chart-range
changes and same-day rerenders, then checks quote replacement, a future trade,
next-day effectiveness, and replacement of the financial collections. Existing
Progress financial tests also pass. No blanket component memoization or chart
library replacement was introduced.

The observed-coordinate daily range retry exposed foreground heartbeat delays
of 690.32 / 740.83 / 425.73 / 657.56 / 448.28 ms. Inspection found date label
formatting for up to 500 chart points even though only two endpoints display a
label. The final APK formats only those endpoints; a ten-year regression test
checks two formatter calls per render, including selection changes. Source
values, sampling and visible labels are unchanged.

## Measurement Method

Build, test and Maestro workers completed before samples. Ordinary host apps
remained open; this is not a laboratory host-load guarantee. Frame samples use
the existing `measure-android-frames.ps1`, reset gfxinfo for each run, and retain
raw local output in `.expo/frame-probes/`. GPU histogram overflow counters are
not interpreted as real GPU durations.

Monthly range centers were verified in native hierarchy: X=201/412/624/835,
Y=1428. Each run has three cycles of 3M/6M/1Y/All with 700 ms pauses. Initial
baseline used X=198/398/623/840, Y=1424 within the same verified chip bounds.
Scrolling uses six up/down pairs at X=640, Y=2200/1100, 450 ms gestures and
350 ms pauses. A first list sample was discarded because navigation had not
settled on the list when its hierarchy was captured; only the verified-list
label below is interpreted.

The opt-in `EXPO_PUBLIC_COGVEST_PERFORMANCE_PROBE=1` local QA build reports
maximum positive delay of a 50 ms heartbeat in five-second windows. This is
event-loop/timer responsiveness, not pure JS execution duration, startup TTI,
or rendered-frame presentation. The probe has overhead; background-transition
windows must not be treated as foreground stalls. Ordinary builds do not start
the probe. Logs include only timing counters, not portfolio values.

## Frame Samples

| Workload | Frames (three runs) | Janky % (three runs) | P95 ms |
| --- | --- | --- | --- |
| Baseline monthly ranges | 193 / 194 / 202 | 15.54 / 21.13 / 81.19 | 36 / 65 / 65 |
| Fixed monthly ranges | 232 / 242 / 248 | 31.03 / 40.91 / 82.66 | 42 / 61 / 65 |
| Fixed verified Holdings list | 335 / 335 / 336 | 95.82 / 98.81 / 98.81 | 69 / 61 / 65 |
| Matched native Settings | 340 / 331 / 332 | 97.35 / 98.79 / 99.10 | 61 / 57 / 57 |

These frame counters do **not** demonstrate a frame-pacing improvement. Native
Settings also has severe misses, and the range-run variance remains high. Do
not claim smooth charts or waive the measurement-validity gate.

## Trace Attribution

Fresh 20-second Perfetto traces were captured with `sched freq gfx view input`
and analyzed with `scripts/analyze-android-rendering.sql` using official
Perfetto trace_processor v58.2. Raw traces stay ignored/local because system
traces can include unrelated process information. The SQL restricts output to
CogVest. Nested rendering phases overlap and must not be added together.

| Metric | Baseline ranges | Fixed ranges |
| --- | ---: | ---: |
| JS thread scheduled CPU | 11,543.1 ms | 9,408.2 ms |
| RenderThread scheduled CPU | 983.8 ms | 1,243.0 ms |
| DrawFrames samples | 395 | 492 |
| DrawFrames mean / max | 12.95 / 34.75 ms | 15.12 / 40.40 ms |
| dequeueBuffer mean / max | 10.39 / 31.84 ms | 12.47 / 33.25 ms |
| swap mean / max | 11.27 / 32.78 ms | 13.29 / 33.84 ms |

The fixed trace contains less JS CPU, consistent with eliminating unnecessary
portfolio recomputation. This is a diagnostic comparison, not a normalized
speedup benchmark: frame counts and workload progress within each trace differ.
Remaining buffer waits and unhealthy native control prevent attributing all
missed frames to CogVest or to one host component.

Retained September trace was also reanalyzed without editing historical reports:
JS CPU 315.6 ms, RenderThread CPU 929.8 ms, DrawFrames mean 32.62 ms,
dequeueBuffer mean 29.64 ms and swap mean 30.79 ms. It is a different historical
workload, not a current-main before/after comparison.

Foreground fixed monthly samples: maximum heartbeat delays
181.32 / 307.66 / 290.32 / 387.12 / 320.54 / 388.24 ms.
Verified list samples: 42.57 / 31.13 / 31.26 / 32.27 / 56.90 / 23.96 ms.
No foreground delay over 500 ms occurred in those recorded windows. This does
not establish that every navigation, initial chart build, or startup meets that
budget. Earlier baseline functional journeys included delays over 500 ms.

The fixed-coordinate daily sample is excluded: the short-range layout shifted
chip bounds from Y=1370-1514 to Y=1902-2046 after the first tap, so later taps
did not exercise the intended controls. Zero-frame/4950 ms overflow results
are not a successful performance sample. The observed-coordinate retry above
re-read native chip bounds for every tap, with 900 ms pauses, and includes
UIAutomator inspection overhead.

Final daily retry verified selected state after every one of eight transitions
(3M/1Y/5Y/10Y twice), re-reading chip bounds before each tap. Foreground
heartbeat maxima were 44.14 / 121.08 / 48.92 / 18.45 / 71.45 / 45.35 / 62.86 /
104.05 / 59.06 ms, maximum 121.08 ms. No delay over 500 ms occurred in these
windows. The changed inspection cadence and endpoint-formatting fix mean this
is a diagnostic result, not a normalized speedup ratio. It supports eliminating
unused label work; it does not establish visible frame smoothness.

## Verification

Final `npm run test:v1:pc`: 1,896 tests passed, 184 suites passed, three tests
and one suite intentionally skipped; typecheck, Expo Doctor 17/17, Android
readiness and strict package smoke passed. No task-caused verification failures
remain. Tests and Maestro runs were finished before performance samples.

## Remaining Gates

Keep #138 and #299 open. A healthy matched frame-pacing
control, cached Dashboard revisit within one second, and full journey JS-stall
coverage are not yet established. No budget
was relaxed. TalkBack, encryption, cloud builds and release tagging are not
part of this request.

Five final-APK cold ActivityManager TotalTime samples were 574 / 500 / 517 /
541 / 554 ms; Dashboard hierarchy was verified after each. These are activity
start diagnostics, not Dashboard readiness or TTI.

Separately, three fresh cold launches captured actual device framebuffer
screenshots by 2,279 / 2,167 / 2,139 ms from immediately before `am start -W`,
including a deliberate 1,200 ms wait and screenshot/pull overhead. All three
images were inspected and show Dashboard with the synthetic valuation and
allocation. This establishes a sampled device-framebuffer readiness upper
bound below three seconds, not exact TTI, touch-response readiness, or host
window presentation latency. Raw images are `.expo/performance/cold-dashboard-*.png`.

Three cached-revisit screenshots completed by 1,025 / 814 / 884 ms after an
injected Dashboard-tab tap, including a 400 ms wait. All still showed Holdings;
a later hierarchy inspection showed Dashboard. These do not pass the cached
revisit gate, nor isolate app calculation cost from input dispatch/emulator
presentation. Do not substitute activity timings for this failed visible-data
check. Raw images are `.expo/performance/revisit-dashboard-*.png`.

## Reproduction

Use a disposable emulator only. Build a development APK, sign with the existing
private local QA identity, run Metro temporarily, and run:

```powershell
npm run maestro:test -- e2e/visual/scale-prepare.yaml
```

Build the release APK with the same QA signing identity and opt-in probe flag,
install with `adb install -r`, stop Metro and workers, and remove reverse ports.
Signing passwords must remain in ephemeral environment variables, never logs.

```powershell
npm run maestro:test -- e2e/visual/scale-verify.yaml
npm run maestro:test -- e2e/visual/scale-daily-ready.yaml
./scripts/measure-android-frames.ps1 -Mode ranges -Label scale-daily -RangeX 288,456,624,796 -RangeY 1442 -Runs 3
python .expo/trace_processor query -f scripts/analyze-android-rendering.sql .expo/performance/cogvest-scale-fixed.perfetto-trace
```

Reinspect coordinates for the actual screen/display before measuring. Official
method references: [Android performance measurement](https://developer.android.com/topic/performance/measuring-performance)
and [Perfetto trace analysis](https://perfetto.dev/docs/quickstart/trace-analysis).
