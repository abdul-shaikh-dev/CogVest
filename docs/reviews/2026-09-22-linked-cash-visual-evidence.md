# Linked Cash visual evidence - 2026-09-22

## Build and device

- Issue: [#409](https://github.com/abdul-shaikh-dev/CogVest/issues/409)
- Commit: `9ff2736` (`main` after PR #420)
- APK: fresh local x86_64 debug build with the current JavaScript bundle embedded
- APK SHA-256: `F1BC7526F39B2FE2272EDA92D21420046780F46A377229ADBA8AAC4B734EC516`
- Device: isolated `CogVest_UX_Proof` AVD, `sdk_gphone64_x86_64`, Android 16 / API 36
- Configuration: 1280 x 2856 at density 480, font scale 1.0
- Data: package data cleared before the journey; only an invented INR 1,000
  contribution and INR 200 purchase were used

The first debug build did not contain a current embedded JavaScript bundle and did
not request Metro. Its React Native `Unable to load script` screen was rejected as
test-environment failure. The APK was rebuilt with a freshly generated bundle before
the evidence below was captured.

## Installed journey

The journey created an invented INR 1,000 contribution and a two-unit purchase at
INR 100 per unit. Cash correctly became INR 800. The purchase-funding cash row
identified itself as an investment movement and exposed the review route.

Opening the row showed its owning asset, `Purchase` type and date without independent
cash-edit controls. `Review linked transaction` opened the transaction correction
screen, where the holding and transaction type remained fixed. Cancelling that screen
returned directly to Cash and preserved the INR 800 balance.

- [Cash Ledger and linked purchase row](artifacts/2026-09-22-linked-cash/01-linked-cash-ledger.png)
- [Read-only linked Cash review](artifacts/2026-09-22-linked-cash/02-linked-cash-review.png)
- [Owning purchase transaction](artifacts/2026-09-22-linked-cash/03-linked-trade-review.png)
- [Cash context restored after Cancel](artifacts/2026-09-22-linked-cash/04-linked-cash-return.png)

## Result and limits

Fresh installed evidence passes the linked-buy route, direct non-editability and
Cancel return-context criteria in #409. The journey also verifies that no record or
balance changed while reviewing the linked transaction.

This is not complete installed evidence for every criterion in #409. A linked sale,
missing/deleted owner, masking, Android Back, and saved-correction return journey were
not visually exercised in this run. Existing automated tests cover those code paths,
but they are not a substitute for fresh installed visual proof.

## Verification

- Focused Jest suites: 2 passed, 16 tests passed
- `npm run test:verify`: 166 suites passed, 1 skipped; 1,745 tests passed, 3
  skipped; Expo Doctor 17/17 checks passed
- Maestro installed journey: passed on `emulator-5556`
