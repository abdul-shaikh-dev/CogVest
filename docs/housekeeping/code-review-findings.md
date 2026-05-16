# CogVest Code Review Findings

Date: 2026-05-06

Status: historical review snapshot. Findings that cite #72 predate PR #78 and
must be re-verified before being treated as current defects.

Review mode: current-state review against V1 MVP, issue #60 Excel parity, and
Android PC verification requirements.

## Findings

### Resolved / Re-verify: Android release APK touch navigation blocked E2E

- Evidence: `npm run maestro:test` fails in `e2e/navigation.yaml` after tapping
  `tab-holdings`; `holdings-screen` never becomes visible.
- Existing issue: #72.
- Later update: PR #78 addressed the Android navigation entrypoint issue and
  merged into `main`.
- Impact: re-run the Maestro navigation/core-flow suite before deciding whether
  any runtime blocker remains.

### Important: Asset metadata is too narrow for Excel parity

- Evidence: `src/types/asset.ts` defines `AssetClass` as
  `crypto | stock | etf | cash`.
- Evidence: `src/features/trades/add-trade-form.tsx` manual asset creation
  defaults every new asset to `assetClass: "stock"`, `currency: "INR"`, and
  `exchange: "NSE"`.
- Impact: #62 cannot close. The app cannot capture instrument type, sector type,
  quote source identifier, or user-selected category without code changes.

### Important: Debt is not first-class

- Evidence: `src/types/asset.ts` has no `debt` asset class.
- Evidence: `src/components/common/Premium.tsx` labels `etf` as `Debt`, which
  conflates ETF/funds with debt instruments.
- Impact: #63 and the #60 equity/debt/crypto/cash gate remain incomplete.

### Important: Monthly Progress is derived-current-month only

- Evidence: `src/features/progress/ProgressScreen.tsx` computes current-month
  investment and cash from trades/cash entries.
- Missing: persisted monthly snapshot model, salary/income, expense rate, monthly
  gain/gain percentage, editable monthly records.
- Impact: #65 is not complete and the Excel `Progression` sheet is not yet
  replaced.

### Resolved: Dashboard action icons appear interactive but have no behavior

- Later update: #75 was verified and closed after `DashboardScreen` wired
  value masking and quote refresh actions with test coverage.

### Resolved: Settings exposes unavailable or non-functional controls

- Later update: #83 aligned Settings rows with real controls, real status, and
  explicit V1-deferred states.

### Resolved: Route naming is inconsistent for Progress

- Later update: #76 normalized the tab route to `app/(tabs)/progress.tsx` and
  removed the duplicate root `app/progress.tsx` route.

### Moderate: Add Holding still stores trade-shaped records

- Evidence: Add Holding uses `Trade` and `addTrade`, with a manual quote upsert.
- Impact: This may be acceptable as an implementation bridge, but #61 asks for
  opening-position semantics. The next implementation should decide whether an
  opening position is a first-class source record or a typed trade variant.

### Moderate: Tests are broad but not enough for Excel parity

- Evidence: Jest has good coverage across current screens/domain/services.
- Gap: No tests for instrument/sector metadata, debt manual assets, monthly
  snapshot persistence, salary/expense rate, or the full Excel parity checklist.
- Impact: #66 remains necessary.

## Recommended Priority

1. Fix #72.
2. Add asset metadata and debt category (#62/#63).
3. Make Add Holding explicitly support opening-position fields (#61).
4. Add consolidated rollups and allocation details (#64).
5. Add monthly snapshots (#65).
6. Add Excel parity checklist and tests (#66).
