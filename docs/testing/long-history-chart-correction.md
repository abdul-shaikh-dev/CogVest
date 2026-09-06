# Long-History Chart Correction

Issue #295, 7 September 2026. Base: `5a666b1` (merged PR #294).

## Change And Scope

The earlier [standalone report](standalone-chart-verification.md) remains the
before-state evidence. This correction retains Gifted Charts and every stored
point; it does not change financial calculations, persistence, or range rules.

Gifted Charts' reveal callbacks retain their initial total width. CogVest first
renders with a fallback width before receiving native layout measurements.
Refreshing only the chart renderer when plot width or point count changes
prevents late-history points from remaining clipped, while selected-month state
stays in the parent. Native label components use independently sized, inward-
aligned text instead of the tiny per-point spacing. Multi-year labels include
the year. Enlarged portfolio summaries stack and axis labels reserve more room.

## Verification

- Component coverage: 3, 12, 60, and 120 monthly points at two measured widths,
  with a latest-value outlier; all points retained, endpoint geometry bounded,
  three readable labels, and renderer replacement after layout changes.
- `npm run test:v1:pc`: passed on retry, including typecheck, 97 suites / 1,019
  tests, Expo doctor, Android doctor, and strict installed-package smoke check.
  The first run passed all tests but exited on an intermittent React Native Jest
  timer teardown error originating from untouched `MonthlyHistoryPanel.test.tsx`.
  No test was disabled or assertion weakened.
- Fresh local x86_64 release build and same-key `adb install -r`: passed.
  No Metro, EAS build, production signing changes, or data reset.
- `e2e/standalone/chart-regression.yaml`: passed with `LATEST_MONTH=Aug 2026`
  and `PREVIOUS_MONTH=Jul 2026`. Covers independent ranges, selected month after
  chart scrolling, old history values, navigation, and cold reopening.
- `e2e/standalone/custom-range.yaml`: passed (March-May 2026 selection).
- Native visual coverage uses the retained synthetic 63-month dataset, not
  separate native fixtures for all four component-test counts. Normal viewport:
  Pixel_10_Pro, 1280x2856, density 480, font scale 1.0. Narrow check: 1080x2400
  (360dp), font scale 1.3. Emulator overrides are restored after testing.
- Earlier automation attempts reached the launcher or missed cold-start route
  readiness. They were not counted as passes. Final release regression passed;
  the opt-in visual flow explicitly waits for Dashboard and Progress readiness.

Final release APK SHA-256:
`1021BC976869D8C98B9D0D0ACCB13E9191403F966047F1E10980ABE0FA1182E5`.
Built with `npm run android:apk:release -- --architecture=x86_64` using the
existing private local QA signing identity. Subsequent source edits only format
the label JSX; they do not change runtime behavior.

## Evidence And Reproduction

After screenshots live in [chart-fix artifacts](artifacts/2026-09-07-chart-fix/).
They show the full late-history spike, selected July marker, readable year
labels, and the enlarged-font summary. Values are synthetic QA state and are
not investment performance claims.

Prepare and retain the dataset using the original standalone report, install
the fresh same-key release, and run:

```powershell
maestro test -e 'LATEST_MONTH=Aug 2026' -e 'PREVIOUS_MONTH=Jul 2026' e2e/standalone/chart-regression.yaml
maestro test e2e/standalone/custom-range.yaml
adb shell wm size 1080x2400
adb shell settings put system font_scale 1.3
try {
  adb shell am force-stop com.abdulshaikh.cogvest
  maestro test e2e/standalone/chart-layout.yaml
} finally {
  adb shell wm size reset
  adb shell settings put system font_scale 1.0
}
```

The visual flow captures evidence; a passing navigation command alone does not
establish visual correctness. Inspect both plots, endpoint labels, and summaries.
Use observed stored months if rerunning with a different dataset/date.

## Remaining Limits

This is a rendering-correctness fix, not performance certification. The previous
emulator frame-miss measurements remain unresolved; no new smoothness claim is
made. Dense point markers and large-font vertical length remain visual tradeoffs.
Physical-device performance and TalkBack are not verified by this run.
