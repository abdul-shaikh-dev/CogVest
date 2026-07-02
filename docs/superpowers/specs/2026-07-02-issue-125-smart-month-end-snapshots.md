# Issue #125 Smart Month-End Snapshots Design

## Goal

CogVest should automatically create missing completed-month snapshots so the user
does not need to remember an Excel-style month-end ritual. The Progress screen
should remain a calm review surface, not a dense manual snapshot form.

## Product Decision

Snapshots are automatic by default. Review and edit are correction paths after a
snapshot is generated, not required steps before historical data exists.

CogVest should generate the previous completed month. It should not lock the
current in-progress month as a historical snapshot.

Example:

- On 1 August 2026 or later, if July 2026 is missing, CogVest generates
  `2026-07`.
- If `2026-07` already exists, repeated generation does nothing.
- If there is no portfolio or cash data, CogVest does not create an empty junk
  snapshot.

## V1 Historical Price Rule

V1 should attempt month-end historical prices now, because otherwise automatic
snapshots still depend too much on the user opening the app around month end.

The V1 rule is intentionally pragmatic:

- Use the latest available provider close on or before the target month end.
- Use Yahoo chart historical close for stocks and ETFs.
- Use CoinGecko historical/range pricing for crypto.
- Use manual/latest fallback for debt, unsupported assets, or provider failure.
- Cash uses the cash ledger balance, not price lookup.

Precise market calendars, richer non-equity provider coverage, and snapshot
recompute tooling remain future hardening in issue #150.

## Snapshot Generation

The generator should derive:

- month
- portfolio value
- invested value
- equity value
- debt value
- crypto value
- cash value
- monthly investment
- salary when already known or provided by the user
- monthly expense when already known or provided by the user
- notes when provided by the user

Portfolio value should be holdings value plus cash balance. Holdings value should
use generated month-end prices where available and fallback prices where
necessary. Invested value should use existing holding cost-basis calculations.

Monthly investment should be derived from current-month buy trades and opening
positions for the snapshot month. Sell/redeem proceeds should affect holdings
and cash through the existing trade/cash ledger data.

## Price Basis Transparency

Generated snapshots must not pretend all values are exact if fallbacks were used.
The implementation should track enough metadata to explain the price basis at a
user-trust level:

- historical close
- cached historical close
- latest local quote fallback
- manual fallback
- unavailable

If the existing `MonthlySnapshot` type cannot hold detailed basis metadata
cleanly, introduce a small backwards-compatible metadata field rather than
overloading notes.

## Progress Screen UX

Replace the full manual snapshot form on the main Progress screen with a compact
snapshot status card.

States:

- No portfolio/cash data: show a calm empty state and do not generate a
  snapshot.
- Missing completed-month snapshot: generate automatically and show a status
  such as `July snapshot generated automatically`.
- Generated with fallbacks: show a calm warning such as `Some prices used
  latest local/manual fallback`.
- Existing snapshot: show latest snapshot status and an edit/review action.

The user can review or edit generated values, but they should not need to press
Save for normal month-end capture.

## Data Flow

Safe touchpoints can call the same idempotent generator:

- Progress screen open
- app open/store hydration if practical
- after successful quote refresh

For V1, Progress screen open is the minimum required trigger. Additional
touchpoints can be added if they do not create duplicate side effects.

The generator must:

1. Determine the previous completed month from `now`.
2. Check if a snapshot for that month already exists.
3. Check whether there is enough portfolio or cash data to create a meaningful
   snapshot.
4. Resolve month-end prices for holdings.
5. Derive the snapshot payload.
6. Save once by adding or updating the snapshot.
7. Return a status object for UI messaging.

## Error Handling

Provider failures must not crash Progress. They should degrade to cached,
latest-local, or manual prices and expose a calm fallback status.

If no fallback price exists for a holding, the generator should still create a
snapshot from the data it can trust only if the resulting snapshot is meaningful.
The UI should explain missing price coverage.

## Testing

Tests must cover:

- previous completed month selection
- no duplicate snapshots when the generator is called repeatedly
- no snapshot when there is no meaningful data
- historical stock/ETF price success
- historical crypto price success
- provider failure fallback to latest/manual prices
- generated snapshot values for portfolio, invested, asset-class split, cash,
  and monthly investment
- Progress screen status for auto-generated and fallback states

## Out of Scope

- Perfect exchange calendars
- advanced provider coverage for every Indian asset type
- background jobs or Android scheduled workers
- cloud sync, backend jobs, auth, or analytics
- complex snapshot recomputation UI
- exact tax/LTCG behavior

## Acceptance Criteria

- Missing previous completed month snapshots are generated automatically.
- Generation is idempotent.
- Basic historical month-end prices are attempted for stocks, ETFs, and crypto.
- Transparent fallbacks are used when historical prices are unavailable.
- Progress no longer shows a giant manual snapshot form by default.
- User can review/edit generated snapshot values after creation.
- Charts and Monthly Change Breakdown update from generated snapshots.
- `npm run test:v1:pc` passes or defects are logged.
