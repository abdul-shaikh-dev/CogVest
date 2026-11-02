# V3 Performance Re-run on 1.0.30

Recorded 1 November 2026 for #138. This is a partial result, not a claim that
the #138 performance gates have passed. The JavaScript-stall gate failed on the
first open of Holdings and Progress. See the 2 November section below: those are
fixed, and the launch window still fails.

## Identity And Environment

- Base: `69e9c40`, version 1.0.30 / code 31.
- AVD `CogVest_UX_Proof`, Android API 36, 1280x2856, density 480, font scale 1.0,
  light mode. Device model is not an acceptance requirement.
- Build: the e2e variant (`npm run android:e2e`). This is a release-optimized,
  non-debuggable x86_64 APK with the QA harness on and no Metro. App id
  `com.abdulshaikh.cogvest.e2e`. Not a distribution build.
  - Plain e2e APK SHA-256:
    `129553c41b272aaafbd90f6f338668687c7fb68827b373990294ec3737435f7c`
  - e2e APK with `EXPO_PUBLIC_COGVEST_PERFORMANCE_PROBE=1`, SHA-256:
    `3d5f241d650306c05dff14fd74ab8c31fb0881782201128a7f0c543bfc5f2dd9`
- Fixture: `createAndroidScaleFixture` via `e2e/visual/scale-prepare.yaml`.
  It contains 250 assets, 250 openings, 1,000 transactions, the completed
  month-end snapshots and ten 10-year daily caches. All values are synthetic.
- Host apps stayed open. This is not a laboratory host-load guarantee.

## Build Hazard Found

Changing only an `EXPO_PUBLIC_*` variable does not rebuild the JavaScript bundle:
Gradle reuses `createBundleE2eJsAndAssets`. The first probe build therefore
contained no probe. Delete the bundle outputs under
`android/app/build/generated/assets` and `android/app/build/intermediates/assets/e2e`
before an env-only rebuild. Check the bundle, for example by searching it for
`cogvest-performance`. The release harness check
(`npm run release:check-harness`) builds its own production bundle and is not
affected.

## Cold Launch To Dashboard (target 3 s)

Method: `am force-stop`, then `am start`. The screen was captured with
`screencap | gzip` about every 0.18 s, timed from device uptime. "Dashboard"
means the first capture after the blank launch window that has Dashboard
content: portfolio value, return, allocation and tab bar. A saved frame
sequence confirmed that later changes were only the scroll indicator fading.

| Run | Dashboard content (s) | Previous capture (s) |
| --- | ---: | ---: |
| 1 | 1.98 | 1.82 |
| 2 | 1.91 | 1.74 |
| 3 | 1.96 | 1.78 |
| 4 | 1.85 | 1.66 |
| 5 | 2.86 | 2.67 |

All five are under 3 s. The median is 1.96 s and run 5 is the outlier. `am start -W`
TotalTime (first frame only) was 280–492 ms. `uiautomator`-based polling was
rejected because one dump costs about 2 s and waits for idle.

## Resume (target 1 s)

HOME, then `am start -W`: LaunchState HOT, TotalTime 83 / 90 / 154 / 135 / 91 ms.
Tab revisits are covered by the stall table below.

## JavaScript Event-Loop Stalls (target: none over 500 ms)

The probe reports the maximum positive delay of a 50 ms heartbeat in five-second
windows. This is event-loop responsiveness, not pure JS execution time or frame
pacing.

**Maestro-driven workload, rejected for attribution.** Three cycles covered Dashboard, Holdings
scrolling, Progress ranges and holding 001's 10Y chart. 16 of 44 windows were
over 500 ms, max 1,677 ms. Maestro dumps the view hierarchy between steps, which
is heavy with 250 rows, so the numbers mix tool load with app work.

**Raw `adb input` workload (two runs).** Each run did two passes, with one action
followed by 11 s idle (6 s in run 1). Each window is credited only to an action
that started in its first 3 s. Values are the maximum delay in ms for pass 1 / pass 2.

