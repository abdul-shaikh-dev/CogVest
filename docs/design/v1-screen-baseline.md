# V1 Screen Baseline

This is the accepted V1 screen contract for CogVest UI implementation work.
Use it with `DESIGN.md` and the current design assets:

- UX research baseline: `docs/design/v1-ux-research-baseline.md`
- Research preview: `docs/design/v1-research-preview/index.html`
- Dashboard issue #127 preview:
  `docs/design/screens/dashboard/issue-127/index.html`
- Figma generator: `docs/design/figma/issue-69-v1-screens/code.js`
- Figma file: `https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d`

The external mockup used during review is not a future dependency. The repo
assets above carry the accepted baseline forward.

When a single screen has a newer tracked preview under `docs/design/screens/`,
that screen-specific preview supersedes the matching section inside the older
all-screen research preview.

## Product Direction

CogVest V1 should feel like a premium private investment ledger:

- calm true-dark Android UI
- portfolio-first, not trading-first
- Excel-grade tracking concepts without spreadsheet density
- readable INR values with value masking support
- local-first trust visible in the UI
- green used only for active state, primary action, and positive financial state
- statement-summary screens that answer first, show evidence second, and place
  actions last

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
- compact visual allocation card with an `Open Holdings` action
- calm quote freshness card labelled `Quotes updated`
- compact next useful review action, such as `Open Progress` for month-end
  snapshot review when applicable

The dashboard must not become a trading terminal. Avoid ticker feeds, noisy
daily movers, dense mini-widgets, and fake market history.

Issue #127 refinement:

- The current accepted Dashboard design is
  `docs/design/screens/dashboard/issue-127/index.html`.
- Portfolio rollups belong near the top-level answer, not buried below every
  secondary card.
- Allocation must be visual and compact rather than row-heavy.
- Vague actions such as `Open` are not allowed. Dashboard actions must be wired
  to a real destination or removed.
- `Open Holdings` opens Holdings. `Open Progress` opens Progress.
- Use 20px cards, restrained green, Android/system typography, and calm quote
  copy.

## Holdings

Holdings replaces Excel rows with a durable position-review screen. It should
not repeat Dashboard's portfolio-value hero.

Holdings should answer:

- What do I own?
- Which positions dominate the portfolio?
- Which holdings need review?
- Which holdings moved most?
- Is the portfolio concentrated?

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
- keep each row/card visually durable; holdings should not look like a quick
  trade feed
- lead with position-review insights such as largest position, needs review,
  top mover, weakest holding, and exposure mix
- do not lead with total holdings value unless the issue explicitly asks for a
  portfolio-value variant
- keep row hierarchy compact: asset/current value/P&L first; invested value,
  allocation, and quote state second; quantity, average cost, current price,
  sector, and notes can live in detail/expanded states
- useful filters include `Needs review`, `High allocation`, `Manual price`,
  `Gainers`, `Losers`, and asset classes

## Add Holding

Add Holding is assisted capture, not a trading ticket. It is lookup-first and
explicit-selection-first.

Required flow:

1. Search for an asset by familiar name or symbol.
2. Show result choices.
3. Require the user to tap `Select` before fields are autofilled.
4. Confirm provider metadata.
5. Allow manual entry as fallback.
6. Capture classification.
7. Capture position details.
8. Show derived preview.
9. Review and save.

The UI must not auto-pick the first search result. Manual ticker/current-price
entry is a fallback, not the primary perceived path.
Autofilled ticker, instrument type, sector, currency, and price source must be
reviewable before save.

The visual pattern should use progressive disclosure. Do not show the full
search-result list, all metadata, all position fields, derived preview, and
final review as one long expanded form. After selection, collapse search into a
selected-asset summary and continue through metadata review, position details,
derived preview, and `Review and save`.

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

- first graph: `Value Gap` - total portfolio value vs invested value by month
- `Value Gap` color contract: Portfolio line is green; Invested line is white
- second graph: `Asset Momentum` - asset values vs months
- cash is excluded from the asset-trend graph and tracked separately in Cash
- charts must use stored monthly snapshots or a clear empty/no-snapshot state
- chart y-axis labels and chart-native value labels must obey value masking
- each chart card owns its own timeframe controls
- use `react-native-gifted-charts` for V1 chart rendering; do not use Victory
  Native for these charts
- x-axis labels should be sparse and chart-native, matching the research preview
  rhythm: first month, middle month, and latest month for longer ranges
- `Monthly Change Breakdown` compares the selected month with the previous month
- the main Progress screen includes only a compact month-end snapshot CTA; the
  full snapshot capture flow belongs outside the main review surface

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
- selected-month asset-class change and allocation context

## Cash Ledger

Cash is part of portfolio tracking but should stay visually separate from
asset-trend history.
Cash should feel like deployable capital and cash movement, not a placeholder.

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

- Local-first summary: local storage, account not required, cloud sync off,
  analytics off
- Value masking: real toggle/control plus mask preview
- Quotes: refresh status, quote source, manual fallback status
- Currency & App: INR base currency and Android preview/version context
- Data: destructive or future data actions separated from normal settings

Do not show unsupported settings as if they work. V2/V3 features may be marked
as locked or future only if they appear at all.
Future controls should be hidden when they add clutter without helping local-
first trust.

## Data Consistency Rules

- Dashboard totals, Holdings totals, allocation, and Progress snapshot values
  must be derived from the same domain functions.
- Mockup numbers are visual examples only; production screens must use stored
  local data or empty states.
- Persist raw user records. Derive portfolio values, P&L, allocation, and
  progression summaries.
- Monthly messages and change summaries must be deterministic templates derived
  from stored data, not AI-generated financial advice.
- P&L must not be communicated only by color; include signs, labels, or text.
- All INR wealth values must participate in value masking.

## Future Work Rule

Any UI PR that changes Dashboard, Holdings, Add Holding, Progress, Cash, or
Settings must compare against this baseline before merge. If the accepted
design changes, update this document, the HTML preview, and the Figma generator
in the same issue or explicitly log the drift.
