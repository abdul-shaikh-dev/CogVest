# CogVest Adversarial Codebase Review

**Date:** 2026-07-11
**Scope:** V1 application code, financial calculations, quote services, persistence,
monthly snapshots, Android release configuration, automated tests, E2E coverage,
dependencies, and current documentation.
**Assessment:** Not release-ready.

## Executive Summary

CogVest has a mature V1 interface and a substantial automated test suite, but
several underlying defects can misstate portfolio value, gains, cash, quote
freshness, and historical snapshots. The current tests mostly confirm the
implemented behavior rather than independently proving financial correctness.

The highest-risk problems are:

1. Purchases do not automatically reduce cash and can double-count wealth.
2. Foreign assets can be saved and valued as INR without currency conversion.
3. Failed live quote refreshes can relabel stale cached prices as fresh manual
   prices.
4. Locally distributed release APKs are signed with the public debug key.

These should be resolved before treating CogVest as a trustworthy replacement
for the Excel tracker.

## Critical Findings

### C1. Purchases can double-count portfolio wealth

**Impact:** Portfolio value, deployable cash, allocation, and savings metrics can
all be materially overstated.

Buying a holding increases holdings value but does not reduce cash. For example,
a Rs 1,00,000 cash deposit followed by an Rs 80,000 purchase can produce a total
portfolio value of Rs 1,80,000 unless the user separately records a withdrawal.
The Cash Ledger simultaneously describes the purchase as money moved into
investments even though no cash movement was persisted.

**Evidence:**

- `src/domain/calculations/holdings.ts:211-218` derives cash exclusively from
  cash additions and withdrawals.
- `src/domain/calculations/holdings.ts:244-260` derives invested value from buys
  and opening positions without applying it to cash.
- `src/domain/calculations/holdings.ts:264-273` adds the unchanged cash balance to
  holdings value.
- `src/features/cash/CashScreen.tsx:169-182` presents the derived investment and
  savings figures as cash-ledger metrics.

**Required direction:** Establish one explicit accounting contract. Investment
transactions funded from tracked cash must create an atomic linked cash movement,
or the UI must clearly distinguish external holdings from cash-funded holdings.

### C2. Foreign assets are valued as INR without currency conversion

**Impact:** Any USD or other foreign holding can corrupt portfolio totals,
allocation, P&L, and monthly history.

Yahoo lookup identifies non-NSE/BSE symbols as USD, but the Add Holding flow
rebuilds selected lookup results as INR/NSE. Yahoo current and historical quote
services also hardcode the quote currency to INR. There is no FX conversion
layer before INR-first portfolio aggregation.

**Evidence:**

- `src/services/assetLookup/index.ts:92-94` classifies non-Indian Yahoo symbols as
  USD.
- `src/features/openingPositions/useAddOpeningPosition.ts:399-405` rebuilds the
  selected result as INR and NSE.
- `src/features/openingPositions/useAddOpeningPosition.ts:513-530` persists the
  quote as INR.
- `src/services/quotes/yahooFinance.ts:63-79` ignores Yahoo's currency metadata
  and emits INR.
- `src/services/quotes/historicalPrices.ts:163-170` emits Yahoo historical closes
  as INR.

**Required direction:** Preserve provider currency and exchange, add an explicit
FX conversion contract, and reject unsupported currencies until conversion data
is available.

### C3. Stale live quotes can be disguised as fresh manual prices

**Impact:** Users can be told prices are current or manually confirmed when
neither is true.

Every cached quote is passed into refresh as a manual fallback, including Yahoo
and CoinGecko quotes. When a provider request fails, the cached value is rebuilt
as a manual quote using the current timestamp. This destroys the original source
and age.

**Evidence:**

- `src/features/dashboard/useDashboard.ts:121-127` maps every cached quote to a
  manual price.
- `src/features/dashboard/useDashboard.ts:185-197` supplies those values during
  live refresh.
- `src/features/holdings/useHoldings.ts:66-72` repeats the same behavior.
- `src/services/quotes/quoteResolver.ts:38-45` converts the fallback to a manual
  quote.

**Required direction:** Store manual prices separately from provider cache.
Fallback must preserve original source and timestamp and expose explicit stale
status.

### C4. Release APK uses the public debug signing key

**Impact:** Directly distributed APKs cannot be trusted as production artifacts.
Anyone with the standard debug key could sign an APK accepted as an update to a
debug-signed installation.

