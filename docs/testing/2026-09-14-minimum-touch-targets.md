# Minimum Touch Target Verification

Issue: #359

## Behavior verified

- Shared `AppButton` controls now enforce a minimum 48 x 48 dp target. This
  includes both month-navigation arrows without enlarging their glyphs.
- Add Holding's selected-asset `Change` action measures 173 x 144 px at 480
  dpi, approximately 57.7 x 48 dp. An edge tap returned to asset selection.
- Add Holding review `Edit position` measures 144 x 144 px, exactly 48 x 48
  dp. An edge tap opened Position Details.
- Portfolio chart arrows measure 144 x 144 px, exactly 48 x 48 dp. At the
  latest month, an edge tap on disabled Next preserved May 2026; an edge tap
  on enabled Previous selected April 2026. Their targets do not overlap.
- At 360 dp and 130% text, the five chart range controls remain fully visible,
  the arrows remain 48 x 48 dp, and Add Holding form/review actions do not clip.
- The quantity field remains visible when its keyboard is open. Android Back
  dismisses the keyboard before leaving the form.

## Evidence

- Before: the audit's [selected-asset evidence](../reviews/artifacts/2026-09-12-platform-ux/08-confirm-asset.png)
  and measured findings in [the platform UX audit](../reviews/2026-09-12-platform-ux-audit.md).
- Normal chart after: [screenshot](artifacts/2026-09-14-touch-targets/chart-normal.png)
  and [native hierarchy](artifacts/2026-09-14-touch-targets/chart-normal.xml).
- Narrow chart after: [screenshot](artifacts/2026-09-14-touch-targets/chart-narrow.png)
  and [native hierarchy](artifacts/2026-09-14-touch-targets/chart-narrow.xml).
- Narrow Add Holding review: [screenshot](artifacts/2026-09-14-touch-targets/narrow-review.png)
  and [native hierarchy](artifacts/2026-09-14-touch-targets/narrow-review.xml).
- Narrow keyboard: [screenshot](artifacts/2026-09-14-touch-targets/narrow-keyboard.png)
  and [Position hierarchy](artifacts/2026-09-14-touch-targets/narrow-position.xml).
- Edge results are retained in
  [disabled Next hierarchy](artifacts/2026-09-14-touch-targets/chart-disabled-edge.xml)
  and [enabled Previous hierarchy](artifacts/2026-09-14-touch-targets/chart-enabled-edge.xml).

## Environment and checks

- Pixel_10_Pro AVD, Android API 36, emulator-5554, debug APK installed fresh
  from this branch, density 480.
- Normal: 1280 x 2856, font scale 1.0.
- Narrow/large text: 1080 x 2410 (360 dp), font scale 1.3. The emulator was
  restored to its normal size and font scale afterward.
- `npm run test:v1:pc`: passed after the final QA-harness correction (1,679
  tests passed, 2 skipped; Expo Doctor 17/17; Android doctor and strict smoke
  passed).
- `npm run android:smoke -- --strict`: passed.
- `npm run maestro:test -- e2e/progress-chart-month-navigation.yaml`: passed at
  both configurations and asserted selected-month data after navigation.

## Limitations

- This is target-size, semantics, keyboard, Android Back, and installed-layout
  verification, not full TalkBack certification.
- No persistence or financial save path changed. Existing component tests cover
  the shared target contract and existing Add Holding tests cover its saved-data
  behavior.
- The existing Add Holding Maestro flow dropped the final injected search
  character on this emulator run. Native hierarchy inspection and controlled
  edge taps were used for the selected-asset action instead; this input-harness
  behavior is unrelated to the target-size change.
