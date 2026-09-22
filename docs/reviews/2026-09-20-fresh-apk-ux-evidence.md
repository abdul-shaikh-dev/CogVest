# Fresh APK UX evidence - 2026-09-20

## Build and device

- Commit: `8e89390` (`feat/current-month-metrics`)
- APK: fresh local debug build from `npm run android:apk:emulator`
- APK SHA-256: `F60BF5C2DE23287BF17074533B10D8731653E4A52FC45D9653DD08A7677C6185`
- Device: isolated `CogVest_UX_Proof` AVD, `sdk_gphone64_x86_64`, Android 16 / API 36
- Physical configuration: 1280 x 2856 at density 480, font scale 1.0
- Constrained configuration: 1080 x 2409 (approximately 360dp) at font scale 1.3
- Destructive confirmation configuration: 1080 x 2409 at font scale 2.0
- Data: package data cleared between independent journeys; only invented fixtures were used

The APK is a development build, so Metro and a development-only warning toast were
present. Evidence captured while Metro was disconnected or while the warning toast
blocked an action was rejected rather than treated as product behavior.

## Active issue #402 evidence

The current-month metric flow passed on a fresh install at normal and constrained
settings. Empty income renders the investment rate as `Unavailable`. Recording an
invented INR 50,000 income entry returns to Dashboard and renders invested INR 0,
investment rate `0.00%`, and cash change `+INR 50K`. At 360dp/130%, the three metrics
reflow without clipping and remain reachable.

- [Empty state](artifacts/2026-09-20-fresh-apk/01-current-month-empty.png)
- [Income recorded](artifacts/2026-09-20-fresh-apk/02-current-month-income.png)
- [360dp and 130% text](artifacts/2026-09-20-fresh-apk/03-current-month-360dp-font130.png)

## Closed UX issue audit

| Issue | Fresh installed evidence | Result |
| --- | --- | --- |
| #348 guided onboarding | Source choice, manual alternative, lookup, review and first saved holding exercised. | Partial. The legacy add-next flow expects lookup mode although the screen preserves manual mode. Full two-file retry was blocked by Android DocumentsUI exposing only one of two pushed files in Recent. |
| #352 PPF field validation | Invalid review at 360dp/130% returned to `Bank or Post Office`, displayed the exact inline error and preserved the entered balance. | Pass for the issue's visual recovery criterion. |
| #362 lower-noise forms | Cash optional notes, draft retention, switch confirmation, keyboard-visible save and resulting INR 1,000 balance exercised at 360dp/130%. | Partial. The final list-row amount was below the viewport when its row title first became visible; Add/PPF/Settings variants were not all repeated in this campaign. |
| #404 secondary-flow masking | Sell/Redeem showed `INR ....` for aggregate current value while units and saved per-unit quote remained visible. | Partial. A clean reveal run and Cash/PPF edit variants remain required. |
| #405 deletion confirmation | Full long asset name and both actions were reachable at 360dp/200%; Android Back cancelled and returned to the asset review. | Partial. Installed landscape testing is impossible while Expo and Android manifest lock the app to portrait. |
| #406 PPF review and Back | Account validation and review were exercised at enlarged text; Android Back returned to the populated editor with `India Post` preserved. | Partial. New/edit PPF entry variants were not repeated. |
| #407 shorter repeat import | CAS password remained visible above the keyboard at 360dp/130%. Tradebook reached file selection and full-history preflight. | Partial. Six-file Tradebook and multi-folio CAS review were not completed in this campaign. |
| #408 Manage Assets scale | No installed fixture currently seeds 30 or 50+ persisted assets. | Not verified. A dedicated installed-app scale fixture or import fixture is required. |
| #409 linked cash route | No fresh installed journey was completed in this campaign. | Not verified. Linked buy, linked sale and missing-owner states remain required. |
| #410 accessible bulk selection | Selection, preview, Back/cancel, delete and resulting units/basis passed with the invented accounting fixture. | Partial. Visual/non-color state passed; a real TalkBack spoken-output run was not performed. |

## Selected evidence

- [PPF inline validation at 360dp/130%](artifacts/2026-09-20-fresh-apk/04-ppf-inline-validation-360-font130.png)
- [PPF editor after Android Back](artifacts/2026-09-20-fresh-apk/05-ppf-review-back-large.png)
- [Deletion confirmation at 360dp/200%](artifacts/2026-09-20-fresh-apk/06-asset-delete-confirm-360-font200.png)
- [CAS password above keyboard](artifacts/2026-09-20-fresh-apk/07-cas-password-360-font130.png)
- [Sell/Redeem masked state](artifacts/2026-09-20-fresh-apk/08-sell-redeem-masked.png)
- [Bulk deletion preview](artifacts/2026-09-20-fresh-apk/09-bulk-delete-preview.png)
- [Guided setup source choice](artifacts/2026-09-20-fresh-apk/10-quick-setup-source-choice.png)
- [Guided setup selected asset](artifacts/2026-09-20-fresh-apk/11-quick-setup-selected-asset.png)

## Required follow-up

This campaign closes the missing visual proof for the active current-month metrics and
the core visual criterion in #352. It does not retroactively make every closed issue
fully verified. Before claiming the historical UX verification debt complete:

1. Add a development-only installed-app fixture for 4, 30 and 50+ persisted assets and verify #408 at normal and enlarged text.
2. Add installed journeys for masked Cash correction, edited PPF entry, and reveal/re-entry behavior to finish #404.
3. Add installed linked-buy, linked-sale and missing-owner journeys to finish #409.
4. Run TalkBack manually for #410 and capture the announced selected-state, asset identity, type, date and distinguishing detail.
5. Decide whether CogVest intentionally remains portrait-only. If yes, revise #405's landscape criterion; otherwise remove the orientation lock and run the landscape case.
6. Stabilize DocumentsUI fixture selection before rerunning six-file Tradebook and multi-folio CAS evidence for #348/#407.
