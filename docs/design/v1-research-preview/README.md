# CogVest V1 Research Preview

Static visual preview for the June 2026 V1 UX research baseline.

Tracking issue: #132

Canonical references:

- `DESIGN.md`
- `docs/design/v1-ux-research-baseline.md`
- `docs/design/v1-screen-baseline.md`
- `docs/superpowers/specs/2026-06-07-issue-122-progress-chart-richness.md`
- `docs/superpowers/specs/2026-06-11-progress-lower-sections-polish.md`

## Purpose

This preview translates the updated research findings into a visual reference
for all V1 screens:

- Dashboard
- Holdings
- Add Holding
- Progress
- Cash Ledger
- Settings

It is a design artifact only. It does not modify the Expo app and does not
represent production data.

## Run

Foreground server from the repo root:

```powershell
npm run preview:v1:research
```

Open:

```text
http://127.0.0.1:4175
```

Background server from the repo root:

```powershell
npm run preview:v1:research:start
npm run preview:v1:research:status
npm run preview:v1:research:stop
```

The background command writes a PID file under the repo-local
`.preview-server/` directory by default so Codex and the developer can check
whether the preview is actually still running. Override with
`COGVEST_PREVIEW_STATE_DIR` only if needed.

## Design Notes

- Uses the answer-first, evidence-second, action-last model.
- Keeps Progress as a statement-summary screen.
- Uses `Value Gap`, `Asset Momentum`, and `Monthly Change Breakdown`.
- Keeps Add Holding explicit-selection-first.
- Treats Cash Ledger as deployable capital, not a placeholder.
- Keeps Settings focused on local-first trust.

## Current Screen Contract

This preview is the current visual handoff for implementing the V1 research
baseline. It should be used with `docs/design/v1-screen-baseline.md`; if the
implementation differs, document the drift before merging.

### Dashboard

Dashboard owns portfolio-level answers:

- total portfolio value
- invested value
- P&L and return
- allocation summary
- quote freshness
- next useful review action

Do not turn Dashboard into a holdings table or market terminal.

### Holdings

Holdings is a position-review screen, not a repeated portfolio-value screen.

The preview intentionally does not lead with total holdings value. Dashboard
already answers that. Holdings should answer:

- What do I own?
- Which positions dominate the portfolio?
- Which holdings need review?
- Which holdings are moving most?
- Is the portfolio concentrated?

Current preview structure:

- Header: `24 positions - quotes updated 2m ago`.
- Insight cards:
  - `Largest position`
  - `Needs review`
  - `Top mover`
  - `Weakest holding`
- `Exposure mix` segmented bar for Equity, Debt, and Crypto.
- Smart filters:
  - `Needs review`
  - `High allocation`
  - `Manual price`
  - `Gainers`
  - `Losers`
- Compact holding rows.

Holding row hierarchy:

- Primary: asset name, current value, P&L percentage.
- Secondary: asset class/type, invested value, allocation, quote state.
- Details such as quantity, average cost, current price, sector, and notes
  should be available on tap or expanded detail, not crammed into every row.

### Add Holding

Add Holding is assisted capture, not a trading ticket.

The full conceptual flow is:

1. Search asset.
2. Explicitly select result.
3. Confirm provider metadata.
4. Enter position details.
5. Review derived preview.
6. Save.

The visual preview shows the mature selected-asset state:

- compact progress rail: `Step 3 of 5 - position details`
- selected asset summary with `Change`
- `Review metadata` with editable provider suggestions
- `Position details` for quantity, average cost, current price, acquisition
  date, and price source
- `Derived preview` showing invested/current/P&L
- primary CTA: `Review and save`

Rules:

- Search must never auto-pick the first result.
- Provider metadata must be labelled as a suggestion/reviewable.
- Manual entry and manual price fallback must exist but stay secondary.
- Persist raw user records; derive invested value, current value, P&L, and
  allocation.
- Conviction remains optional and should not make the basic capture path feel
  heavier.

### Progress

Progress is a statement-summary screen:

- `Value Gap`: portfolio value against invested capital.
- `Asset Momentum`: Equity, Debt, and Crypto over time; Cash excluded.
- `Monthly Change Breakdown`: selected month versus previous month.
- Compact month-end snapshot CTA only.

The main Progress screen should not embed the full snapshot-entry form.

### Cash Ledger

Cash Ledger should explain deployable capital:

- available cash
- cash balance
- added cash
- invested/transferred cash
- reserve context
- recent movement
- compact add-entry CTA

### Settings

Settings should reinforce local-first trust:

- local storage active
- no account, cloud, or analytics
- value masking
- quote/manual fallback state
- deferred V2/V3 features clearly marked as future or read-only

## Implementation Notes

- Treat this preview as visual direction, not production data.
- Preserve the primary tab set: Dashboard, Holdings, Progress, Cash, Settings.
- Add Holding is a secondary flow launched from Dashboard/Holdings.
- Prefer reusable app components for these patterns:
  - insight cards
  - exposure bars
  - holding rows
  - progress chart cards
  - grouped setting rows
  - assisted-capture form sections
- Keep all business calculations in `src/domain/`.
- Use stored local records or honest empty states in production.
