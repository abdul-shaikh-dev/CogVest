# CogVest V1 MVP Spec

## Goal

Ship a usable Android portfolio tracker that replaces a spreadsheet for local day-to-day tracking.

## Target User Value

The user can add holdings quickly, see current holdings and portfolio value in INR, track cash, mask sensitive values, and begin collecting conviction context without needing login, backend, or cloud sync.

## Included Features

- App scaffold with Expo Router tabs.
- Theme, typography, spacing, and reusable common components.
- Domain types for assets, trades, cash, quotes, holdings, preferences.
- Pure domain calculations for holdings, allocation, portfolio total, day change, formatters, and basic conviction readiness.
- Zustand store with MMKV persistence for raw local data.
- Quote services for Yahoo Finance and CoinGecko current prices.
- Quote refresh on app open and pull-to-refresh.
- Manual current-price fallback if quote fetching fails.
- Add Holding screen for opening positions and trade-backed local entries, with optional conviction.
- Lightweight asset lookup/autofill for common supported assets, with manual fallback.
- Holdings screen derived from trades and current quotes.
- Dashboard with total value, allocation, quote freshness, and basic conviction nudge.
- Cash screen for additions and withdrawals.
- Simple settings with value masking.
- Empty states with direct CTAs.
- Android PC verification harness, local APK smoke path, and V1 release checklist.

## Explicitly Excluded Features

- Minimal Mode.
- LTCG UI or tax badges.
- Historical charts.
- Advanced asset search.
- Patience analysis.
- Trade frequency analysis.
- Full behaviour engine.
- Import/export.
- Backend, auth, cloud sync, analytics, push notifications.
- Automatic Google Play submission.

## Screens Included

- Dashboard.
- Holdings.
- Add Holding.
- Cash.
- Monthly Progress.
- Settings.

## Data Model Changes

Persist raw data only:
- assets
- trades
- cashEntries
- preferences
- last successful quote cache

Do not persist holdings, allocation, dashboard totals, or insights.

## Domain Calculations Required

- `calculateHolding`
- `calculateAllocation`
- `portfolioTotal`
- `portfolioDayChange`
- `formatINR`
- `daysHeld`
- `validateTradeInput`
- `getConvictionReadiness`

## Acceptance Criteria

- A buy trade creates or updates a holding.
- A sell trade cannot exceed available units.
- Current prices refresh from live quote services when possible.
- Manual price fallback keeps the app usable when quote APIs fail.
- Dashboard total equals holdings current value plus cash balance.
- Cash additions and withdrawals update dashboard total.
- Value masking hides INR wealth values but not quantities or percentages.
- Conviction is optional and stored only when selected.
- Basic conviction state shows rated-trade count or not-enough-data guidance.
- Data persists after app restart.
- No backend/auth/cloud is added.

## Test Plan

- Unit tests for domain calculations, formatters, validators, selectors, and store actions.
- Component tests for empty states, value masking, conviction selector, and Add Holding validation.
- PC-based Android Emulator checks for navigation, trade entry, holdings, dashboard, cash, masking, and persistence.

## PC Verification Checklist

- Add a buy trade for BTC.
- Add a buy trade for RELIANCE.
- Add a sell within available quantity.
- Attempt a sell above available quantity and confirm validation blocks it.
- Add cash and withdraw cash.
- Pull-to-refresh quotes.
- Toggle value masking.
- Restart app and confirm persisted raw data reloads.
- Confirm no login, cloud, or backend appears.

## Definition of Done

- All V1 issues complete or intentionally deferred with notes.
- `npm run test:v1:pc` passes.
- App launches on Android Emulator.
- Local APK builds and installs on Android Emulator.
- Core V1 matrix passes or defects are logged.

## Release Gate

Dev-complete gate:
- `npm run test:v1:pc`, Android Emulator app launch, local APK build/install, and `docs/testing/v1-core-flow-test-matrix.md`.

Release-candidate gate:
- production AAB builds, EAS build URL recorded, Play Console internal testing upload ready/manual.

## Release/Build Requirements

- Android package name planned as `com.abdulshaikh.cogvest`.
- EAS profiles documented for development, preview, and production.
- Preview outputs APK.
- Production outputs AAB.
- `EXPO_TOKEN` documented but not committed.

## Local Data/Versioning Impact

V1 establishes the first persisted schema. Optional fields should remain backward-compatible.

## Privacy/Security Notes

Portfolio values, quantities, trades, notes, and conviction stay local. Quote APIs receive only ticker or coin identifiers.

## Known Risks/Deferred Decisions

- Yahoo/CoinGecko informal API reliability.
- Real-time quote source limits.
- Monthly Progress depends on persisted monthly snapshots; missing snapshot support must be logged against the Excel parity issues.
- Export/import deferred creates local-device data loss risk.
