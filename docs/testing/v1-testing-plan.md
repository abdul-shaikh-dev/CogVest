# V1 Testing Plan

## Automated Tests

Run on every V1 issue:

```bash
npm run typecheck
npm test
```

Run before release gate:

```bash
npx expo doctor
npx expo start
```

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
- Add Trade validation messages.
- Conviction selector select/deselect.
- MaskedValue display.
- Cash add/withdraw rows.

## Manual Android QA

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

## E2E Scope

Maestro is optional for V1 development but recommended before release:
- add trade
- holdings update
- dashboard total
- cash flow
- value masking

## Known Test Boundaries

Default CI should not require Android emulator. Device/emulator testing is manual or release-gate only.
