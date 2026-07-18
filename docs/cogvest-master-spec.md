# CogVest Product Spec

CogVest is an Android-first, local-first portfolio tracker for replacing the
user's Excel investment tracker with a calmer mobile workflow.

The product principle is:

> Premium UI outside. Excel-grade tracking logic inside.

CogVest should store user-entered records and derive portfolio views from pure
domain functions. It must not recreate Excel as a spreadsheet UI.

## Current Source Of Truth

For implementation, use `AGENTS.md`, this product spec, and the active GitHub
issue. Add `DESIGN.md` and `docs/design/v1-screen-baseline.md` for UI work, the
testing matrix for verification work, and roadmap/release documents only when
those boundaries are affected. Historical previews and completed plans are
supporting evidence, not sources of truth.

## V1 Product Goal

V1 should let the user continue daily investment tracking without opening the
Excel tracker.

V1 answers:

- What do I own?
- How much did I invest?
- What is it worth now?
- What is my P&L and P&L %?
- How is my portfolio allocated?
- How much is in equity, debt, crypto, and cash?
- What changed this month?
- How much did I invest this month?
- What is my savings/investment rate?
- Can I track cash and holdings locally on Android?

## V1 Scope

V1 includes:

- local-first Android app with Expo Router
- MMKV-backed Zustand store
- Add Holding assisted capture
- explicit asset lookup selection before autofill
- manual asset/price fallback
- live current quote fetching
- opening positions and holding records
- derived Holdings, Dashboard, Cash Ledger, and Monthly Progress views
- cash ledger entries for typed additions and withdrawals; investment funding
  and sale proceeds must use explicit linked accounting rather than a confusing
  manual transfer mode
- monthly snapshots
- value masking
- optional conviction capture and not-enough-data state
- PC-only Android emulator verification
- local APK build/install verification

V1 does not include:

- Minimal Mode
- LTCG/tax UI
- advanced historical market charts
- Excel import/export
- backend, auth, cloud sync, analytics, or push notifications
- Play Store auto-submit

## Data Model Principle

Persist raw records:

- holdings/opening positions
- transactions where needed by existing domain APIs
- cash entries
- monthly snapshots
- quote/manual price records
- preferences

Derive:

- invested value
- current value
- P&L
- P&L %
- allocation
- total investment
- total current value
- monthly progression summaries
- dashboard rollups

All domain calculations must be pure functions under `src/domain/`.

### V1 Cash Accounting Contract

- Opening positions represent an external baseline and do not create cash
  movements.
- A new buy must be funded from deployable tracked cash. Saving the buy and its
  linked cash withdrawal is one atomic store transition, and a buy above the
  available balance is rejected before mutation.
- A sale must add its net proceeds to deployable cash in the same atomic store
  transition. Money leaving the tracked portfolio is recorded separately as a
  withdrawal.
- Cash additions are typed as income, capital contribution, or legacy
  uncategorized data. Purchase funding, sale proceeds, and withdrawals are
  distinct linked movement purposes.
- Monthly investment rate uses typed income only. Capital contributions, sale
  proceeds, and migrated legacy additions must not be treated as income.
- Persisted pre-contract additions migrate to legacy uncategorized entries so
  historical cash remains visible without inventing income semantics.

### V1 Currency And Quote Contract

- INR is the only reporting, transaction-entry, cash, quote, and snapshot
  currency supported in V1.
- Yahoo-assisted capture accepts supported NSE and BSE securities only. Foreign
  securities must be rejected before persistence instead of being aggregated
  as INR.
- CoinGecko current and historical crypto prices are requested in INR. The
  value is CoinGecko's globally aggregated market estimate expressed in INR,
  not a direct INR trading pair or an exchange-specific execution price.
- Selected lookup identity, ticker, exchange, currency, quote source ID, and
  provider quote provenance must survive review and save.
- Asset and quote currency compatibility must be proven before a record enters
  INR totals, allocation, P&L, or monthly snapshots.
- Unsupported persisted records remain local and visible as excluded data; they
  must never be silently converted, deleted, or included in INR calculations.
- General foreign-asset portfolios, FX conversion, and user-selectable reporting
  currency remain outside V1.

## Screen Contract

Primary tabs:

- Dashboard
- Holdings
- Progress
- Cash
- Settings

Add Holding is a secondary flow launched from Dashboard/Holdings actions.

Dashboard owns portfolio-level answers.

Holdings owns position review: dominant positions, review-needed holdings,
top/weak movers, allocation/concentration, quote state, and compact holding
rows.

Add Holding owns assisted capture: search, explicit result selection, provider
metadata review, position details, derived preview, and manual fallback.

Monthly Progress owns statement-style progress: `Value Gap`, `Asset Momentum`,
`Monthly Change Breakdown`, month selection, and a compact snapshot CTA.

Cash Ledger owns deployable capital and cash movement.

Settings owns local-first trust, value masking, quote status, app metadata, and
clearly separated destructive/deferred actions.

## Design Direction

CogVest should feel:

- calm
- premium
- disciplined
- local-first
- low-noise
- Android-native
- long-term investing focused

Use true-dark surfaces, spacious cards, clear numeric hierarchy, restrained
green accents, and mobile-first grouped layouts. Do not create trading-app,
crypto-exchange, spreadsheet, or generic Material-template energy.

## Chart Direction

V1 Monthly Progress uses stored monthly snapshots only.

The accepted charts are:

- `Value Gap`: portfolio value against invested capital
- `Asset Momentum`: equity, debt, and crypto trends over months; cash excluded

Use `react-native-gifted-charts` for the current V1 implementation.

## Verification

V1 dev-complete requires:

- `npm run test:v1:pc`
- Android Emulator launch
- local APK build/install on emulator
- core manual flows passing or defects logged
- seeded visual QA when validating screen parity

V1 release-candidate additionally requires:

- production AAB build success
- EAS build URL recorded
- Play Console internal testing upload ready/manual

