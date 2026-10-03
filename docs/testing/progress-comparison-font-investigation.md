# Progress comparison fix and font-scale investigation

3 October 2026. Related to #512. PR #528 is merged. Its
[signed-preview defect report](release-font-scale-evidence.md) remains unchanged.

## Result

The narrow Progress comparison layout is corrected. At widths below 440dp,
Difference / Difference % occupy a full row, with Portfolio / Invested below.
Large text continues to use this stacked grouping. No financial calculation,
stored value, chart range or comparison basis changes.

**Live Android font-scale handling is not fixed by this patch.** The native
investigation did not establish a release-ready correction. None of its plugins,
experimental flags, text keys or font-size properties is included in this change.
Tracker #512 must remain open. Follow-up [#529](https://github.com/abdul-shaikh-dev/CogVest/issues/529) records the unresolved defect. A supported framework compatibility investigation
is proposed separately; no dependency upgrade is included or assumed approved.

## Native investigation

React Native 0.81.5 has a disabled Fabric font-scale layout path. Diagnostic builds
tested Activity `fontScale` handling, native metrics and DeviceInfo updates,
enabling only that flag with stable defaults, root-only layout requests, paragraph
remounting, and scale-aware text attributes. These were temporary probes, not
recommended fixes.

Combining native font-layout invalidation and text-leaf refresh improved the
inspected labels and retained navigation and the cash draft. Variants omitting
either part still clipped text. Stable flags with changed text attributes also
failed. The combined internal-flag workaround needs further review and repeatable
acceptance; it is not shipped here. This investigation does not establish one
complete cause or prove that a framework upgrade is the only solution.

Maestro text assertions passed while glyphs or backgrounds were visibly missing.
Unit tests and exact data assertions therefore cannot stand in for screenshot
review here. Some apparent missing-background/icon differences in image previews
were not confirmed in source pixels and are not treated as established product
defects. Earlier progress messages overstated those observations. The unaccepted
probes were removed before the final build.

| Rejected probe | Screenshot |
| --- | --- |
| Stable renderer with scale-aware text attributes, live 130%; clipped headings and descriptions | [Failure](../reviews/artifacts/2026-10-03-font-scale-fix/rejected-probe-live-130.png) |

This image is a diagnostic failure, not a screenshot of the final patch.

## Fixture and repeatable checks

[`e2e/fixtures/font-scale-history.json`](../../e2e/fixtures/font-scale-history.json)
is a checksum-bearing synthetic backup with no assets or activity. Its stored
May, July and August 2026 portfolio values are INR 10,000, 13,000 and 12,000;
each invested value is INR 10,000. Equity equals portfolio value, all other
classes and monthly flows are zero, and June is absent. No personal data is used.

The `e2e/visual/font-scale-*.yaml` flows preserve the reproduction for future work.
Restore is destructive and is for disposable test installations only. Preparation
selects a display mode; capture phases do not navigate or restart the app. Change
the emulator's `font_scale` between phases with adb. The draft flow checks
`1234.56` and its label; the data flow saves and reopens that synthetic cash entry
and checks the exact History values. The live-transition flows remain regression
reproductions, not passing acceptance tests on the final patch.

## Final patch verification

- Fresh x86_64 local debug APK from `fix/android-font-scale-layout`, based on
  merged main `7403316`, built with `npm run android:apk:emulator` after removing
  every native probe. APK SHA-256:
  `497385F3FA8016839AAE28C0E9221B1FD5C879FD68C546F6F86FAA3B8C5F6B16`.
- Pixel_10_Pro AVD, API 36, android-36.1 Google APIs Play Store x86_64,
  emulator 36.5.11. Display 1080x2400, density 480, approximately 360dp wide,
  font scale 1.0. Disposable headless emulator-5556 with `-read-only` and
  `-no-snapshot-save`; the existing emulator-5554 installation was untouched.
- Native build installed locally; JavaScript served through Metro. Final normal-
  text captures followed a clean app start, not a live font transition. An earlier
  capture with the Metro Refreshing overlay was replaced by the settled recapture.
- The Standard and Minimal preparation flows passed. Screenshots show complete
  Difference / Difference % labels and unsplit percentages. Scroll positions
  differ; the captures establish the comparison grouping, not pixel-matched pages.
- The final History flow checked May 10,000, July 13,000 and August 12,000,
  invested 10,000 each, and missing June. The final patch does not change cash
  behavior; the draft/save checks described above were diagnostic runs only.
- `npm run test:v1:pc` passed: typecheck, 191 suites / 2,025 tests, Expo Doctor
  17/17, Android Doctor and strict package smoke. One suite / three tests remain
  skipped. The new tests cover both modes at narrow and wide widths, changing
  font-scale dimensions, and unchanged stored snapshots. `git diff --check` passed.

| Final patch, normal text | Evidence |
| --- | --- |
| Standard comparison grouping | [Screenshot](../reviews/artifacts/2026-10-03-font-scale-fix/standard-normal-100.png) |
| Minimal comparison grouping, expanded | [Screenshot](../reviews/artifacts/2026-10-03-font-scale-fix/minimal-normal-100.png) |
| Exact August values | [Screenshot](../reviews/artifacts/2026-10-03-font-scale-fix/final-august-values.png) |

## Limits

No new EAS build, release, signing-policy change, renderer flag or dependency was
shipped. The corrected narrow layout needs a future signed-preview check. The
font-scale defect needs implementation and repeatable native visual verification,
including both modes, both directions, background/resume, draft retention and
stored-data assertions. There is no all-screen, phone, TalkBack or performance
sign-off in this pass.
