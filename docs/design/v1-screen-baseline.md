# V1 Screen Baseline

This is the accepted V1 screen contract for CogVest UI implementation work.
It remains the baseline, not a description of every shipped V2 capability:
approved V2 issues and `docs/roadmap/v2-behaviour-spec.md` supersede its V1-only
exclusions where applicable (including the implemented Minimal Mode).
Use it with `DESIGN.md` and these supporting sources:

- UX research baseline: `docs/design/v1-ux-research-baseline.md`
- Current emulator evidence: `docs/testing/artifacts/visual-qa/latest/`

The external mockup used during review is not a future dependency. This file
and `DESIGN.md` define the contract; emulator screenshots are verification
evidence, not design instructions.

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

Do not add Minimal Mode, LTCG UI, advanced market-price history, arbitrary
spreadsheet import, full-record export/restore,
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

Holdings may also launch the constrained V1 CSV onboarding flow. Its screen must
use the same calm hierarchy as Quick Setup: select one file, resolve rows in
place, show currencies and valuation completeness, then expose one atomic import
action. It must never resemble an editable spreadsheet grid.

## Dashboard

Dashboard answers the first five-second questions:

- What is my portfolio worth?
- How much did I invest?
- What is my P&L?
- How is the portfolio allocated?
- Is quote data fresh?

Baseline structure:

- local portfolio header naming current valuation, with mask and refresh actions
- large `Portfolio Value` hero
- total gain/loss context, invested value, P&L, and return
- compact visual allocation card with an `Open Holdings` action
- compact price freshness beside the hero, not a separate status card; an
  accessible `Price details` disclosure contains coverage counts and saved-quote
  movement. Stale/manual/missing prices and failed refreshes remain apparent
  while collapsed. Holdings P&L, not daily movement, is the primary return.
- compact next useful review action, such as `Open Progress` for month-end
  snapshot review when applicable

Dashboard uses current records and available prices, including recorded cash and
PPF balances; it must not label these values as the latest snapshot. Progress
uses stored month-end values and may legitimately differ. Do not imply every
price is live or attach a fresh timestamp merely because the screen was opened.
Missing valuations remain pending and actionable even while masked. Cash-only
and PPF-only portfolios must not show a fake market movement or a missing-price
warning merely because no market holdings require quotes.

The dashboard must not become a trading terminal. Avoid ticker feeds, noisy
daily movers, dense mini-widgets, and fake market history.

Dashboard refinement:

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

The approved #278 list-first preview lives in
`docs/design/previews/holdings-list-first/`. Search and existing filters precede
market holdings. A quiet Portfolio insights action opens secondary analysis;
management, transactions, masking and valuation detail live under More. Keep
Add in the header with single entry, Quick Setup, imports and Add PPF.

PPF accounts use a counted destination alongside Market when both exist;
PPF-only portfolios open their accounts. Do not put an absent-account promotion
above the market list. Existing/legacy PPF access must survive the hierarchy
change. Each account row leads with nickname/provider and confirmed balance, then
shows balance date, invested basis, and lifecycle context. The account detail
uses progressive disclosure for financial-year contribution capacity, official
interest, a separately labelled estimate, maturity/extension state, and ledger
history. Add/edit and ledger actions require a review step before saving.

Legacy PPF-like records remain stored non-destructively. Before linking, show a
clear action to set up the dedicated account. After linking, exclude the legacy
record from visible holdings and totals so the confirmed account replaces it
without double counting. Do not show synthetic ticker, units, average cost,
live quote, market P&L, or loan controls for PPF.

Holdings should answer:

- What do I own?
- Which positions dominate the portfolio?
- Which holdings need review?
- Which holdings moved most?
- Is the portfolio concentrated?

Each holding card should expose:

- asset name and symbol
- asset class and useful metadata
- current value, or an explicit valuation-pending state
- invested value
- quantity
- average cost
- current price or last traded price when available
- P&L and P&L %
- allocation percentage
- live/manual/stale quote state where relevant

When current valuation is pending, keep invested value visible but show current
value, P&L, P&L %, and allocation as unavailable rather than zero. Portfolio
totals must clearly remain incomplete until all material holdings are valued.

Rules:

- use filter chips with counts where useful
- keep the Add Holding entry point in the Holdings header
- keep Search and value masking available
- do not use spreadsheet-style columns or editable grids
- keep allocation visible for each holding and consistent with Dashboard totals
- keep each row/card visually durable; holdings should not look like a quick
  trade feed
- put the list first; retain dominant position, distinct best return, top-three
  concentration and asset mix in on-demand insights rather than a pre-list grid
- do not lead with total holdings value unless the issue explicitly asks for a
  portfolio-value variant
- keep row hierarchy compact: asset/current value/P&L first; invested value,
  allocation, and quote state second; quantity, average cost, current price,
  sector, and notes can live in detail/expanded states
- preserve the implemented `All`, `Winners`, `Losers`, and `High allocation`
  filter semantics and ordering; new filters require a separate contract
