# V1 UX Research Baseline

This document captures the app-wide UX direction from the June 2026 design
research pass. Use it with `DESIGN.md` and `docs/design/v1-screen-baseline.md`
for V1 UI planning and implementation.

## Research Inputs

- Chart.js line chart guidance:
  `https://www.chartjs.org/docs/latest/charts/line.html`
- Chart.js area/fill guidance:
  `https://www.chartjs.org/docs/latest/charts/area.html`
- react-native-gifted-charts Android-friendly chart patterns:
  `https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts`
- Mobile visualization research:
  `https://arxiv.org/abs/2311.03657`
- Dashboard design-pattern research:
  `https://arxiv.org/abs/2205.00757`
- WCAG 2.2 accessibility reference:
  `https://www.w3.org/WAI/WCAG22/quickref/?versions=2.2`
- Privacy by design:
  `https://en.wikipedia.org/wiki/Privacy_by_design`
- Local-first software:
  `https://en.wikipedia.org/wiki/Local-first_software`

These are inputs for CogVest decisions, not visual brands to copy.

## Product Thesis

CogVest V1 should be a premium private investment ledger:

- premium UI outside
- Excel-grade tracking logic inside
- local-first trust always visible
- long-term progress over trading urgency
- mobile-native summaries instead of spreadsheet density

The user should feel they are reviewing a disciplined monthly statement, not
watching a market terminal.

## Global UX Rules

- Answer first, evidence second, action last.
- Make each screen solve one user question before showing details.
- Keep analysis screens separate from data-capture screens.
- Use review-before-save for financial edits.
- Search and autocomplete must be explicit-selection-first; never auto-pick the
  first result.
- Charts are evidence, not decoration.
- Use line charts for trends over time; avoid bars for portfolio progression
  unless the task is categorical comparison.
- Use subtle area/glow fills only when they improve readability.
- Insight copy in V1 must be deterministic and derived from stored data, not
  AI-generated financial advice.
- Production screens must use local persisted records and domain functions; do
  not fake production data to make a screen look complete.
- Do not rely on color alone for financial state. Pair color with signs,
  labels, or text.
- Keep value masking available wherever INR wealth values appear.

## Dashboard Guidance

Dashboard should answer:

- What is my portfolio worth?
- Am I ahead or behind invested capital?
- How is value allocated?
- Is data fresh enough to trust?
- What should I review next?

Use a compact hierarchy:

- portfolio value and total return first
- invested value and P&L near the hero
- allocation as a visual summary, not a dense row grid
- quote status as trust context, not a warning wall
- one calm next action or insight, not a feed of widgets

## Holdings Guidance

Holdings should feel like durable position review, not a transaction list and
not a second Dashboard.

Do not lead with total holdings value by default. Dashboard owns portfolio-level
value. Holdings should lead with position-specific judgement:

- largest position
- holdings needing review
- top mover
- weakest holding where relevant
- exposure/concentration mix

Each holding row/card should prioritize:

- asset name and symbol
- current value
- invested value
- P&L and P&L %
- allocation
- quote/manual/stale state when useful

Avoid table-like columns. Use compact cards with clear left identity and right
value hierarchy. Filters should help scanning, not become a second dashboard.
Useful filters include needs-review, high-allocation, manual-price, gainers,
losers, and asset classes.

## Add Holding Guidance

Add Holding is an assisted migration flow from Excel into CogVest. It should
feel like recording a position correctly, not placing an order.

The primary path is:

1. Search by familiar name or symbol.
2. Show multiple result choices.
3. User taps `Select`.
4. App autofills known fields.
5. User reviews classification and position details.
6. App shows derived preview.
7. User saves.

Manual entry remains a fallback. The app should never silently choose a ticker,
instrument type, sector, or price source without giving the user a chance to
review it.

Use progressive disclosure. After selection, collapse search results into a
selected-asset summary, then show metadata review, position details, derived
preview, and review/save. Provider metadata should be labelled as a suggestion
or editable review item.

## Monthly Progress Guidance

Monthly Progress is a statement-summary screen.

It should answer:

- How did portfolio value move this month?
- Is value ahead of invested capital?
- Which asset classes drove the change?
- What changed compared with the previous month?
- Do I need to record or review a month-end snapshot?

Accepted V1 structure:

- top summary metrics
- `Value Gap` chart: portfolio value vs invested value
- `Asset Momentum` chart: Equity, Debt, and Crypto over months; Cash excluded
- `Monthly Change Breakdown`: selected month vs previous month
- compact month-end snapshot call-to-action

Do not embed a full snapshot form directly in the main Progress screen. The
main screen is for review and understanding; full snapshot capture belongs in a
dedicated flow or bottom sheet.

## Cash Ledger Guidance

Cash Ledger should have a clear identity: deployable capital and cash movement.

It should show:

- cash balance
- added cash
- invested/transferred cash
- available cash
- savings or investment rate where available
- recent cash movement

Cash should not feel like a placeholder. It should explain how money entered,
left, or became invested.

## Settings Guidance

Settings should build trust.

Prioritize:

- local storage status
- no account, no cloud, no analytics
- value masking
- quote provider/fallback state
- app/version/debug information only after user-facing trust settings

Unsupported or future features must be hidden, locked, or clearly marked as not
available. Do not show future settings as working controls.

## QA Checklist

- Does the screen answer its primary question within five seconds?
- Are values derived from persisted records or shown as honest empty states?
- Are financial values readable, maskable, and INR-first?
- Is the screen calmer than the Excel tracker while preserving the same core
  information?
- Does any search/autofill flow require explicit user selection?
- Are charts understandable without gestures?
- Is color paired with text/signs for positive and negative states?
- Are unsupported V2/V3 features hidden or clearly locked?
