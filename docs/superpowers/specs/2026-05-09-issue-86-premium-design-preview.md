# Issue 86 Premium Design Preview Spec

## Goal

Create a browser-viewable static mockup for the CogVest V1 premium design
screens: Dashboard, Holdings, Add Holding, Monthly Progress, Cash, Settings,
and V1 state coverage.

## Scope

- Create a design-only HTML/CSS/JS preview under `docs/design/issue-86-premium-preview/`.
- Do not modify React Native app code.
- Use the approved design direction from issue #86:
  - premium dark private-ledger UI
  - fewer bordered boxes
  - stronger financial hierarchy
  - Holdings as grouped durable-position rows
  - Add Holding lookup/autofill as the primary path
- Standardize the bottom Add button alignment to match the better-aligned
- Use the V1 tab model: Dashboard, Holdings, Progress, Cash, Settings.
- Keep Add Holding as a secondary Holdings flow, not a bottom-tab destination.

## Screens

1. Dashboard
2. Holdings
3. Add Holding
4. Monthly Progress
5. Cash Ledger
6. Settings
7. V1 States

## Design Rules

- True black background remains intentional for CogVest.
- Cards are borderless by default.
- Hairline separators appear only inside grouped content.
- Green is reserved for active tab, primary action, positive P&L, and selected
  state.
- No purple, neon, trading-terminal visuals, LTCG UI, or Minimal Mode.
- Use realistic V1 sample values only for mockup communication.

## Acceptance

- The preview can be opened from a local static server.
- All six screens render in a desktop grid and stack/toggle on narrow widths.
- Bottom navigation Add button is consistently centered/aligned across screens.
- Holdings no longer looks like a table.
- Add Holding presents search/autofill first and manual entry as fallback.
- Preview includes explicit state coverage notes for empty portfolio, quote
  lookup loading/error, and manual price fallback.
- Static controls use semantic button markup where they represent tappable
  app actions, so the preview remains a safer implementation reference.
- Bottom navigation follows the V1 app model: Dashboard, Holdings, Progress,
  Cash, Settings.
- Add Holding includes lookup, classification, position details, derived
  preview, and review handoff.
- Cash entry uses form-like field blocks, not static ledger rows.
- Monthly Progress uses two graph-style treatments: total portfolio value vs
  invested value by month, then asset values vs months for equity, debt, and
  crypto. Cash remains tracked separately.
- State coverage is shown only inside the V1 States phone frame.
- Monthly Progress prioritizes graph review before the change breakdown.
- Settings uses grouped section labels for privacy, quotes, currency, display,
  and data controls.
