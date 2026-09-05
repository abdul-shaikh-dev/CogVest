# Chart Axis Alignment Verification

Issue #271, audit UX-05. Date: 2026-09-06. Base: `233f344`.

## Contract

Both charts now use Gifted Charts' own zero/half/maximum labels and two equal
sections, rather than a separate manually positioned column. A shared props
object defines scale, formatter, width and guide lengths. Measured container
width and a font-scaled gutter determine plot spacing. Existing month selection,
masking, series colors and calculations are preserved.

## Checks

- `npm run android:apk:emulator`: local x86_64 debug APK built successfully.
- `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`: installed
  successfully before current source was tested through Metro.
- `npm run test:v1:pc`: typecheck; 96 suites / 956 tests; Expo doctor 17/17;
  Android readiness and strict package smoke passed.
- `npm run maestro:test -- e2e/progress-chart-month-navigation.yaml`: passed
  with the approved synthetic reset. Both plot-origin swipes retained April,
  charts remained independent, and changing Portfolio to 6M reset it to May.
- Focused ProgressScreen suite: 31 tests passed, including both charts with
  small (maximum 5, midpoint 2.5), large (maximum 1 crore), all-zero and masked
  values, and measured-width/spacing/guide-length assertions.
- Native screenshots inspect both charts at 1280x2856 / density 480 (~427dp)
  and 1080x2400 / density 480 (360dp) with font scale 1.3. Settings were restored
  to physical resolution and font scale 1.0 after the enlarged-text checks.

## Visual Review

- [Portfolio, normal size](artifacts/chart-axis-alignment/portfolio-default.png)
- [Assets, normal size](artifacts/chart-axis-alignment/assets-default.png)
- [Portfolio, 360dp and 130% text](artifacts/chart-axis-alignment/portfolio-narrow-130.png)
- [Assets, 360dp and 130% text](artifacts/chart-axis-alignment/assets-narrow-130.png)

The zero, midpoint and maximum labels align with the baseline and horizontal
rules. Labels fit at enlarged text size. Rules stop within the chart surface;
the first review caught the library's default extra end spacing and explicit
rule/axis lengths corrected it. The selected markers keep their series colors.

This is a scoped native polish review informed by Impeccable's alignment,
typography and viewport checks, not a browser-detector or full app redesign.

## Reproduction

Use the existing synthetic visual-QA portfolio, not private data. Cold-start the
fresh APK and wait for Dashboard before opening `cogvest:///progress`. Select 3M
on each chart, scroll until its whole plot is visible, and capture it. For the
narrow variant, temporarily use `adb shell wm size 1080x2400` and
`adb shell settings put system font_scale 1.3`, then cold-start again. Restore
with `adb shell wm size reset` and font scale `1.0`.

The capture flow initially opened the deep link during cold-start initialization
and stayed on Dashboard. Waiting for Dashboard before navigating fixed the test
setup; this was not an axis-rendering failure.

## Limits And Follow-up

The captures use the existing synthetic portfolio. On cold start, snapshot
automation extended its stored history into August; generated estimates are
shown as estimates. These values are not evidence of live-provider accuracy.
Small/zero/masked scales are component-tested, not separate native fixtures.
This is debug/Metro verification, not standalone release profiling or TalkBack
speech verification. No EAS build or physical phone was used.

At 360dp/130%, the existing Asset Momentum badge squeezes its heading, Custom
wraps mid-word, and Dashboard's tab label truncates. These require the next
responsive readability/presentation pass; this change does not claim to fix
header, range-control or tab layout. Shared contrast UX-07 and Progress density
UX-09 also remain open audit work. Historical audit evidence is unchanged.