- normal freshness is compact, but pending valuations and failed refreshes must
  remain honest and actionable. Preserve incomplete-total semantics and explicit
  manual provenance; do not make missing prices look successful
- empty portfolios prioritize setup; interrupted setup has a compact Resume
  action. No-search-results is distinct from no holdings

## Add Holding

Entry selectors distinguish `Stocks` and `ETFs` with the same unique accessible
names (#280). Keep `Equity` as their grouped portfolio-summary label; do not use
that shared label for two mutually exclusive entry choices. Existing instrument
options and internal `stock` / `etf` records are unchanged.

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

Single-holding Back navigation follows Review -> Position -> Confirm details ->
Asset, consistently for the toolbar, footer, and Android system Back. Preserve
input between phases. Leaving Asset with unfinished input requires explicit
discard confirmation; Keep editing or dismissing the confirmation retains input.
Pristine entry and completed saves exit without an unsaved-draft prompt. Ignore
Back while saving and unregister the hardware handler when the route is inactive.
Rapid portfolio setup retains its separate guarded-exit behavior.

The UI must not auto-pick the first search result. Manual ticker/current-price
entry is a fallback, not the primary perceived path.
Autofilled ticker, instrument type, sector, currency, and price source must be
reviewable before save.

The visual pattern should use progressive disclosure. Do not show the full
search-result list, all metadata, all position fields, derived preview, and
final review as one long expanded form. After selection, collapse search into a
selected-asset summary and continue through metadata review, position details,
derived preview, and `Review and save`.

The #282 entry/review hierarchy keeps quantity, cost and optional valuation
primary. Date entry stays available; notes, conviction and planned holding days
are collapsed under `Add notes or a holding plan`. Disclosures retain input,
and invalid optional values must reveal their errors rather than silently block.
Review leads with the asset, honest price-source status, invested/current/P&L
values, quantity/cost/price and explicit no-cash-movement meaning. Save precedes
`Holding details & edits`, which retains asset/classification editing and
populated optional details. Do not show duplicate identifiers or empty planning
rows. Changing phases dismisses the keyboard and starts at the top; keep
continuation reachable with the Android keyboard docked. Quick Setup retains
its existing save-next/save-finish semantics and omits planning fields.
The form owns keyboard avoidance; do not apply a global screen change merely
for this flow. Date uses the full available width, and phase labels grow/wrap
at enlarged text instead of overflowing a fixed-height step row.

Required concepts:

- asset name
- ticker/symbol
- currency
- asset class
- instrument type
- sector/type metadata
- quantity
- average cost
- current price when fetched, or an optional manual fallback
- live/manual price source
- acquisition date
- optional conviction
- optional note

Current price is not required to preserve ownership. If lookup and manual
fallback are both unavailable, save the holding with valuation pending and give
the user clear refresh and manual-price recovery actions later.

### Quick Portfolio Setup

Use Quick Portfolio Setup when the user is entering several existing holdings.
It is a focused full-screen flow, not a modal and not a spreadsheet grid.

- Empty Dashboard leads with `Set up your portfolio` and keeps `Add one holding`
  as a secondary action.
- The Holdings `+` action offers `Add one holding` and `Add multiple holdings`.
- An active session uses `Continue portfolio setup` and states how many
  confirmed holdings are already saved.
- Reuse explicit search-result selection, provider quote/metadata provenance,
  manual fallback, optional current price, and optional/unknown first purchase
  date from Add Holding.
- Keep the setup path to Asset, Position, and Review. Do not show conviction,
  notes, or detailed metadata controls unless correction is required elsewhere.
- `Save & add next` and `Save & finish` persist the confirmed financial record
  before moving on. Never keep confirmed holdings only in draft state.
- Exiting preserves confirmed records and clearly warns that the unfinished
  on-screen entry will be discarded.
- Final review leads with aggregate portfolio values, calls out pending current
  prices, lists records confirmed in this setup, and ends at Dashboard.

## Progress

The V1 screen title is `Monthly Progress`; the tab label can be `Progress`.

Accepted chart direction:

- first graph: `Portfolio Growth` - total portfolio value vs invested value by
  month, with the subtitle `Portfolio value compared with invested capital`
- `Portfolio Growth` color contract: Portfolio line is green; Invested line is
  white and dashed
- second graph: `Asset Momentum` - asset values vs months
- cash is excluded from the asset-trend graph and tracked separately in Cash
- charts must use stored monthly snapshots or a clear empty/no-snapshot state
- chart y-axis labels and chart-native value labels must obey value masking
- Y-axis labels and horizontal guides share the chart-native zero/half/maximum
  scale (two sections). Do not add a separately positioned label column.
- plot spacing and guide lengths fit the measured container; reserve a
  font-scaled axis gutter so narrow screens and enlarged text retain readable ticks
- each chart card owns independent `3M`, `6M`, `1Y`, `All`, and `Custom`
  timeframe controls
- custom ranges use inclusive start and end months chosen from available stored
  snapshot months; do not present unavailable or hard-coded months
- selecting a month updates a compact summary above the plot. Portfolio Growth
  shows portfolio value, invested value, and the percentage and amount ahead or
  behind invested capital. Asset Momentum shows Equity, Debt, and Crypto values
  with percentage movement from the previous visible month.
- plots are non-interactive: vertical swipes scroll the page without changing
  the inspected month. Each chart has accessible Previous/Next stored-month
  controls with disabled boundaries and a politely announced selected summary
- grouped chart summaries include the visible signed percentages, not only
  amounts. Explain first-visible-month and zero-baseline unavailable changes;
  when masked, announce only the month and that values are hidden. Decorative
  plot descendants must not become separate screen-reader stops. Runtime
  verification and remaining TalkBack checks are recorded in
  `docs/testing/chart-talkback-evidence.md` (#292).
- chart selection is independent; changing its range resets to the latest
  visible stored month. Series-colored enlarged points mark that selection
- latest-in-range asset insights retain explicit month and comparison dates,
  distinct from the inspected month; hide them when values are masked
- CogVest owns month selection, figures, legend, masking, and accessibility text
- use `react-native-gifted-charts` for V1 chart rendering; do not use Victory
  Native for these charts
- x-axis labels should be sparse and chart-native: show the first month, a
  useful midpoint, and the latest month for longer ranges
- Long histories must retain every point inside the measured plot. Native label
  components must not inherit a single point's tiny spacing as their text width;
  first/last labels align inward and multi-year ranges include the year. Renderer
  geometry refreshes after layout changes without resetting month selection.
  At enlarged font sizes, portfolio-summary groups stack instead of overlapping.
- Monthly History details compare the selected month with the previous calendar month
- the main Progress screen includes only a compact month-end snapshot CTA; the
  full snapshot capture flow belongs outside the main review surface
- the approved #275/#277 reading order is a dated monthly answer (portfolio,
  market change, monthly investment), compact snapshot status, independent
  charts, then `Monthly History` with a `View history` action
- Monthly History opens in a panel, newest stored year and months first. Rows
  show portfolio value and change versus the immediately previous calendar
  month, including cross-year January comparisons; gaps/zero baselines must
  not produce fabricated percentages. Value change includes contributions and
  is not labelled investment return
- tapping a month opens its dedicated detail view at the top of the same panel,
  not an accordion or stacked modal. Back restores the history year and scroll
  position; Android Back goes detail -> history -> Progress
- details retain portfolio/invested values, current/previous class values,
  allocation, cash, contribution-adjusted performance and available income/rates;
  masking and Minimal Mode apply throughout
- remove duplicate latest-asset badges and the secondary asset breakdown from
  the main chart surface. Charts retain oldest-to-newest plots and independent
  ranges/selected-month controls
- automatic status explanations, warnings and optional correction stay reachable
  on demand; do not turn automatic snapshots into a required monthly form

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
- Deposit and Withdraw actions immediately below the balance; each opens a
  focused full-screen entry panel rather than an inline form below summaries
- invested cash is derived only from trustworthy linked investment accounting;
  do not expose a generic manual `Investment transfer` action
- recent ledger rows or a useful empty state

Linked investment funding should reduce available cash exactly once. Empty cash
state should be acceptable and should not imply missing setup.

The #284 entry panel groups amount, full-width calendar date, label and optional
notes with the correctly named Save action. Deposit also has Contribution/Income
purpose; withdrawal never pretends to be an investment purchase. Cancel and
Android Back return to the ledger without saving and keep the same-type draft
in memory. Switching entry type requires explicit discard when a draft exists.
Do not promise durable draft recovery. Save failure retains the form and values;
successful save closes it and updates the ledger once. Keep actions reachable
with a docked keyboard and enlarged text. Unavailable income/rate use compact
markers and one accurate dependency explanation, not repeated missing-data cards.

## Settings

Settings should build trust.

Baseline groups:

- Retain the local-first subtitle, without a duplicate Local only header badge.
- Working preferences first: value masking with honest amount-only scope and
  Standard/Minimal display choices. Checked states must be accessible.
- Compact Privacy & storage disclosure: no account/cloud sync/analytics summary;
  app-private storage, separate-encryption limitation and disabled Android backup/
  transfer remain available in details, not implied to be encryption or recovery.
- Price information disclosure: separate price-update dates, sources and manual
  update counts. Explain that prices entered with initial holdings may also be in
  use and are not counted here; Dashboard remains the valuation-coverage surface.
  A provider-sourced saved price is not proof of current live availability; its
  date is not a last-refresh timestamp. Use plain language, not cache/API jargon.
- About: non-interactive INR reporting currency and actual configured app version
  (or explicit unavailable state), not a hard-coded Preview label.
- Hide unimplemented Clear local data rather than giving it a section or control.
  Do not introduce clearing/export/backup or change data storage in a hierarchy fix.

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
design changes, update this document and any maintained HTML preview affected
by that change.
