# Real-shaped fixture performance on a phone and the emulator

Recorded 28 November 2026 for #843 and #851. Synthetic data only: the
real-shaped fixture (`src/testing/realShapedFixture.ts`) mirrors the shape of a
long-running personal portfolio with made-up names, ISINs and amounts. No EAS
build or Play submission was used.

## Fixture

Seeded with `e2e/visual/real-shaped-prepare.yaml` and checked with
`real-shaped-verify.yaml`. It contains:

- 22 mutual funds on monthly SIPs, including one scheme merger;
- 9 stocks and ETFs, including a verified 1:5 split;
- a manual unlisted holding, a crypto holding, PPF and EPF;
- cash entries and distributions;
- 95 generated month-end snapshots, December 2018 to October 2026.

## Environments

| | Emulator | Phone |
|---|---|---|
| Device | AVD `CogVest_UX_Proof`, API 36, x86_64 | Motorola Edge 30 (`ZD2224Z7DY`), arm64 |
| Display | 1280x2856 at 480 dpi, font scale 1.0 | 1080x2400, density override 384, font scale 0.85 |
| Package | `com.abdulshaikh.cogvest.e2e` | `com.abdulshaikh.cogvest.e2e` only |

Builds were local e2e APKs (x86_64 + arm64) with
`EXPO_PUBLIC_COGVEST_PERFORMANCE_PROBE=1`, built in `G:\cv`. The "before"
build is `4195bcf`; the "after" build is #853 (`2f28bb2`). Both carried a
temporary Hermes sampling-profiler trigger in `MainActivity` that was never
committed.

## Method

- **Stalls:** `scripts/measure-android-stalls.sh`, two passes with 11 s idle
  between actions, attributed with `scripts/attribute-probe-windows.mjs`. Each
  figure is the worst JavaScript event-loop delay in that action's window. The
  budget is no window over 500 ms.
  - Phone tap positions: `TAB_Y=2300 TAB_X="108 324 540" RANGE_Y=1380
    RANGE_X="149 341 533 726" SWIPE_X=540 LIST_TOP=920 LIST_BOTTOM=1850
    PAGE_TOP=760 PAGE_BOTTOM=2000`.
  - On the emulator with this fixture, use `RANGE_Y=1849`.
- **Clock offset:** on the phone, `/proc/uptime` (which counts time asleep) was
  about 458,000 s ahead of logcat's monotonic clock, so the first attribution
  matched no windows. The script now measures that offset at start and writes
  marks on logcat's clock.
- **CPU:** a Hermes sampling profile taken from just before tapping Progress
  to 8 s after.
- **UI thread:** an `atrace` capture (`gfx view input am sched`) around a
  revisit.
- **Launch:** cold launch and hot resume from `am start -W` TotalTime.

## Results

### Phone, before and after #853

Worst JavaScript delay per action, pass 1 / pass 2, in ms:

| Action | Before | After |
|---|---|---|
| Tab Holdings | 70 / 15 | 72 / 9 |
| Holdings scroll | 7–8 | 8–10 |
| Tab Progress | 705 / 10 | 154 / 12 |
| Progress to top | 176 / 10 | 9 / 8 |
| Range chips (3M, 6M, 1Y, All) | 115–206 | 14–46 |
| Revisits | 11–23 | 8–29 |
| Windows over 500 ms | 1 of 71 | 0 of 71 |

- **Hermes profile after opening Progress:** JavaScript was busy for 7,551 ms
  of the 8 s window before the fix, and 530 ms after it.
  - Before: the drift check took about 6.4 s and month formatters about 0.8 s.
  - After: fingerprinting took 143 ms and rendering about 360 ms.
- **Cold launch:** 742 ms before, 624 ms after.
- **Hot resume:** 42–48 ms after.

All are within budget: stalls under 500 ms, cold launch under 3 s, resume under
1 s. The "after" runs had a warm drift cache. The first open after a record
edit still re-checks every month (#852).

### Emulator, before #853

- **Stalls:** Progress first open 2.0–2.3 s; revisit 1.6–1.95 s. Holdings and
  Dashboard stayed under budget. Range chips sometimes reached 0.5–1.4 s.
- **Launch:** cold launch 1.6–2.2 s; hot resume 750–915 ms.
- **Revisit trace:** JavaScript was idle (786 of 790 samples). One UI-thread
  frame took 1.3 s in `Record View#draw()`, waiting on graphics-buffer
  allocation, `dequeueBuffer` and `eglSwapBuffers`.

The phone's worst revisit frame was 22 ms with the same build and data. The
emulator's Progress revisit figure reflects its emulated GPU, not the app.

Emulator stall figures for chart screens are therefore not evidence of a
phone regression. Confirm them on the phone before acting on them.
