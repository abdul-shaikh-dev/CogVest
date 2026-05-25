# V1 Screen Baseline

This is the accepted V1 screen contract for CogVest UI implementation work.
Use it with `DESIGN.md` and the current design assets:

- HTML preview: `docs/design/issue-86-premium-preview/index.html`
- Figma generator: `docs/design/figma/issue-69-v1-screens/code.js`
- Figma file: `https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d`

The external mockup used during review is not a future dependency. The repo
assets above carry the accepted baseline forward.

## Product Direction

CogVest V1 should feel like a premium private investment ledger:

- calm true-dark Android UI
- portfolio-first, not trading-first
- Excel-grade tracking concepts without spreadsheet density
- readable INR values with value masking support
- local-first trust visible in the UI
- green used only for active state, primary action, and positive financial state

Do not add Minimal Mode, LTCG UI, historical-chart scope, import/export,
multi-portfolio behavior, auth, cloud sync, analytics, or trading-app visuals in
V1 design or implementation unless a later issue explicitly changes scope.

## Screen Set

V1 primary tabs:

- Dashboard
- Holdings
- Progress
- Cash
- Settings

Add Holding is a secondary flow launched from Dashboard/Holdings, not a main
bottom tab in the accepted V1 baseline.

## Dashboard

Dashboard answers the first five-second questions:

- What is my portfolio worth?
- How much did I invest?
- What is my P&L?
- How is the portfolio allocated?
- Is quote data fresh?

Baseline structure:

- local portfolio header with mask and refresh actions
- large `Portfolio Value` hero
- total gain/loss context, invested value, P&L, and return
- compact allocation card
- monthly contribution/cash context
- calm conviction/insight placeholder only when useful

The dashboard must not become a trading terminal. Avoid ticker feeds, noisy
daily movers, dense mini-widgets, and fake market history.

## Holdings

Holdings replaces Excel rows with durable mobile position cards.

Each holding card should expose:

- asset name and symbol
- asset class and useful metadata
- current value
- invested value
- quantity
- average cost
- current price or last traded price
- P&L and P&L %
- allocation percentage
- live/manual/stale quote state where relevant

Rules:

- use filter chips with counts where useful
- keep the Add Holding entry point in the Holdings header
- keep Search and value masking available
- do not use spreadsheet-style columns or editable grids
- keep allocation visible for each holding and consistent with Dashboard totals

## Add Holding

Add Holding is lookup-first and explicit-selection-first.

Required flow:

1. Search for an asset by familiar name or symbol.
2. Show result choices.
3. Require the user to tap `Select` before fields are autofilled.
4. Allow manual entry as fallback.
5. Capture classification.
6. Capture position details.
7. Show derived preview.
8. Review and save.

The UI must not auto-pick the first search result. Manual ticker/current-price
entry is a fallback, not the primary perceived path.

Required concepts:

- asset name
- ticker/symbol
- currency
- asset class
- instrument type
- sector/type metadata
- quantity
- average cost
- current price
- live/manual price source
- acquisition date
- optional conviction
- optional note

## Progress

The V1 screen title is `Monthly Progress`; the tab label can be `Progress`.

Accepted chart direction:

- first graph: total portfolio value vs invested value by month
- second graph: asset values vs months
- cash is excluded from the asset-trend graph and tracked separately in Cash
- charts must use stored monthly snapshots or a clear empty/no-snapshot state

Do not fake production chart history. If snapshots are missing, show a premium
empty state and a clear path to record a snapshot.

Monthly Progress must preserve Excel parity concepts:

- portfolio value
- monthly gain/change
- equity value
- debt value
- crypto value
- invested value
- monthly investment
- salary if tracked
- cash context
- savings rate
- expense rate if tracked
- asset class snapshot

## Cash Ledger

Cash is part of portfolio tracking but should stay visually separate from
asset-trend history.

Baseline structure:

- title `Cash Ledger`
- subtitle `Manual ledger - local only`
- cash balance hero
- invested, available, and savings context
- entry form for deposit, withdrawal, and investment transfer
- recent ledger rows or a useful empty state

Investment transfers should reduce available cash where applicable. Empty cash
state should be acceptable and should not imply missing setup.

## Settings

Settings should build trust.

Baseline groups:

- Privacy: local storage, no account, no cloud, no analytics
- Display: value masking status and mask preview
- Quotes: refresh status, provider status, manual fallback status
- Currency: INR base and foreign/crypto fallback settings
- Data: destructive or future data actions separated from normal settings

Do not show unsupported settings as if they work. V2/V3 features may be marked
as locked or future only if they appear at all.

## Data Consistency Rules

- Dashboard totals, Holdings totals, allocation, and Progress snapshot values
  must be derived from the same domain functions.
- Mockup numbers are visual examples only; production screens must use stored
  local data or empty states.
- Persist raw user records. Derive portfolio values, P&L, allocation, and
  progression summaries.
- P&L must not be communicated only by color; include signs, labels, or text.
- All INR wealth values must participate in value masking.

## Future Work Rule

Any UI PR that changes Dashboard, Holdings, Add Holding, Progress, Cash, or
Settings must compare against this baseline before merge. If the accepted
design changes, update this document, the HTML preview, and the Figma generator
in the same issue or explicitly log the drift.