**Evidence:** `android/app/build.gradle:100-115` configures the release build with
`signingConfigs.debug` and the standard debug credentials.

**Required direction:** Add a private release keystore workflow, keep secrets out
of Git, and make release signing a release-candidate gate.

## High-Severity Findings

### H1. Monthly gain includes new contributions

`monthlyGain` is calculated as current portfolio value minus previous portfolio
value. Monthly investment is not removed, so adding capital appears as investment
performance.

**Evidence:** `src/domain/calculations/holdings.ts:395-438`.

**Required direction:** Separate net contribution, market movement, realized
movement, and total value change. Do not label total value change as gain.

### H2. Cash savings metrics mix income, deposits, and sale proceeds

Every cash addition is used as the savings-rate denominator. Deposits, broker
transfers, emergency-fund movements, and linked redemption proceeds therefore
behave like salary/income. Sell proceeds can inflate both cash added and savings
rate.

**Evidence:**

- `src/domain/calculations/holdings.ts:230-261`.
- `src/features/sellRedeem/useSellRedeemHolding.ts:274-283` records linked sale
  proceeds as a generic addition.

**Required direction:** Add cash-entry purpose/category or model income,
contributions, transfers, withdrawals, and sale proceeds as distinct movement
types.

### H3. Automation only covers the immediately previous month

The generator computes one target month using `getPreviousCompletedMonth`. If the
app remains unopened for several months, older gaps are not backfilled.

**Evidence:**

- `src/domain/calculations/monthEndSnapshots.ts:210-226`.
- `src/features/progress/useMonthEndSnapshotAutomation.ts:20-31` runs the process
  once per mount.

**Required direction:** Determine every missing completed month from the earliest
portfolio record through the last completed month, then process them in order.

### H4. Historical fallback can permanently store current prices as past values

When a historical lookup fails, snapshot generation uses the latest cached quote
or opening-position price. The snapshot is then persisted and not regenerated
automatically. Debt assets always use fallback because historical debt lookup is
unsupported.

**Evidence:**

- `src/domain/calculations/monthEndSnapshots.ts:161-207`.
- `src/domain/calculations/monthEndSnapshots.ts:342-386`.
- `src/services/quotes/historicalPrices.ts:250-261`.

**Required direction:** Do not silently finalize estimated history. Persist
confidence per asset, make estimated snapshots visibly provisional, and retry
historical resolution.

### H5. Automatic snapshots always set salary to zero

Savings and expense rates become unavailable for generated snapshots, even when
cash additions exist. Generic additions cannot safely be assumed to be salary.

**Evidence:** `src/domain/calculations/monthEndSnapshots.ts:353-386`.

**Required direction:** Either capture typed income records or explicitly omit
salary-dependent metrics from automatic snapshots.

### H6. Persistence failures can look like complete data loss

Malformed MMKV JSON throws during startup. Unsupported or absent schema versions
silently return a completely empty portfolio. There is no quarantine, migration
failure state, recovery copy, or user-visible warning.

**Evidence:**

- `src/services/storage/index.ts:47-65` parses raw JSON without recovery.
- `src/store/index.ts:100-123` silently replaces unsupported snapshots with an
  empty portfolio.

**Required direction:** Validate persisted payloads, preserve the raw corrupt
value, show a recoverable error, and test migration failures.

### H7. Multi-record financial operations are not atomic

Sell/redeem first persists a trade and then separately persists an optional cash
entry. An interruption or write failure can save only one side. The linked cash
amount can also be edited independently from calculated net proceeds.

**Evidence:** `src/features/sellRedeem/useSellRedeemHolding.ts:222-284`.

**Required direction:** Add an atomic store operation for linked financial
records and enforce or explicitly explain cash/proceeds variance.

### H8. Rapid repeated taps can duplicate records

Add Holding, cash entry, and sell/redeem do not use an in-flight save guard. Store
append operations do not enforce unique IDs. Multiple taps before rerender can
persist duplicate assets, positions, trades, or cash entries.

**Evidence:**

- `src/features/openingPositions/useAddOpeningPosition.ts:513-530`.
- `src/features/cash/CashScreen.tsx:126-145`.
- `src/features/sellRedeem/useSellRedeemHolding.ts:246-284`.
- `src/store/index.ts:182-206`.

