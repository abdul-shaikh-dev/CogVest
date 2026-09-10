# Advanced Asset Search: Performance Follow-Up

Issue #23; PR #314. Supersedes neither the earlier failed samples nor the issue
gate. **The strict performance gate remains open.**

## Corrections

- Saved rows and filtered/visible arrays retain stable references for unrelated
  form updates. Selection still calls the latest controller handler.
- Replaced whole-form timer pagination with local result-list batches of five.
  Existing rows remain mounted on append; changed results immediately discard
  obsolete rows. Next-page controls appear only after that page commits.
- Removed per-render console logging. The bounded QA buffer exports only after
  capture ends the window; dropped measurements are explicit. Sampling stops
  when the route loses focus. React Profiler is now separately opt-in.
- Measure query/filter/page completion, not just the first provider commit.
  These are **complete React commit** measurements, not native-paint timings.
- Reduced the fixed QA header after a captured report consumed enough viewport
  space to prevent Maestro's default swipe from reaching the form footer.
  The assertion was retained; the following two full journeys passed.

## Installed-App Evidence

`npm run test:v1:pc` passed: 115 suites / 1,188 tests, TypeScript, Expo Doctor
17/17, Android doctor and strict installed-package smoke. Independent owned-diff
review found no remaining production correctness finding; its measurement
wording correction is reflected below.

Rebuilt using `npm run android:apk:emulator`, re-signed with the existing local
QA key, and installed with `adb install -r`. No data reset, uninstall, cloud
build, provider calls or new signing key. The isolated fixture uses 500 saved
assets and 200 candidates, with memory-only recent history and saves.

Native debug APK SHA-256 remains
`3D9560D1C34664FA83DB7FA5E0AC038B2AB9234623EDD8C83C528963F3C8CDB2`:
these JavaScript-only changes are loaded from current Metro, not embedded in a
standalone release APK. Device: Pixel_10_Pro, Android 16/API 36, x86_64,
1280x2856, density 480, font scale 1.0.

Both profiled and timing-only `e2e/discovery/advanced-search.yaml` journeys
passed exact saved/provider selection, no auto-selection, 20-to-40 pagination,
Crypto filtering, saving an opening, **500 assets / 1 opening**, and clearing
recent searches. Maximum 100-result behavior is unit-tested, not exhaustively
scrolled in this installed-app journey. No crash or ANR was observed.

Timing-only window, React Profiler disabled, zero dropped measurements:

| Operation | Complete React commit |
| --- | --- |
| Saved-query updates | 14.3-181.7 ms |
| Returned provider results | 302.1 / 303.9 ms |
| Load another 20 results | 389.6 ms |
| Filter both result lists | 386.0 ms |

All recorded action samples were below 500 ms. Five 50-ms-interval samples
still exceeded the 100 ms lag threshold: **122.7, 106.9, 150.6, 167.7, 148.9 ms**.
Do not attribute these conclusively to React, native scheduling, or the host
without further profiling. Removing Profiler did not eliminate the excursions.

[Complete timing window](evidence/2026-09-10-asset-search-followup.json) retains
raw values and original metric labels. Its `to-render` labels mean React commit
completion as explained above; they do not prove native paint.

## Remaining Gate

- Attribute and resolve the remaining >100 ms responsiveness excursions.
- Verify user-visible completion rather than only React commits.
- Repeat on the issue's Pixel 8 reference configuration: only Pixel_10_Pro is
  installed, and Android command-line AVD management tools are absent.
- Keep PR #314 draft and issue #23 open. Do not change thresholds or silently
  substitute another reference device. General frame issue #299 stays parked.
