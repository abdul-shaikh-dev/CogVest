# Dashboard Valuation Basis: UX-13 / #286

Base: `5c79295`. Branch: `fix/dashboard-valuation-basis`.

## Contract

Dashboard names its current-record valuation rather than calling it a snapshot.
The hero retains invested value and holdings P&L. Price freshness sits alongside
that answer, with an accessible expanded/collapsed Price details control. Missing
prices, older/manual provenance and failed refreshes are not hidden behind it.
Detailed coverage counts and neutral saved-quote movement are disclosed on demand;
the latter is explicitly not portfolio return and preserves amount masking.

The Progress action explains that stored month-end values can differ from current
holdings/prices. At enlarged text sizes the explanation and action stack. No
domain calculations, provider calls, persistence, dependencies or schemas changed.

## Repeatable Checks

- `npm run test:v1:pc`: full unit/component suite, typecheck, Expo doctor and
  Android readiness/package checks.
- `npm run android:apk:emulator`: fresh local debug APK. Install with
  `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` and serve this
  branch from Metro on 8081 (`adb reverse tcp:8081 tcp:8081`).
- `npm run maestro:test -- e2e/dashboard-valuation-basis.yaml`: replaces only
  synthetic developer data through the existing explicit seed confirmation.
  Asserts fixture current value INR 15.9L, invested 12.38L, return +24.44%, older
  and manual freshness, disclosure opening/closing and navigation to Progress.
- Repeat at 360dp / 130% text: `adb shell wm size 1080x2410` with device density
  480 and `adb shell settings put system font_scale 1.3`. Restore original size
  with `wm size reset` and original font scale (1.0 for this run).

## Evidence

`npm run test:v1:pc` passed: 97 suites / 1,001 tests, typecheck, Expo doctor
17/17, Android doctor and strict package smoke. Dashboard focused suite passed
23/23, including the final accessible price-status label assertion. An earlier
gate started while the test worker was still editing and reported an unfinished
test helper; the completed file and final gate passed.

Fresh local debug build succeeded in 24 seconds and installed on emulator-5554,
Pixel_10_Pro, at 2026-09-06 18:30:25. Native-shell SHA256:
`AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
The hash remains unchanged for JS-only work; current Metro supplied these changes.

Standard-size journey passed. Enlarged-text journey passed on retry. Its first
attempt left the app during scrolling and Android logged a Maestro instrumentation
crash; no app fatal exception was found. The same assertions passed without
weakening them. Screenshot review then found narrow wrapping in the Progress
explanation; the action/description layout was corrected to stack.
The final enlarged-text journey passed after that correction, with screenshot
inspection confirming full-width readable explanation and reachable action.
Original 1280x2856 size and 1.0 font scale were restored.

Independent Terra owned-diff review found no task-caused behavior findings.
Impeccable distillation guided the answer-first hero, on-demand operational detail
and enlarged-text correction. The historical audit remains an unchanged snapshot.

## Screenshots

- [Dashboard](artifacts/dashboard-valuation-basis/ux13-dashboard.png)
- [Price details](artifacts/dashboard-valuation-basis/ux13-price-details.png)
- [Progress context](artifacts/dashboard-valuation-basis/ux13-progress-context.png)
- [Enlarged Dashboard](artifacts/dashboard-valuation-basis/enlarged-dashboard.png)
- [Enlarged price details](artifacts/dashboard-valuation-basis/enlarged-price-details.png)
- [Enlarged Progress context](artifacts/dashboard-valuation-basis/enlarged-progress-context.png)

## Limits

This is debug APK plus current Metro evidence, not standalone-release, physical
phone, live-provider availability or full TalkBack certification. The existing
Dashboard bottom-tab label truncates at narrow/enlarged settings; shared navigation
was not changed in UX-13. Retain that observation for the shared hierarchy audit.
No EAS build or real financial data was used.