### H9. Future-dated and impossible dates can affect current totals

Cash, opening positions, and sell/redeem only verify that JavaScript can parse a
date. Future cash entries immediately alter current balance; future positions
immediately appear in current holdings. JavaScript can normalize impossible
dates such as `2026-02-30` instead of rejecting them.

**Evidence:**

- `src/features/cash/CashScreen.tsx:34-65`.
- `src/features/openingPositions/openingPositionForm.ts:57-63`.
- `src/features/sellRedeem/useSellRedeemHolding.ts:205-209`.

**Required direction:** Use strict calendar-date parsing and apply a consistent
future-date policy. Current-state selectors must ignore records not yet effective.

### H10. Users cannot practically correct most financial records

The store exposes update/remove methods, but the app has no user-facing edit or
delete flow for cash entries, opening positions, or trades. Removing an asset
also leaves its trades, positions, and quote caches orphaned.

**Evidence:**

- `src/store/index.ts:214-248`.
- No corresponding correction actions are exposed in `src/features/cash`,
  `src/features/holdings`, or the sell/redeem UI.

**Required direction:** Add correction flows with review/confirmation and define
cascade behavior for asset removal.

## Medium-Severity Findings

### M1. Portfolio quote freshness uses the newest quote

One recently refreshed asset can make the portfolio appear current while other
holdings are stale.

**Evidence:**

- `src/features/dashboard/useDashboard.ts:93-109`.
- `src/features/holdings/useHoldings.ts:75-79`.

Use the oldest required quote, counts by freshness bucket, or explicit partial
freshness.

### M2. Quote refresh is sequential and has no timeout

Assets are refreshed one by one. A stalled request can block the entire refresh,
and larger portfolios will refresh slowly.

**Evidence:** `src/services/quotes/quoteResolver.ts:48-82`.

Add request deadlines, cancellation, bounded concurrency, and partial completion.

### M3. Yahoo lookup maps all non-ETF results to stock

Mutual funds, indices, futures, currencies, and unsupported instruments can be
saved under the stock domain type.

**Evidence:** `src/services/assetLookup/index.ts:100-138`.

Use an explicit supported `quoteType` mapping and reject unsupported result
types.

### M4. Negative cash is hidden from allocation

Cash is included in allocation only when the balance is positive. An overdraft or
data error therefore disappears from allocation while still reducing portfolio
value.

**Evidence:** `src/domain/calculations/holdings.ts:301-333`.

### M5. Local-only privacy messaging conflicts with Android backup

The manifest enables Android backup while Settings says portfolio records stay
on the device. MMKV is also created without an encryption key.

**Evidence:**

- `android/app/src/main/AndroidManifest.xml:14`.
- `src/services/storage/index.ts:39-45`.
- `src/features/settings/SettingsScreen.tsx:99-134`.

Disable backup for portfolio data or state the backup behavior accurately. Decide
whether at-rest encryption is required by the product's privacy promise.

### M6. Android manifest contains unnecessary-looking permissions

