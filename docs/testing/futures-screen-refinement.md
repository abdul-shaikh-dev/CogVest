# Futures screen refinement

Issue #488, parent #484. Run date: 2026-10-02.

## Scope

The current wallet balance now leads the screen. Open positions have their own section, with separate notional and indicative-margin labels. Starting-wallet correction follows routine activity and linked Cash funding. Missing marks do not acquire a numeric value or a misleading USDT suffix in the notional field. Account equity, realized P&L, fees, funding and INR provenance keep their existing meaning.

No financial model, conversion, persistence, execution chronology or deletion rule changed. Event forms and draft protection are retained, as are verification and leverage-risk warnings. No exchange connection or import was added.

## Build and environment

- CogVest_UX_Proof, emulator-5554, Android API 36, x86_64, density 480.
- Normal 1280x2856/font 1.0; large text 1080x2400/font 1.3.
- Fresh bundled release APK built locally with `npm run android:apk:release -- --architecture=x86_64`.
- Original APK SHA-256: `406623DD7E8C6CED2DDC33170D13B10322203A13EEAD3292D7D124CA8B13F977`.
- Installed emulator-only copy SHA-256: `B49FE9741AEA0C788D3C1CC0E122FBA5622A57537B933837F042ED6D64FD62C8`.
- The emulator retains its existing Android debug certificate. Only the local QA copy was re-signed to update in place; release signing configuration is unchanged. No uninstall, data clearing or cloud build.

## Verification

`npm run test:v1:pc` passed with 1,959 tests, 187 passing suites, one skipped suite and three skipped tests. This includes type checking, Expo doctor and strict Android smoke. The added test checks separate wallet/position presentation, missing INR evidence and masking without record changes. Existing tests cover complete close/correct/reconcile cycles, linked Cash accounting, timestamp errors and draft protection.

Synthetic native flows live in `e2e/visual/futures-refinement-*.yaml`. Setup requires no existing Futures wallet and creates a task-owned 1,000 USDT opening balance plus one buy of quantity 1 at 100 USDT, fee 1 USDT, leverage 10. It never clears state. The remaining portfolio starts with five assets and INR 50,000 Cash.

The first close-trade automation omitted the required reported leverage. The app rejected it without changing the 999 USDT wallet. The corrected flow supplies leverage. This was a test-input failure, not a bypass of validation.

An emulator handwriting tutorial then intercepted the funding input. The app again rejected the empty field. After temporarily disabling handwriting, the separate funding flow asserted the typed amount and confirmed a 1,006 USDT wallet. Entry/correction/close assertions passed in the preceding review run; funding was resumed separately rather than claiming one uninterrupted pass.

The Cash flow passed: 100 USDT at INR 90 debited INR 9,000, leaving INR 41,000 Cash and 1,106 USDT in the wallet. Deleting the wallet was blocked with the linked-Cash warning; the wallet survived restart. These checks exercise actual stored records through the installed app, not only success messages.

The large-text flow passed. Cancelling transfer deletion retained the record; confirming deletion restored INR 50,000 Cash and a 1,006 USDT wallet. Removing the task-created closing execution restored the open long and left 997 USDT after its entry fee and funding. Masking hid the wallet value. Final deletion removed only the task-created wallet; five original assets and INR 50,000 Cash remained. Display settings returned to normal.

Before/after screenshots are in [artifacts/futures-screen-refinement](artifacts/futures-screen-refinement). Normal evidence includes wallet, position, discard, invalid entry, closed trade, Cash form and blocked deletion. Large-text evidence includes wallet, open position/risk, masking, correction form, no-wallet and deletion confirmation.

## Limits

No physical-phone, TalkBack, live Binance reconciliation or price-provider verification is claimed. Native fixtures deliberately leave FX/mark evidence missing; complete INR valuation and failure injection remain covered by automated screen/domain/store tests. Financial values are synthetic.