| Action | Run 1 | Run 2 |
| --- | --- | --- |
| Idle | 18 / 357 | 19 / 19 |
| First Holdings open, then second | **809** / 357 | **761** / 308 |
| Holdings scroll down (6 flings) | 36 / 42 | 46 / 43 |
| Holdings scroll up | 45 / 27 | 44 / 28 |
| First Progress open, then second | **774** / 327 | **786** / 300 |
| Progress scroll to top | 26 / 43 | 43 / 43 |
| Range 3M | 124 / 129 | 125 / 165 |
| Range 6M | 154 / 143 | 112 / 178 |
| Range 1Y | 124 / 123 | 172 / 154 |
| Range All | 431 / 487 | 476 / 465 |
| Tab Dashboard | 39 / 44 | 44 / 24 |
| Tab Holdings revisit | 292 / 247 | 307 / 284 |
| Tab Progress revisit | 268 / 333 | 276 / 389 |
| Tab Dashboard revisit | 25 / 48 | 57 / 25 |

Run 1 idle pass 2 (357 ms) overlapped the previous action's window under the
6 s spacing. Run 2's 11 s spacing removes that overlap.

**Launch window.** One more window per run, during startup before the first
action, reached **664 ms** (run 1) and **685 ms** (run 2).

**Result: the gate fails.** The first open of Holdings (761–809 ms) and Progress
(774–786 ms) after launch, and the startup window (664–685 ms), exceed 500 ms
in both runs. Everything else is under 500 ms. Range All is the closest at 431–487 ms. Scrolling the 250-row list stays
under 50 ms. Logcat had no ANR, `FATAL EXCEPTION` or crash entries in any run.

## Not Covered Here

- **Smoothness / frame pacing:** not claimed. The #299 measurement-validity
  problem is unchanged: native screens also miss frames on this emulator.
- **Cross-version payload-equality upgrade:** not re-run. A schema-crossing
  proof needs a QA build of 1.0.26 (schema 16), whose QA builds were
  Metro-dependent debug builds with a different app id from current e2e builds.
  Existing evidence:
  - the migration unit tests;
  - the owner's signed upgrades 1.0.27 → 1.0.30 on their phone, crossing schema
    17 and 18, with the app working afterwards. This is a real-world pass, not a
    payload-equality proof.

## After The First-Mount Fixes (2 November 2026)

Same AVD, fixture and raw `adb input` method, on the branch
`perf/138-first-mount-stalls`. Probe e2e builds only.

Changes:

- Holdings renders its rows in batches of 24, one task at a time, instead of
  all 250 in one commit.
- Holdings rows are memoized with stable derived lists and a stable select
  handler, so a tab focus change no longer re-renders every row.
- `calculateHoldings` reuses its frozen result for the same records, quotes
  and calendar day. Dashboard, Holdings and Progress no longer each replay the
  same trades.
- Progress applies the month-end status update in a transition, so it no
  longer lands in the first-render task.
- The app-start month-end check no longer builds the Progress view at the root.

Maximum delay in ms, pass 1 / pass 2. Runs A and B used APK
`e27f06cd48dadb19cd9c2f4c455bed850063df65cf600bbc4233f7577cf57448`
(all but the last change). Run C used
`08a3c5cfc0088125ebba28b4d7590a031772e75502d0131a2d00b9dca81ba192` (all
changes) on a freshly booted emulator with the fixture re-seeded.

| Action | Before (two runs) | A | B | C |
| --- | --- | --- | --- | --- |
| First Holdings open | 761–809 | 143 | 128–154 | 131–142 |
| First Progress open | 774–786 | 333 / 784 | 351–385 | 398–405 |
| Range All | 431–487 | 420–495 | 401–478 | 385–431 |
| Tab Holdings revisit | 247–307 | 25–69 | — | 19–52 |
| Tab Progress revisit | 268–389 | 39–57 | — | 24–28 |
| Launch window | 664–685 | 548–590 | 521–550 | 575–697 |

Each column is two runs. For B, only these rows were recorded, so the revisit
rows are blank.
One A run had a 784 ms first Progress open, and the five other runs on these
fixes stayed at 333–405 ms; treat it as an unexplained outlier, not a pass.
Scrolling stayed under 50 ms. No ANR, `FATAL EXCEPTION` or crash entries.

**Result: first-mount stalls on Holdings and Progress are fixed on this
fixture; the gate still fails on the launch window**, which stays at 521–697 ms.
Removing the root Progress view did not move it, so the remaining cost is
elsewhere in startup, for example store hydration or the first Dashboard render.

## Next

Trace the launch window to find the remaining startup cost, then re-run this
method. Range All (up to 495 ms) is the next closest to the limit.
