# Holding Return Context Verification

Issue: #353

## Behavior verified

- Back and Cancel from opening-position review and Sell / redeem return to the
  same holding detail, expanded records, and detail scroll position.
- Android Back closes holding detail without navigating to Dashboard; the next
  Back returns to the preserved searched Holdings list.
- A successful opening-position correction returns to the same detail, keeps
  completion feedback visible, updates quantity from 2 to 3, and updates the
  Dashboard value to INR 300.
- Removing the selected holding closes stale detail state without mutating data
  through navigation.

## Environment

- Pixel_10_Pro AVD, Android API 36, emulator-5554.
- Normal pass: physical 1280x2856, density 480, font scale 1.0.
- Narrow/enlarged-text pass: 1080x2410 at density 480 (360 dp wide), font scale
  1.3. The emulator was restored to its normal configuration afterward.
- Fresh local debug APK built and installed with `npm run android`; current
  branch JavaScript was served by Metro.

## Results

- `npm run test:v1:pc`: passed (1,679 tests passed, 2 skipped; Expo Doctor
  17/17; Android doctor and strict installed-package smoke passed).
- `npm run maestro:test -- e2e/standalone/holdings-focused-detail.yaml`: passed
  at normal size and again at 360 dp / 130% text.
- `npm run maestro:test -- e2e/opening-position-correction.yaml`: passed with
  restored-detail and resulting-data assertions.
