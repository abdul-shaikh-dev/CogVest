# Issue #127 Dashboard Hierarchy Design

## Status

Accepted design direction: refined Option A from the live design session.

Tracked preview:

- `docs/design/screens/dashboard/issue-127/index.html`

This screen-specific preview supersedes the Dashboard section in
`docs/design/v1-research-preview/index.html` for issue #127 implementation.

## Problem

Dashboard currently does not fully match the V1 research direction. Portfolio
rollups can be buried, allocation is too row-heavy, and actions such as
`View details` risk being dead or vague. Dashboard should answer portfolio
health in under five seconds without becoming Holdings, Progress, or a trading
terminal.

## Product Goal

Dashboard should answer:

- What is my portfolio worth?
- How much have I invested?
- What is my P&L and P&L percentage?
- How is the portfolio allocated?
- Is quote data fresh enough to trust?
- What is the next useful review action?

## Accepted Layout

Use the refined Option A hierarchy:

1. Header
   - Title: `Dashboard`
   - Subtitle: local portfolio and latest snapshot date/context.
   - Actions: value masking and refresh quotes.

2. Portfolio hero
   - Label: `Portfolio value`
   - Primary value: total current portfolio value.
   - Context pill: positive/negative percentage versus invested capital.
   - Top metrics: invested value, P&L, and this-month movement.

3. Allocation
   - Section title: `Allocation`
   - Action: `Open Holdings`
   - Visual allocation summary with equity, debt, crypto, and cash.
   - Use a compact donut or equivalent visual representation.

4. Quote freshness
   - Heading: `Quotes updated`
   - Body: latest update age/date plus manual fallback state.
   - Status pill where useful, such as `Live`.

5. Next useful review
   - Example: `Record May snapshot`.
   - Action: `Open Progress`.
   - Show only when there is a meaningful next review action or a useful empty
     state.

## Action Rules

- `Open Holdings` must navigate to the Holdings tab/screen.
- `Open Progress` must navigate to the Progress tab/screen.
- No vague `Open` actions are allowed.
- No `View details` action may remain unless it is wired to a real screen or
  section.
- Refresh quotes must retain loading/failure feedback.
- Value masking must continue to hide INR wealth values.

## Visual Rules

- Use true dark background and existing app tokens.
- Cards should use the app card radius, currently 20px.
- Green is restrained: active/action states and positive financial values only.
- Use Android/system typography. Do not introduce a novelty font.
- Hero/title tracking should stay readable; do not over-tighten display values.
- Allocation should be visual and compact, not a table or dense row stack.

## Data Rules

- Production values must come from existing stored data and domain selectors.
- Do not hardcode preview numbers in app code.
- Portfolio value, invested value, P&L, P&L %, and allocation must remain
  derived from existing domain calculations.
- Empty/sparse states must remain useful and premium.
- P&L cannot rely on color alone; include signs, labels, or text.

## Out of Scope

- No new historical charts.
- No V2 Minimal Mode.
- No LTCG UI.
- No import/export.
- No backend, auth, cloud sync, analytics, or push notifications.
- No redesign of Holdings, Progress, Cash, Settings, or Add Holding beyond
  navigation targets required by Dashboard actions.

## Acceptance Criteria

- Dashboard portfolio value, invested value, P&L, P&L %, allocation, and quote
  freshness are visible or reachable from the top-level Dashboard.
- Portfolio rollups appear near the top-level portfolio answer.
- Allocation is visual and compact.
- `Open Holdings` and `Open Progress` are wired or absent when unavailable.
- No dead Dashboard actions remain.
- Empty/sparse Dashboard state still gives a clear Add Holding path.
- Value masking still works for INR wealth values.
- Dashboard follows `docs/design/screens/dashboard/issue-127/index.html`.
- `npm run test:v1:pc` passes or failures are logged with defects.
- Android emulator visual evidence is captured when available.

## Spec Self-Review

- Placeholder scan: no placeholders remain.
- Scope check: this spec is limited to Dashboard hierarchy and action wiring.
- Ambiguity check: screen-specific preview is now the canonical #127 reference.