`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and `SYSTEM_ALERT_WINDOW` are
present without an evident V1 requirement. They undermine least privilege and
may complicate Play review.

**Evidence:** `android/app/src/main/AndroidManifest.xml:2-6`.

### M7. Android release identity is not ready for updates

`versionCode` remains 1 and `versionName` remains 1.0.0. Successive distributed
builds are indistinguishable and cannot follow proper Android upgrade ordering.

**Evidence:** `android/app/build.gradle:91-96` and `app.json:21`.

### M8. Visual-QA route can erase development data

In development, the seed route is permitted without a token and replaces the
local portfolio. A development build containing real records can be erased by
opening the route.

**Evidence:**

- `src/testing/visualQaSeed.ts:17-25`.
- `app/visual-qa-seed.tsx:11-23`.

### M9. Financial calculations use binary floating-point numbers

Quantities, prices, fees, cost basis, and currency totals all use JavaScript
`number`. Fractional crypto quantities and repeated operations can accumulate
rounding drift.

**Required direction:** Define precision and rounding rules at domain boundaries,
prefer integer minor units for currency, and add invariant/property tests.

## Dependency Audit

`npm audit --json` reported:

| Severity | Count |
| --- | ---: |
| Critical | 1 |
| High | 3 |
| Moderate | 16 |
| Low | 1 |
| Total | 21 |

The critical `shell-quote` advisory enters through React Native developer tools.
The high findings include `form-data`, `undici`, and `ws`, largely through Expo,
React Native, or Jest tooling. The audit's suggested Expo downgrade is not an
acceptable automatic fix because it would break the SDK 54 stack.

**Required direction:** Inspect safe lockfile-level upgrades and overrides first,
then track framework-bound findings with their runtime/build-time exposure. Do
not force-downgrade Expo merely to produce a zero count.

## Documentation Drift

The current documentation contains contradictory or obsolete behavior:

- `docs/cogvest-master-spec.md:56` and
  `docs/design/v1-screen-baseline.md:226` describe manual investment transfers.
- `docs/testing/issue-110-ui-parity-qa.md:35` claims the Cash Ledger contains an
  investment-transfer mode.
- The current implementation and issue #126 plan intentionally expose only
  deposit and withdrawal, deriving invested value separately.
- `AGENTS.md:16-25` says historical charts belong to V3 and are forbidden in V1,
  while V1 now includes monthly-snapshot charts. The intended distinction between
  stored monthly trends and advanced per-asset historical market charts is not
  stated clearly enough.
- Snapshot specifications refer broadly to missing completed-month snapshots,
  but implementation only creates the immediately previous month.

Documentation should be corrected only after the accounting and snapshot
contracts are settled.

## Verification Results

### Passed

`npm run test:verify` completed successfully:

- TypeScript typecheck passed.
- 44 Jest suites passed.
- 253 Jest tests passed.
- Expo Doctor passed 17 of 17 checks.

### Dependency Audit

`npm audit --json` completed with a non-zero status because it found 21
vulnerabilities, summarized above.

### Not Run During This Review

- Android emulator Maestro E2E.
- Fresh APK installation and runtime log inspection.
- Destructive storage-corruption testing against a real MMKV database.
- Network fault injection against Yahoo Finance and CoinGecko.

## Test Gaps

The suite needs adversarial tests for:

1. Accounting conservation when cash funds a purchase.
2. Deposit, income, transfer, sale-proceeds, and investment distinctions.
3. USD quote preservation and INR conversion.
4. Mixed-currency portfolio aggregation rejection or conversion.
5. Stale live quote fallback without changing source or timestamp.
6. Partial refresh with mixed quote ages.
7. Provider timeout, cancellation, bounded concurrency, and partial success.
8. Multiple missing snapshot months.
9. Historical lookup failure and provisional snapshot behavior.
10. Debt snapshot pricing.
11. Contribution-adjusted monthly performance.
12. Corrupt JSON, invalid schema, and failed migrations.
13. Failed persistence during linked trade/cash writes.
14. Duplicate button taps and duplicate IDs.
15. Future dates, leap years, impossible dates, and timezone boundaries.
16. Editing/deleting records and asset-removal cascades.
17. Android release signing, version increments, permissions, and backup policy.
18. Sell/redeem, snapshot automation, and correction flows in Maestro E2E.

## Recommended Remediation Order

### Phase 1: Financial correctness

1. Define the cash-to-investment accounting contract.
2. Separate contribution from investment performance.
3. Define cash-entry categories and savings-rate semantics.
4. Preserve currency and add or constrain FX conversion.

### Phase 2: Quote and snapshot trust

1. Separate manual prices from provider cache.
2. Preserve quote source and age on failure.
3. Add timeout and partial-refresh behavior.
4. Backfill all missing months and mark estimated snapshots provisional.

### Phase 3: Data integrity

1. Add strict persisted-data validation and recovery.
2. Add atomic multi-record store actions.
3. Add save guards and uniqueness checks.
4. Add strict date validation and correction flows.

### Phase 4: Release hardening

1. Configure private release signing and version management.
2. Resolve the Android backup/privacy contract.
3. Remove unnecessary permissions.
4. Triage dependency advisories without breaking Expo compatibility.

### Phase 5: Verification and documentation

1. Add the adversarial test matrix above.
2. Run fresh APK and Maestro verification on the emulator.
3. Reconcile specs, design baseline, testing claims, and AGENTS.md.

## Release Recommendation

Do not treat the current V1 APK as a trusted portfolio tracker or release
candidate until C1-C4 and H1-H9 are resolved or explicitly constrained with
clear user-facing behavior. Visual polish should remain secondary to financial
correctness, provenance, and recoverability.
