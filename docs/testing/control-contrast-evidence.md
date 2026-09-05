# Shared Control Contrast Verification

Issue #273, audit UX-07. Date: 2026-09-06. Base: `39aa781`.

## Changes

Primary green and financial profit/loss tokens are unchanged. Filled actions use
black inverse labels; secondary text now matches DESIGN.md's #98989D. Pressed
controls retain 98% opacity instead of 75%, with Android ripples behind text.
Primary/destructive buttons use a 6% black ripple; neutral surfaces use 18%.
Holdings filters and legacy selected-asset cards use the same primary/inverse
pair rather than gray or white text on deep green.

## Measured Contrast

| Pair | Ratio |
| --- | --- |
| Black label / primary #34C759 | 9.46:1 |
| Black label / destructive #FF453A | 6.16:1 |
| Secondary #98989D / elevated #2C2C2E | 4.85:1 |
| Held Android 3M chip sampled label #010502 / fill #34C358 | 8.88:1 |

The held-state ratio uses dominant interior label/fill pixels from the original
PNG, not antialiased edge pixels. The chip was located by its UI hierarchy bounds
and held using `adb shell input touchscreen motionevent DOWN`; a `finally` block
released it with `UP`. Sampling confirms one native held frame, not every ripple
animation frame. Token tests separately evaluate the composited ripple bounds.

## Native Evidence

- Fresh `npm run android:apk:emulator` build installed with `adb install -r`
  before current source was served by Metro. No EAS build.
- Pixel 10 Pro emulator, 1280x2856, density 480, font scale 1.0.
- Existing synthetic portfolio only. Capture flows opened Add Holding, Progress,
  Cash's empty deposit editor, and Holdings; no financial records were submitted.
- [Selected chart control](artifacts/control-contrast/chart-selected.png)
- [Held chart control](artifacts/control-contrast/chart-pressed.png)
- [Primary Cash action](artifacts/control-contrast/cash-primary.png)
- [Selected Holdings filter](artifacts/control-contrast/holdings-filter.png)

Scoped visual polish review checked foreground separation, coherent selected
states, preserved financial colors, and visible disabled differentiation using
Impeccable's readability/state guidance. This is native evidence, not a browser
detector result or a full UI accessibility certification.

## Coverage And Limits

- `npm run test:v1:pc`: typecheck, 96 suites / 964 tests, Expo doctor 17/17,
  Android doctor and strict smoke passed. The first run caught two test-helper
  TypeScript errors; both were corrected before this successful full run.
- `npm run maestro:test -- e2e/progress-chart-month-navigation.yaml`: passed
  after the approved synthetic reset, preserving independent months, plot-origin
  scrolling, dated summaries and range-reset behavior.

Theme tests calculate relative luminance with alpha compositing; primitive tests
check actual label/ripple props and disabled styling. Holdings and Progress tests
assert the selected foreground/background pairing. Destructive/conviction/history
states are covered through component/token contracts rather than a native
screenshot of every state. No destructive action was executed for visual QA.

Muted non-interactive decoration, colored financial/category labels, full TalkBack,
release performance, and every possible custom background are not certified by
this scope. Existing narrow-screen header/range/tab wrapping from #271 remains
separate work. Historical audit screenshots are preserved unchanged.
