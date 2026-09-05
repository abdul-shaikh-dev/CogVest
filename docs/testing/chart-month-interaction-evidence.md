# Chart Month Interaction Verification

Issue #269, UX-02 through UX-04. Date: 2026-09-05.

## Environment

- Pixel 10 Pro, `emulator-5554`, default font scale.
- `npm run android:apk:emulator` built successfully; the resulting debug APK
  was installed with `adb install -r` before testing current JavaScript via Metro.
- No EAS build. This is local debug/Metro verification, not release performance.
- Reset and replacement with the synthetic chart fixture were explicitly approved.
- Snapshot history spans November 2025 through May 2026; quotes refreshing current
  holdings do not change these stored chart values.

## Verification

- `npm run test:v1:pc`: typecheck, 96 suites / 952 tests, Expo doctor 17/17,
  Android readiness and strict installed-package smoke passed.
- The chart month-navigation flow uses its own synthetic fixture and presets;
  custom-range picker coverage remains in `e2e/progress-chart-range.yaml`.
- `npm run maestro:test -- e2e/progress-chart-month-navigation.yaml`: passed
  after the approved reset, with element-targeted swipes in both plots. The
  final run also waits for Progress to mount before scrolling to its controls.
- Asset selection moved from May to April. A vertical swipe beginning in the
  asset plot scrolled the page and left April selected.
- Selecting April in Assets did not change Portfolio's May selection.
- The latest asset summary explicitly showed May 2026 vs Apr 2026 while the
  inspected month was April. No implied shared month context remains.
- Portfolio selection moved to April. Screenshot review showed fixed screen
  coordinates could miss the plot. Both final swipes now target the plot-region
  element itself, using Maestro's element-based swipe origin.
- The final portfolio plot swipe preserved April's selected values; switching
  its range to 6M then selected May as expected.
- The initial combined custom-range/navigation journey passed. Repeats encountered
  a development warning overlay and an unstable month-option tap. A centering
  experiment also failed and was reverted; the existing picker flow is unchanged.
  This repeatability gap is not presented as a chart-selection success.
- Changing Portfolio from 3M to 6M resets its selected month to May. Component
  coverage also checks a reset when the old/new ranges contain the same months.
- Component tests cover disabled boundaries, independent selection and ranges,
  selected-state/chart-specific accessibility labels, masking, Minimal Mode,
  non-interactive plot props, and removed pointer callbacks.
- Independent review found a transient old-index/new-range mismatch. Keyed chart
  remounting now resets selection synchronously when range or stored months change.

## Limits

Previous/Next controls expose disabled state and chart-specific labels; selected
summaries use polite live regions. TalkBack spoken announcements were not tested.
No claim of release frame-rate improvement or complete visual redesign is made.
The earlier audit's axis/grid intervals, shared contrast, and screen density
findings remain separate work. Plot swipes no longer select points; enlarged,
series-colored markers indicate selection made with the month controls.

Gesture implementation follows Maestro's [element-based swipe documentation](https://docs.maestro.dev/api-reference/commands/swipe).

## Captured Screens

- [Portfolio April selection and highlighted points](artifacts/chart-month-interactions/portfolio-april.png).
- [Asset April selection alongside explicitly dated May summaries](artifacts/chart-month-interactions/assets-april-latest-may.png).

These captures contain only synthetic data. Existing axis/grid spacing and muted
text contrast are visible here and are not claimed as fixed by this change.
