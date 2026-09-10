# Phone Onboarding Regression (#322)

## Behavior

- Saving or editing PPF opens the saved account details. It does not return to
  the initial asset form. Quick setup records creation once; editing does not
  count as another saved holding. Continue portfolio setup explicitly returns
  to the setup route. Back has a Holdings fallback if there is no back stack.
- Dashboard and empty Holdings setup open the same chooser as Holdings +,
  including single entry, rapid entry, PPF, holdings CSV and transaction import.
- Market/PPF tabs precede search and conditional notices so their position stays
  stable. Tap or deliberate horizontal swipe selects a destination and resets
  its scroll position. Vertical, short, diagonal, cancelled and multi-touch
  gestures do not switch tabs. Open panels retain their own interactions.
- PPF credited/estimated interest keeps its existing calculation. A baseline
  can include historic interest; it cannot establish lifetime contributed
  principal or a lifetime gain percentage. Statement import is separate #323.

## Repeatable Verification

Build and install a fresh local release APK using
`docs/release/android-release-process.md`. Use only a disposable emulator;
the following flow resets synthetic app data twice:

```powershell
npm run test:v1:pc
npm run maestro:test -- e2e/standalone/phone-onboarding.yaml
```

The native flow checks the Dashboard chooser, runs the market/PPF chart-history
regression, switches both destinations by swipe and tap, creates a second PPF
account through quick setup, checks its INR 50,000 saved balance, edits its name,
then explicitly continues setup and verifies one saved item. It finally checks
the edited account in Holdings. PPF provider is required; enter synthetic HDFC
along with the nickname and balance rather than leaving its placeholder blank.

Inspect the captured Market/PPF screenshots together for stable tab placement,
and the saved-account continuation screenshot for readable interest context.
Keep generated screenshots and Maestro logs local, not personal phone photos.
Unit/route tests additionally cover safe back navigation, cancelled edits,
chooser acknowledgement and rejected gesture sequences, including lifting one
finger after a two-finger gesture.

This emulator-only check is not a new phone distribution or proof of every
physical device's gesture behavior. Never trigger an EAS build for this test.

## Verified 11 September 2026

- `npm run test:v1:pc`: 1,286 tests passed; two existing skipped tests;
  Expo Doctor 17/17; emulator and installed-package checks passed.
- Fresh privately signed x86_64 release APK built locally and installed on
  emulator-5554, Android API 36, without Metro or EAS.
- APK SHA-256: `C4747841B1A03F0B6D232D882280D868543BE7A9747F1D1C60CCF031AFC24F5A`.
- Full native flow passed, including nested PPF chart-history regression.
  Maestro run: `2026-09-11_011823`. Inspected tab placement, saved-account
  interest/continuation, and final Holdings screenshots. Bottom navigation
  remained available in the settled final screen.
- Initial run correctly failed form validation because the test omitted the
  required provider. Corrected test input and reran the entire journey.
- Independent review caught pre-capture multi-touch cancellation; fixed it,
  added a sequence regression, rebuilt the APK, and passed correction review.
- Local screenshots are retained under `.expo/phone-onboarding/`. Personal
  attachments were not changed or published. Physical-phone retest remains
  separate; this APK is emulator-only, not a new phone release.
