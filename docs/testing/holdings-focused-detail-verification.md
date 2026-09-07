# Holdings Focused Detail Verification

Verified 8 September 2026 for PR #308 against the approved
[preview](../design/previews/holdings-focused-detail/README.md) and
[screen baseline](../design/v1-screen-baseline.md).

## Installed App

- Fresh local debug APK built with `npm run android:apk:emulator`.
- Installed in place on `emulator-5554` (Pixel_10_Pro), package
  `com.abdulshaikh.cogvest`, version 1.0.1, last update 04:42:18 local time.
- The existing installation used the private local QA signing key. The newly
  built APK was signed with that same key and installed using `adb install -r`;
  no uninstall, app-data reset, or financial-record mutation was performed.
- APK SHA-256:
  `3D9560D1C34664FA83DB7FA5E0AC038B2AB9234623EDD8C83C528963F3C8CDB2`.
- Current JavaScript was served by Metro on port 8081 with adb reverse. This is
  debug installed-app verification, not standalone release/performance evidence.
  No EAS build was triggered. APK and signing credentials are not committed.

## Checks

- `npm run test:v1:pc`: typecheck, 104 suites / 1,079 tests, Expo Doctor 17/17,
  Android doctor, and strict installed-package smoke passed.
- Focused Holdings screen/helper tests: 41 passed after review corrections.
- `npm run maestro:test -- e2e/standalone/holdings-focused-detail.yaml`: passed.
  This opt-in journey requires the retained synthetic visual-QA HDFC holding
  (25 units, invested INR 36,250); it does not seed or reset a portfolio.
- Journey assertions cover exact average cost, invested value, quantity, first
  recorded purchase, masking, explicit Back, Android Back, retained search,
  opening-position correction navigation, and Sell / redeem navigation. It
  leaves both editing screens without saving.
- Existing correction/list journeys were adapted to the new detail panel and
  View records disclosure. Their full destructive/setup flows were not rerun;
  the retained-data journey exercises the changed navigation without resetting
  the emulator.
- Independent owned-diff review found allocation-scope, purchase-date visibility,
  and source-timestamp omissions; all were corrected and rechecked successfully.

## Visual Evidence

Retained synthetic holdings use actual stored records and current quotes, not
the HTML preview's illustrative values. Quote changes between screenshots are
expected; stable record amounts are asserted by Maestro.

- [Standard filtered list](artifacts/2026-09-08-holdings-focused-detail/list.png)
- [Standard detail](artifacts/2026-09-08-holdings-focused-detail/detail.png)
- [Approximately 359dp, 130% text list](artifacts/2026-09-08-holdings-focused-detail/list-narrow.png)
- [Approximately 359dp, 130% text detail](artifacts/2026-09-08-holdings-focused-detail/detail-narrow.png)

The narrow pass uses a 1280px emulator width at density 570 and font scale 1.3.
Filters wrap, insights moves to its own line, multiline names top-align with
values, and the source timestamp has its own wrapping line. The detail screen
scrolls; actions below the fold remain accessible. Standard screenshots were
taken before the final timestamp-stacking and singular-position copy polish;
the narrow captures include those changes. This is structural/visual review,
not a claim of exact pixel equality with HTML.

Density changes during a running Expo debug session produced an Expo Router
multiple-linking warning and stale navigation state. Cold-launching the app at
the target density cleared it. Restore density and text size and cold-launch
again after checking; do not rely on hot-reloaded state for this verification.
Original density 480 and font scale 1.0 were restored.

Missing valuation, empty search, cash/legacy-PPF allocation exclusion, and PPF
destinations are covered by component tests. They were not all recreated in the
retained emulator portfolio. Dedicated standalone-release, TalkBack, and full
PPF visual passes are not claimed here.
