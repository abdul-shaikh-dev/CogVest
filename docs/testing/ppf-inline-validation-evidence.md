# PPF inline validation evidence

- Issue: #352
- Date: 2026-09-14
- Build: fresh local Android debug APK

## Verified behavior

- Review with a valid balance and an empty Bank or Post Office field shows
  `Bank or Post Office is required.` directly below that field.
- The form scrolls back to the first invalid control and keeps it visible above
  the open Android keyboard. Text inputs receive keyboard focus; date controls
  receive accessibility focus without opening the date picker automatically.
- Android Back dismisses the keyboard without removing the error or entered
  values. Correcting one field clears only its error.
- Multiple invalid fields retain their own inline errors and all entered values.
  Failed review creates no PPF account.
- Correcting the field, reviewing and saving creates one PPF account with the
  entered INR 100,000 confirmed balance, then opens its saved detail screen.

## Device evidence

Pixel_10_Pro, Android API 36, development build:

- Normal: 1280 x 2856 physical pixels, density 480, font scale 1.0.
- Large text: 1080 x 2400 physical pixels, density 480 (360dp wide), font scale
  1.3.
- Emulator display and font overrides were restored after verification.

Before: [detached error](../reviews/artifacts/2026-09-12-platform-ux/31-ppf-validation.png)

After:

- [Normal size](artifacts/ppf-inline-validation/normal.png)
- [360dp and 130% text](artifacts/ppf-inline-validation/narrow-130.png)

## Verification

- `npm run test:verify`
- `maestro test e2e/ppf-account.yaml`
- `maestro test e2e/visual/ppf-inline-validation.yaml` at both configurations
- `npm run test:v1:pc`

No remaining limitation is known within #352. This change does not redesign the
PPF form, alter its schema, or add provider behavior.
