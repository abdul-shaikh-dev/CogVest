# PPF setup hierarchy verification

3 October 2026. Partial F6 of #512, based on `6804492`, merged #521.

## Change

The account form now orders sections as Account, Starting balance, Opening and status, then Optional identification. The balance and its confirmation date stay together. The account suffix remains editable with its existing validation, but no longer precedes the balance. Form-only vertical section padding uses 8dp instead of 16dp. Field sizes, labels, review panels and discard protection are unchanged.

No financial calculations, validation rules, defaults, saved records, schemas or dependencies changed. The relocated suffix has its own section offset for error scrolling. Existing account details and ledger screens are outside this change.

## Automated checks

- Focused account-form suite: 16 tests passed. Covers both display modes, section order, retained optional values, relocated suffix error scrolling, review/save, dirty exit and masked editing.
- Final `npm run test:v1:pc`: 189 suites and 2,007 tests passed; one suite and three tests skipped. Typecheck, Expo Doctor 17/17, Android Doctor and strict installed-package smoke passed.
- Fresh local x86_64 debug APK built with `npm run android:apk:emulator` and installed with `adb install -r`. Current branch JavaScript served through offline Metro. This is not a signed cloud preview build.
- Large-text `e2e/visual/ppf-setup-validation.yaml` passed: invalid suffix is revealed, correction remains visible above the open keyboard, review and Keep editing preserve it, and saving produces exactly one PPF account with INR 250,000 confirmed balance. The flow asserts the stored-data evidence screen, not only the save message.

## Environment and evidence

CogVest_UX_Proof, API 36, density 480, reduced motion enabled. Normal: 1280 x 2856, font scale 1.0. Large: 1080 x 2400, font scale 1.3, cold-restarted after the configuration change. Standard and Minimal intentionally retain the same account fields.

After verification, the synthetic visual-QA portfolio was restored, with Standard mode, normal dimensions and font scale 1.0. No real financial records were read or changed.

`e2e/visual/ppf-setup-hierarchy.yaml` captures entry, the balance section, and the balance keyboard in each configuration. All values are synthetic. The validation flow resets emulator data only.

All four before and four after capture runs passed. There are 28 published images: 12 before, 12 after, three large-text validation/review images, and one reopened saved balance. Visual inspection confirms the normal-text balance/date pair now appears together in the initial viewport instead of below opening/status controls. The large-text layout keeps persistent labels and full-sized fields; both balance and suffix remain visible above the keyboard. No clipping was found in the inspected settled layouts.

| Configuration | Before | After |
| --- | --- | --- |
| Normal, Standard and Minimal | [Images](../reviews/artifacts/2026-10-03-ppf-setup-hierarchy/before/normal) | [Images](../reviews/artifacts/2026-10-03-ppf-setup-hierarchy/after/normal) |
| Large, Standard and Minimal | [Images](../reviews/artifacts/2026-10-03-ppf-setup-hierarchy/before/large) | [Images](../reviews/artifacts/2026-10-03-ppf-setup-hierarchy/after/large) |

## Limits

No physical-phone, signed-preview, TalkBack or performance claim. Masked editing, exact opening dates and extension status retain component coverage rather than new native captures in this batch. No color tokens changed, so this is not a new contrast audit. Some unedited screenshots contain the React Native development warning toast.

The first validation capture typed into an automatically focused field without opening the keyboard. Its subsequent hide-keyboard command acted as Back and showed the discard screen. The script now explicitly taps the field before editing; that first run is not counted as passing or as keyboard evidence. Initial ordering tests failed against the original layout and passed after the change.

The existing `e2e/ppf-account.yaml` passed provider-error recovery, saving INR 100,000, ledger-note preservation and discard without changing the balance. It stopped at the Holdings tab because the debug warning toast covered it. A follow-up dismissed the toast at `93%,92%` on this recorded normal-size emulator, repeated the same tab navigation, and passed the remaining Holdings/list/reopen assertions with INR 100,000 still displayed. The original full script is not claimed as passing uninterrupted. No app behavior was changed to bypass the test.

F6 remains open for Futures form hierarchy; additional import-entry observations also remain under #512.
