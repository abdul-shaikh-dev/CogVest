# Progress mask bounds verification - issue #429

## Diagnosis correction

The clipping reported in #429 could not be reproduced on merged main
`4355590` (#430). Before any production changes, both a cold-opened Progress
screen and the original seeded primary-tab sequence measured a complete
48dp control inside the 16dp content inset at 360dp / 130%.
The final populated Progress screenshot committed in #430 also shows the whole
button within that inset. The earlier report's clipping conclusion is superseded
by this measurement-based review; it must not be treated as proof of a persistent
production layout defect. Capture timing is a possible explanation, not a proven
root cause. Historical reports and screenshots are unchanged.

No production layout change was justified. This PR adds reproducible regression
checks instead: settled-navigation screenshots, exact Show/Mask labels, enabled
clickable controls, minimum visible 48dp targets, and full content-inset bounds.
It does not change financial records, calculations or persistence.

## Fresh installed environment

- `EXPO_OFFLINE=1 npm run android:apk:emulator`: fresh local debug build succeeded;
  Gradle took 1m34s after Expo preparation. `adb install -r` succeeded.
- APK SHA256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
  Native hash is unchanged because production code is unchanged.
- JavaScript: current source from restarted offline Metro; this is not a
  standalone release bundle or EAS preview test.
- Pixel_10_Pro, emulator-5554, Android 16 / API 36, x86_64, portrait.
- Normal: 1280x2856 at 480dpi, approximately 427dp, font scale 1.0.
- Enlarged: 1080x2400 at 480dpi, 360dp, font scale 1.3.
- Each Progress case clears synthetic emulator state; populated/masked cases use
  the explicit developer seed confirmation. No user's phone or private data is used.

## Reproduction commands

After installing the matching debug APK and starting Metro, set the desired
display configuration and run each state (`empty`, `populated`, `masked`):

```powershell
maestro --device emulator-5554 test -e STATE=populated -e SHOT=narrow e2e/visual/progress-mask-bounds.yaml
node e2e/scripts/assert-control-bounds.mjs emulator-5554 progress-mask-toggle 'Mask values' .expo/issue429/narrow-populated.json
```

Use `Show values` for the masked case. Run `header-action-bounds.yaml` after the
populated case with `ROUTE=cogvest:///dashboard`, `CONTROL=dashboard-mask-toggle`
and `LABEL=Mask values` (or Holdings / `holdings-header-mask-toggle` /
`LABEL=Hide values`) and a distinct `SHOT` name.
Do not run native UI dumps concurrently with Maestro.

The assertion reads effective display size/density and native accessibility
bounds, not only element presence. JSON reports preserve the measured geometry
and font scale. `node --test e2e/scripts/control-bounds.test.mjs` verifies that
edge-clipped, undersized, mislabelled, missing and duplicate controls are rejected.

The first shared-header run stopped because the new test assumed Holdings also
used "Mask values". Source inspection confirmed its existing "Hide values" label;
the harness was corrected without changing production accessibility semantics.

## Results and evidence

All ten native checks passed with 48x48dp visible targets, enabled/clickable
semantics and at least 16dp horizontal content inset. All ten screenshots were
visually inspected. Progress correctly changed its action to "Show values" and
masked the seeded monetary values after tapping the control.

| Configuration | Progress states | Shared headers | Result |
| --- | --- | --- | --- |
| 427dp / 100% | Empty, populated, masked | Dashboard, Holdings | 5/5 pass |
| 360dp / 130% | Empty, populated, masked | Dashboard, Holdings | 5/5 pass |

Screenshots and matching native JSON reports are in
[`artifacts/2026-09-27-progress-mask-bounds`](artifacts/2026-09-27-progress-mask-bounds).
The narrow Progress bounds are `[888,447][1032,591]`; normal Progress bounds are
`[1088,225][1232,369]`. The narrow header deliberately wraps its action below the
title rather than squeezing it onto the title row. It is not clipped.

- `node --test e2e/scripts/control-bounds.test.mjs`: 4 tests passed.
- `npm run test:v1:pc`: passed; 167 suites / 1767 tests passed, with the existing
  1 suite / 3 tests skipped. Typecheck and Expo Doctor (17/17) passed.
- Strict Android smoke passed again after installing the freshly built APK.
- Emulator display size and font scale were restored after the matrix.

Issue #429 can close as a corrected diagnosis with reproducible bounds evidence,
not as a production layout fix. This does not close the aggregate UX tracker.

## Verification limits

This is a focused control-layout check, not full tracker #401 completion.
Actual spoken TalkBack, 200% text, foldable/landscape layouts, provider imports,
backup roundtrips and release-mode performance are not repeated here.
Shared header coverage is Dashboard and Holdings; other routes' earlier evidence
is not presented as a new installed test. No cloud build, tag or release was run.
