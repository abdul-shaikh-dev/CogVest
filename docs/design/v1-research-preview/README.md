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

## Implementation Sync — 2026-06-13

This preview was checked against the live Expo app (`src/`). DESIGN.md remains
the canonical reference for this preview.

Aligned in the preview:

- Replaced the iOS-first font stack (`"SF Pro Display"`) with an Android-first
  stack (`Roboto`, then host fallbacks). The app loads no custom font and
  renders in Roboto on Android (`AppText` sets no `fontFamily`).
- Relaxed the aggressive negative heading tracking on in-screen type to
  `normal`, matching the app's calm numerals (`AppText` base
  `letterSpacing: 0.1`, no negative tracking).

Logged drift — app-side items, NOT changed in this preview:

- Brand/CTA green: this preview and DESIGN.md use Primary Green `#34C759` for
  CTA, active tab, and selected state. The app currently implements those with
  `colors.primary = #2E7D52` and reserves `#34C759` for gains only
  (`src/theme/index.ts`). Code vs DESIGN.md conflict — resolve in the app.
- Touch targets below the 48 dp minimum (DESIGN.md §10): `IconButton` is 42×42
  (`src/components/common/Premium.tsx`), and the Progress range chips and
  Holdings filter chips are ~32-40 dp.
- Press feedback uses opacity, not a Material ripple/state layer.
- `android.predictiveBackGestureEnabled: false` in `app.json`.

## Issue Alignment — 2026-06-13

Reviewed against the open V1 issues. The preview now reflects these explicit specs:

- Progress (#122): chart range options are `3M / 6M / 1Y / All` with `6M`
  default — added the previously-missing `All`. `Value Gap` headline corrected
  from `+15.8%` to `+15.5%` to match #122's seeded target and the preview's own
  figures (₹2.66L gain ÷ ₹17.21L invested = +15.5%). The Dashboard "ahead" pill
  was updated to the same value for cross-screen consistency.
- Cash Ledger (#126): the hero now leads with `Cash balance` and monthly cash
  movement; metric tiles are `Added / Invested / Available / Savings`
  (replacing `Transferred / Reserve`) to match the issue's required metrics.

Confirmed already-aligned (no change needed):

- Add Holding (#117): the issue ratifies the current `Step 3 of 5` selected-asset
  mature state as the accepted preview.
- Progress (#125): the preview already shows only a compact snapshot CTA, not
  the full month-end entry form.
- Holdings (#123) and Dashboard (#127): hierarchy already matches the baseline.

Not covered by any V1 issue:

- Settings has no dedicated V1 implementation issue; it is governed only by the
  #132 baseline contract, so the Settings screen was left unchanged.

## Visual Polish — 2026-06-13

Owner-requested refinements to the preview baseline:

- Removed the green top-right radial "glow" gradients from cards
  (`.hero.statement`, `.insight-card.accent`, `.selected-asset`, `.story`) so
  surfaces stay flat — consistent with DESIGN.md §2 (avoid saturated gradient
  cards) and the flat surfaces in the app.
- Fixed missing vertical gaps between non-card sibling blocks: Add Holding
  (selected asset → card), Progress (breakdown → snapshot card), Cash
  (hero → tiles, section title → list, list → card), Settings (list → card).
