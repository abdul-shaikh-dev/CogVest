# V1 UI Mockup Plan

> Status: historical V1 visual planning reference. For current V1 UI work, use
> `DESIGN.md`, `docs/design/v1-screen-baseline.md`,
> `docs/design/issue-86-premium-preview/index.html`, and
> `docs/design/figma/issue-69-v1-screens/code.js` as the source of truth. This
> document remains only for early context.

Figma: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d

## Design System

- Android frame: 390 x 844.
- Current V1 uses the true-dark palette, borderless cards, and typography rules
  from `DESIGN.md`.
- Older colors in early mockups are superseded.

## Screens

### Empty Dashboard

Show total `₹0.00`, no allocation, and a strong `Add Holding` CTA. Empty copy should explain that holdings are created from user-entered records.

### Filled Dashboard

Show portfolio value, invested value, P&L, return, allocation summary, quote
freshness, monthly context, and calm conviction/insight context. Do not show
Minimal Mode or LTCG.

### Add Holding

Use the multi-phase baseline: search, explicit asset selection, classification,
position, derived preview, review. The search result must not auto-select; the
user chooses the asset before autofill. Include manual fallback, quantity,
average/current price, date, optional conviction, optional note, and review
before save.

### Holdings Empty

Show empty card with “No holdings yet” and CTA to Add Holding.

### Holdings Filled

Holding card rows: asset name/symbol, asset class metadata, current value,
invested value, allocation, quantity, average cost, current price, unrealised
P&L, quote freshness, and stale/manual state where relevant. No LTCG badge in
V1.

### Monthly Progress

Use two stored-snapshot-driven graph areas when data exists: total portfolio
value vs invested value, and assets vs months excluding cash. If no snapshots
exist, show a clear no-snapshot state. Do not fake production chart history.

### Cash Empty/Filled

Hero cash balance, Add Cash and Withdraw buttons, entry history rows.

### Settings

Value masking toggle, quote refresh note, local-first privacy copy, app version placeholder.

### Value Masking

Mask INR wealth values with `₹**** **,***.**`. Do not mask quantities, percentages, or market price per unit.

## Interactions

- Pressable opacity feedback at 0.75.
- Haptics on Add Holding confirm and value masking toggle.
- Pull-to-refresh on Dashboard/Holdings.
- Clear error text for invalid sell quantity and quote failures.

## Manual Figma Recreation Notes

Use the real Figma file as the primary reference. If it is unavailable, recreate screens with the layout order above, 16px horizontal padding, 10px card gap, and 12px internal spacing.
