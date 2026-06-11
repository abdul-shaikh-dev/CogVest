# Issue #110 UI Parity and Emulator QA Spec

## Objective

Close the remaining V1 readiness gap between the accepted CogVest design
baseline and the React Native app by verifying the real Android implementation,
fixing small parity defects, and documenting any acceptable V1 compromises.

Issue: https://github.com/abdul-shaikh-dev/CogVest/issues/110

## Baseline Sources

- `docs/design/v1-screen-baseline.md`
- `docs/design/v1-ux-research-baseline.md`
- `docs/design/issue-86-premium-preview/index.html`
- `docs/design/figma/issue-69-v1-screens/code.js`
- `DESIGN.md`
- `AGENTS.md`

The baseline source of truth is the markdown contract. The HTML preview and
Figma generator are visual references, not production data sources.

## Scope

Verify and, if needed, polish these V1 surfaces:

- Dashboard
- Holdings
- Add Holding
- Monthly Progress
- Cash Ledger
- Settings
- Empty/error/manual fallback states that are visible in V1

The work is a V1 parity and QA pass. It must not expand product scope.

## Non-Goals

- No Minimal Mode implementation.
- No LTCG UI.
- No import/export.
- No auth, backend, cloud sync, analytics, or push notifications.
- No V2/V3 historical chart feature expansion.
- No spreadsheet grid, formula editor, macro support, or Excel import/export.
- No EAS cloud builds unless the user explicitly asks.

## Product Rules

- The app remains local-first and Android-first.
- User-facing language must prefer Dashboard, Holdings, Add Holding, Progress,
  Cash, and Settings.
- Add Holding is the user-facing entry point. Any internal Add Trade route must
  stay hidden and must not leak into visible labels.
- Add Holding search must be explicit-selection-first. Searching must not
  auto-pick the first result.
- Production screens must use persisted local data, domain-derived values, or
  clear empty states. Do not fake chart or portfolio history.

## Required Verification

### Screen Parity

For each V1 screen, compare the emulator UI against
`docs/design/v1-screen-baseline.md`:

- Dashboard shows portfolio value, invested value, P&L, allocation, monthly
  context, quote status, value masking, and calm conviction guidance.
- Holdings shows Add Holding, search, value masking, filters, allocation,
  quantity, average cost, current price, invested value, P&L, P&L %, and quote
  state.
- Add Holding supports lookup, explicit selection, manual fallback,
  classification, position details, optional conviction/note, derived preview,
  and save.
- Monthly Progress shows compact snapshot entry, `Value Gap` chart, `Asset
  Momentum` chart with cash excluded, `Monthly Change Breakdown`, and
  no-snapshot state.
- Cash Ledger shows balance, added/invested/available/savings context, deposit,
  withdrawal, investment transfer, and recent ledger or empty state.
- Settings clearly communicates local-first privacy, value masking, quote
  status, currency/app info, and deferred destructive data action.

### State Coverage

Verify or test:

- empty portfolio state
- empty cash ledger state
- no monthly snapshot state
- quote lookup result selection
- manual quote fallback/provider error copy
- value masking on visible wealth values

### Android Evidence

Run the PC-only Android harness where possible:

- `npm run test:verify`
- `npm run android:doctor`
- `npm run android:smoke`
- `npm run maestro:check`
- `npm run maestro:test` if Maestro is available
- emulator launch/navigation smoke using `npm run start:clear` or installed APK
  workflow, depending on current local setup

If the emulator or Maestro is unavailable, document the exact blocker and keep
static verification moving.

## Expected Deliverables

- Any small React Native parity fixes required by the baseline.
- Test updates for fixed behavior or missing state coverage.
- `docs/testing/issue-110-ui-parity-qa.md` with emulator observations,
  screenshots/paths if captured, commands run, results, accepted compromises,
  and remaining follow-ups if any.
- PR body includes `Closes #110`.

## Acceptance Criteria

- The six V1 screens are verified against the baseline.
- Drift is fixed or documented as an accepted V1 compromise.
- Settings does not present unsupported rows as working actions.
- Add Holding remains explicit-selection-first.
- Progress keeps the two accepted V1 chart treatments and does not duplicate
  asset snapshot data below the charts.
- Static verification passes.
- Android emulator smoke/navigation QA is run or a concrete blocker is logged.
- No V1 scope boundaries are violated.
