# Issue #80 Dashboard Alignment Spec

## Goal

Align the V1 Dashboard with the approved premium Figma direction while preserving
Excel parity data and removing inactive-looking controls.

## Scope

- Wire the Dashboard value-mask action to the persisted `maskWealthValues`
  preference.
- Wire Dashboard quote refresh to the existing quote refresh service and persist
  refreshed quotes into the portfolio store.
- Keep Add Holding reachable from Dashboard in filled and empty states.
- Replace mislabeled lifetime values in the `This Month` card with current-month
  investment, current-month cash change, and a savings-rate value when enough
  cash data exists.
- Keep allocation readable and low-noise with equity/debt/crypto/cash rows using
  existing derived allocation data.
- Preserve existing rollup and conviction information where useful, but avoid
  making the Dashboard feel denser than the Figma direction.

## Non-Goals

- No new historical charting.
- No new Minimal Mode or LTCG UI.
- No fake demo portfolio values.
- No broad redesign outside `src/features/dashboard`.
- No changes to quote provider behavior beyond invoking the existing service.

## Data Rules

- Persist raw portfolio data only; derived values remain selectors/hook output.
- Monthly investment is the sum of current-month buy trades plus current-month
  opening-position invested value.
- Monthly cash change is current-month cash additions minus withdrawals.
- Savings rate is shown only when current-month cash additions are greater than
  zero; otherwise show `Not enough data`.
- Quote status distinguishes fresh quotes from manual fallback or no priced
  holdings without creating alarm.

## UX Rules

- Header controls must either perform an action or be removed.
- Value masking uses the eye icon and updates the store immediately.
- Refresh quotes uses the refresh icon and disabled/refreshing state should be
  clear through accessible labels and quote status text.
- Dashboard Add Holding remains a clear CTA.
- Copy stays local-first and calm.

## Acceptance Checklist

- Dashboard has no dead controls.
- Add Holding is reachable from Dashboard.
- Header value masking toggles persisted masking.
- Header refresh quotes persists refreshed quote cache.
- This Month uses monthly semantics or explicit not-enough-data text.
- Tests cover header actions and monthly labeling.
- `npm run typecheck`, `npm test`, and `npm run doctor` pass.
