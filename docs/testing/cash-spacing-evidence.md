# Cash overview spacing evidence

Tracker: #512, remaining Cash portion of F3. Baseline: `74516824f9acdb172c43a8e41eab758238facf04` (merged #516).

## Change

Use the compact screen header, reduce the first ledger-month gap, and replace two oversized zero metrics with a wrapping, explicitly labelled row. Nonzero and masked metrics retain their previous presentation. Deposit and Withdraw forms, ledger rows, calculations and storage are unchanged.

Zero Cash added and Invested do not mean no withdrawals or other activity. The compact row therefore retains both metric names instead of claiming no cash movement. Debit colors remain unchanged: signed amounts, direction arrows and purpose labels already distinguish outflows; this is not evidence from a user comprehension study.

## Installed verification

- Fresh local debug APK built with `npm run android:apk:emulator` and installed with `adb install -r`; Metro supplied the bundle. This was not a signed preview build.
- AVD: CogVest_UX_Proof, Android API 36, density 480, reduced motion enabled.
- Normal: 1280 x 2856, font scale 1.0. Large: 1080 x 2400, font scale 1.3.
- Existing synthetic audit portfolio, October 2026 activity, INR 50,000 deployable cash. No financial records were written. The old fixture's 'Salary added' is a free-text ledger label, not a salary feature.
- All four before and four after Maestro runs passed using `e2e/visual/cash-spacing.yaml`, with PHASE, SIZE and MODE parameters.
- Each after run asserted the compact row, opened Deposit, submitted an empty amount and checked validation, cancelled, opened Withdraw, cancelled, and asserted the unchanged INR 50,000 balance.
- Focused Cash tests: 24 passed. Added Standard/Minimal withdrawal-only and masking coverage. `npm run test:v1:pc` passed, including typecheck, tests, Expo Doctor and Android checks.

## Screenshot review

| Configuration | Before | After |
| --- | --- | --- |
| Normal, Standard | [Before](../reviews/artifacts/2026-10-02-cash-spacing/before/normal/standard.png) | [After](../reviews/artifacts/2026-10-02-cash-spacing/after/normal/standard.png) |
| Normal, Minimal | [Before](../reviews/artifacts/2026-10-02-cash-spacing/before/normal/minimal.png) | [After](../reviews/artifacts/2026-10-02-cash-spacing/after/normal/minimal.png) |
| Large, Standard | [Before](../reviews/artifacts/2026-10-02-cash-spacing/before/large/standard.png) | [After](../reviews/artifacts/2026-10-02-cash-spacing/after/large/standard.png) |
| Large, Minimal | [Before](../reviews/artifacts/2026-10-02-cash-spacing/before/large/minimal.png) | [After](../reviews/artifacts/2026-10-02-cash-spacing/after/large/minimal.png) |

The ledger starts earlier without reducing the balance or action prominence. At large font size, the second ledger entry's amount now fits in the viewport; names and amounts remain separated without collision. The zero metrics remain readable in both modes.

Some unedited captures contain a development warning toast over the bottom navigation; clean Standard/normal and Minimal/large captures are also included. This does not establish a warning-free release runtime. No physical-phone, TalkBack, performance or keyboard verification is claimed. Forms were not restyled.

The emulator was returned to normal display/font settings and Standard mode. F4/F8 Progress/history and F5/F6 Settings/forms remain outside this batch.
