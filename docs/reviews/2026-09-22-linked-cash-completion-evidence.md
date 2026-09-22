# Linked Cash completion evidence - 2026-09-22

## Scope

This follow-up completes the installed-app evidence left open in the initial
[#409 report](2026-09-22-linked-cash-visual-evidence.md): linked sale, Android
Back, saved correction, masking and missing-owner recovery.

## Build and device

- Base commit: `e055112` (`main` after PR #421)
- Final APK: fresh local x86_64 debug build with the task-owned JavaScript bundle
  embedded
- Final APK SHA-256:
  `BAF2D68D2445CCD186E45EC1324DF7FF62A44E7B8E80FCA6B26F110D65C319A7`
- Device: isolated `CogVest_UX_Proof` AVD, `sdk_gphone64_x86_64`, Android 16 /
  API 36
- Configuration: 1280 x 2856 at density 480, font scale 1.0
- Data: only invented contribution, purchase and sale records were used

## Production journeys

Android Back from the owning purchase returned to the read-only linked Cash
intermediary. Correcting the purchase from two units at INR 100 to two units at
INR 150 returned directly to Cash, changed the linked withdrawal from INR 200 to
INR 300 and changed deployable cash from INR 800 to INR 700.

- [Android Back to linked Cash review](artifacts/2026-09-22-linked-cash-completion/01-android-back-intermediary.png)
- [Atomic purchase correction and Cash return](artifacts/2026-09-22-linked-cash-completion/02-corrected-purchase-return.png)

Selling one unit for INR 200 created a linked sale-proceeds entry and increased
deployable cash from INR 700 to INR 900. The intermediary identified its owner as
a sale, opened that fixed-identity transaction and returned to the same Cash
context.

- [Linked sale in Cash Ledger](artifacts/2026-09-22-linked-cash-completion/03-linked-sale-ledger.png)
- [Read-only linked sale review](artifacts/2026-09-22-linked-cash-completion/04-linked-sale-review.png)
- [Owning sale transaction](artifacts/2026-09-22-linked-cash-completion/05-linked-sale-owner.png)
- [Cash restored after sale review](artifacts/2026-09-22-linked-cash-completion/06-linked-sale-return.png)

## Masking correction

Visual inspection found that Cash rows and totals were masked while the monthly
investment sentence still disclosed the amount. The sentence now uses the same
masked INR token. The linked intermediary exposes identity and route context but
no amount, and the owning transaction requires reveal. Its return action now says
`Back to Cash Ledger` instead of the incorrect `Back to Holdings`.

- [Cash Ledger with monthly movement masked](artifacts/2026-09-22-linked-cash-completion/07-masked-cash-ledger.png)
- [Masked linked Cash review](artifacts/2026-09-22-linked-cash-completion/08-masked-linked-review.png)
- [Masked owner with correct Cash return label](artifacts/2026-09-22-linked-cash-completion/09-masked-owner-return.png)

## Missing owner

A valid user action cannot create an orphaned linked Cash movement because trade
deletion removes its linked movement atomically. A development-only, token-gated
QA state therefore supplied the orphan without corrupting persisted user data.
The installed screen disclosed no amount, offered no owner action, explained that
the record remains read-only and directed the user to restore a backup or reimport
complete history.

- [Missing-owner recovery](artifacts/2026-09-22-linked-cash-completion/10-missing-owner-recovery.png)

## Result

All #409 acceptance criteria now have installed visual evidence or installed
behavioral evidence, with automated coverage for linked purchase, linked sale,
missing owner, masking, atomic correction and return context. The missing-owner
screen is the only QA-seeded state; all other journeys used normal app workflows.

## Verification

- Permanent installed-app flow:
  `maestro --device emulator-5556 test e2e/visual/linked-cash-missing-owner.yaml`
- Focused tests: 5 suites and 35 tests passed
- Full gate: `npm run test:verify`
- Jest: 167 suites passed, 1 skipped; 1,746 tests passed, 3 skipped
- Expo Doctor: 17/17 checks passed
