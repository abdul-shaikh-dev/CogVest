# CogVest Code Review Findings

Date: 2026-05-06

Review mode: current-state review against V1 MVP, issue #60 Excel parity, and
Android PC verification requirements.

## Findings

### Critical: Android release APK touch navigation blocks E2E

- Evidence: `npm run maestro:test` fails in `e2e/navigation.yaml` after tapping
  `tab-holdings`; `holdings-screen` never becomes visible.
- Existing issue: #72.
- Impact: PC-only E2E cannot prove core manual flows. V1 dev-complete should
  remain blocked.
- Likely area to inspect first: `app/(tabs)/_layout.tsx`, tab route naming,
  release APK navigation behavior, and any overlays/touch handling around
  `ScreenContainer`.

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

### Important: Dashboard action icons appear interactive but have no behavior

- Evidence: `src/features/dashboard/DashboardScreen.tsx` renders value-visibility
  and refresh `IconButton`s without `onPress`.
- Evidence: `src/components/common/Premium.tsx` always renders `IconButton` as a
  button-like `Pressable`.
- Impact: Users can tap visible controls that do nothing. This should either be
  wired to masking/quote refresh or rendered as non-interactive status affordance.

### Important: Settings exposes unavailable or non-functional controls

- Evidence: `src/features/settings/SettingsScreen.tsx` should be reviewed before
  V1 dev-complete for any rows that look toggleable but are only static.
- Impact: Settings is supposed to build local-first trust. Unsupported controls
  should be explicitly marked unavailable, locked, or informational.

### Moderate: Route naming is inconsistent for Progress

- Evidence: `app/(tabs)/history.tsx` renders `ProgressScreen`, while the tab title
  and test ID are `Progress`.
- Evidence: `app/progress.tsx` also renders `ProgressScreen` outside the tab
  group.
- Impact: The UI says Progress, but the tab route remains `history`. This can
  confuse E2E, docs, deep links, and future implementation work.

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
