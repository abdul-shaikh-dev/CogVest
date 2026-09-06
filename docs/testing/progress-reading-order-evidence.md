# Progress Reading Order Verification

Date: 2026-09-06. Scope: #275 approved preview and #277 native implementation,
delivered together in PR #276 on `design/progress-reading-order`.

## Build And Runtime

- `npm run android:apk:emulator`: passed; local debug APK built, no EAS.
- Installed `android/app/build/outputs/apk/debug/app-debug.apk` with
  `adb -s emulator-5554 install -r` before native verification.
- APK SHA256: `AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
- Pixel 10 Pro emulator, `emulator-5554`; package `com.abdulshaikh.cogvest`.
- This is a fresh native debug APK running the task's current JavaScript through
  Metro on port 8081 (`adb reverse tcp:8081 tcp:8081`). It is **not** evidence of
  a standalone production release or phone-distributable APK.
- Existing explicit developer visual-QA seeding supplied synthetic records.
  No personal portfolio or statement data is included in the captures.

## Automated Verification

- `npm run test:v1:pc`: passed, including typecheck, 97 Jest suites / 973 tests,
  Expo Doctor 17/17, Android doctor and strict installed-package smoke check.
- `npm run maestro:test -- e2e/progress-snapshot-history.yaml`: passed. Opens
  May and April 2026 and November 2025, asserts their stored values, tests both
  header Back and Android Back, and preserves the older selected year.
- `npm run maestro:test -- e2e/progress-chart-month-navigation.yaml`: passed.
  Both chart selections remain independent; plot scrolling does not select a
  different month; removed duplicate summary stays absent.
- `npm run maestro:test -- e2e/progress-chart-range.yaml`: passed. Custom range
  start/end remain valid ordered stored months. The test now scrolls to the
  stacked end field instead of assuming both fields fit in the viewport.
- `npm run maestro:test -- e2e/snapshot-review.yaml`: passed. Compact status
  still leads to the existing optional snapshot review/correction route.
- Focused history tests cover all 12 months in descending order, partial years,
  January/December comparison, missing and zero baselines, nullable values,
  masked notes, and restoring overview offset 300 after detail offset 900.
- Read-only independent owned-diff review: no remaining concrete findings.
- Preview DOM verification (`node docs/design/previews/progress-reading-order/verify.cjs`): passed.
- `e2e/visual/progress-reading-order.yaml`: passing normal-size screenshot and
  masking journey, retained for repeat capture. The same journey also passed
  at 360dp / 130% text with separate narrow screenshot names.

## Native Visual Inspection

Normal display: 1280 x 2856, density 480, font scale 1.0. Narrow check:
1080 x 2400 at the same density (360dp), font scale 1.3. Original size and font
settings were restored after testing.

The screenshot journey inspects the monthly answer, both charts, history,
dedicated May details, and masked details. Native screenshots are stored under
`artifacts/progress-reading-order/`; the preview remains a synthetic visual
reference rather than an exact numeric match to the emulator fixtures.

Corrections from inspection: less sheet-header whitespace, one stable-height
panel, clear Change column label, whole-word range controls, readable stacked
asset metrics at enlarged text, and centered chart month navigation without a
duplicate date heading. History details open at the top instead of expanding
inside the overview. Financial amounts, percentages and notes obey masking.

## Boundaries And Reproduction Notes

- Native custom ranges intentionally retain the existing inline form, with
  stacked fields; no new dialog, dependency or financial calculation was added.
- Full-year ordering and offset restoration have component-test coverage. The
  native seed is a partial-year dataset, not a 12-month native stress test.
- TalkBack speech/focus announcements, physical-phone UX, release performance,
  and pixel-perfect parity are not claimed. Existing bottom-tab text truncation
  at enlarged fonts and existing curved-chart interpolation are outside this
  Progress composition change.
- Existing selected chart endpoint circles remain clipped at the right plot
  edge; chart padding/interpolation polish is not claimed as fixed here.
- The first cold-bundle journey timed out before Dashboard appeared. Metro
  finished its initial bundle and the warm repeat passed; do not weaken the
  Dashboard assertion to conceal startup failures.
- Maestro needs access to its user-profile log directory. A sandboxed retry
  failed before app interaction on `maestro.log.lck`; the authorized retry ran.
- During repeat capture after display resizing/development reloads, the app
  produced a blank capture and Expo logged a multiple-linking warning. This is
  recorded separately from the passing journeys; do not treat a blank capture
  as verified visual evidence or assume its root cause without reproduction.
  Restarting the emulator and restoring port reversal resolved the capture
  failure; the complete final normal-size journey passed afterward. No routing
  workaround or relaxed assertion was added to application code.

To repeat, start Metro, reverse port 8081, use the explicit developer seed on a
disposable emulator, run the four tracked flows above, then inspect screenshots.
Do not clear user data on a personal device. Keep screen-code edits paused while
capturing to avoid Fast Refresh interrupting navigation.
