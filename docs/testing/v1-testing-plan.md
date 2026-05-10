# V1 Testing Plan

V1 verification is PC-only. A physical Android phone is not required. The
canonical feature matrix is `docs/testing/v1-core-flow-test-matrix.md`, and the
release checklist is `docs/testing/v1-pc-verification-checklist.md`. Excel
tracker parity is gated by `docs/testing/excel-parity-checklist.md`.

## Automated Tests

Run on every V1 issue:

```bash
npm run typecheck
npm test
```

Run before release gate:

```bash
npm run test:v1:pc
```

After the command passes, complete `docs/testing/excel-parity-checklist.md` on
Android Emulator or log defects for failed rows.

## Unit Tests

Cover:
- `calculateHolding`
- `calculateAllocation`
- `portfolioTotal`
- `portfolioDayChange`
- `formatINR`
- trade validation
- conviction readiness
- selectors
- Zustand store actions
- value masking logic

## Component Tests

Cover:
- Empty Dashboard.
- Empty Holdings.
- Add Holding validation messages.
- Add Holding opening-position flow.
- Conviction selector select/deselect.
- MaskedValue display.
- Cash add/withdraw rows.
- Monthly Progress snapshot save/update.

## Android Emulator QA

- Add buy trade.
- Add sell trade.
- Validate oversell error.
- Confirm holdings update.
- Confirm dashboard total updates.
- Add and withdraw cash.
- Toggle value masking.
- Restart app and confirm MMKV persistence.
- Pull-to-refresh quotes.
- Confirm no backend/auth/cloud.
- Complete the Excel parity questions in
  `docs/testing/excel-parity-checklist.md`.

## E2E Scope

Maestro is optional for V1 development but recommended before release. It must
run locally against Android Emulator and must not be required in default PR CI:

- add trade
- holdings update
- dashboard total
- cash flow
- value masking
- persistence
- cold launch

## Known Test Boundaries

Default CI should not require Android emulator. Emulator, APK, and Maestro
testing are local PC verification gates only unless explicitly opted in.
