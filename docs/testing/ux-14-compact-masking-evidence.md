# Compact Masking Verification

Date: 2026-09-19. Scope: UX issue #363 on
`ux-14-compact-masking`.

## Behavior Contract

- Wealth amounts use one fixed `₹••••` token. The token does not preserve digit
  count, grouping, decimals, or approximate magnitude.
- Masked text exposes `Amount hidden` to accessibility services instead of the
  underlying amount or a caller-provided value label.
- Quantities, percentages, allocation, and per-unit prices remain visible under
  the amount-only privacy setting where their surrounding view is visible.
- Minimal mode remains an emphasis and optional-insight reduction. It is not a
  separate dense layout and does not remove essential records, snapshot status,
  or save actions.

## Build And Runtime

- `npm run android:apk:emulator`: passed; local debug APK built without EAS.
- Installed `android/app/build/outputs/apk/debug/app-debug.apk` with
  `adb -s emulator-5554 install -r` before native verification.
- APK SHA256: `BD3F0D650F4796294CCA7E35D2ECA45B2E1C40206251940553EF372FCFD20022`.
- Pixel 10 Pro emulator, `emulator-5554`; package
  `com.abdulshaikh.cogvest`; Metro served the current branch on port 8081.
- Test data was created by the tracked Maestro flow. No personal portfolio or
  statement data appears in the captures.

## Installed-App Verification

- `npm run test:v1:pc`: passed, including typecheck, 164 passed Jest suites /
  1,697 passed tests, Expo Doctor 17/17, Android doctor, and strict
  installed-package smoke.
- `npm run maestro:check`: passed with Java 21.0.10, `emulator-5554`, Maestro
  2.5.1, and the installed CogVest package.
- `npm run maestro:test -- e2e/value-masking.yaml`: passed. The flow creates a
  holding, enables masking, checks `₹••••`, keeps `+11.11%` and quantity `2`
  visible, restarts the app, and rechecks persistence.
- `npm run maestro:test -- e2e/minimal-mode.yaml`: passed. Minimal mode removes
  optional insight sections while retaining holdings search, cash actions,
  progress chart, snapshot status, and the add-holding review/save action. The
  flow also switches back to Standard and confirms its insight sections return.
- Component tests verify that masked amounts override a value-bearing
  accessibility label with `Amount hidden`, while percentages remain visible.
- Android UI Automator on the narrow capture found two `Amount hidden` nodes,
  `+11.11%`, and `Allocation 100.0%`; it did not contain the source `₹180.00`
  or current `₹200.00` amounts.
- Impeccable static UI detector reported no findings for the changed UI files.

## Native Visual Inspection

Normal display: 1280 x 2856, density 480 (about 427dp wide), font scale 1.0.
Narrow/enlarged-text display: 1080 x 2400, density 480 (360dp wide), font scale
1.3. Original display size and font scale were restored after capture.

Evidence is stored in `docs/testing/artifacts/ux-14-compact-masking/`:

- `holdings-masked-427dp-100.png`
- `holdings-masked-360dp-130.png`
- `holdings-masked-360dp-130.xml`

At both sizes, the fixed token remains compact inside the holding row without
wrapping or hero-value overflow. Percentage and allocation context remains
readable, so the masking treatment does not depend on color or remove the
approved non-amount context.

## Boundaries And Runner Notes

- No financial calculations, persisted record schema, or masking preference
  storage changed. Existing users keep their on/off preference across restart.
- No form or keyboard behavior changed, so keyboard-resize verification is not
  applicable to this issue. The existing add-holding review/save journey passes
  in Minimal mode.
- TalkBack spoken-output quality and physical-phone rendering are not claimed;
  accessibility semantics were checked through component assertions and the
  Android hierarchy.
- The first installed journey reached its Dashboard assertion before Metro's
  cold bundle completed. The cached rerun passed; no production timeout was
  weakened.
- Maestro on this Windows host deletes its timestamped log directory before its
  logger opens. Tests ran with a short-lived external directory guard; the guard
  was stopped after each invocation and did not modify app or repository code.
