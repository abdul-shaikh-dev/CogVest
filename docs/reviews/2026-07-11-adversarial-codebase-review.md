# CogVest Adversarial Codebase Review

**Date:** 2026-07-11

**Status:** Point-in-time stabilization evidence. Use active GitHub issues for
current execution state and rerun cited commands before relying on old results.
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
4. Locally distributed release APKs used the public debug key. Issue #171 adds
   private local release signing and keeps debug signing development-only.

As of 2026-07-21, C1-C4 have merged remediation evidence through issues #161,
#167, #169, and #171. High-severity stabilization remains active; each finding's
status below is authoritative for this review.

## Critical Findings

### C1. Purchases can double-count portfolio wealth

**Status (2026-07-18): Remediated by #161.** Typed cash purposes and atomic
funded-buy/sale commands now conserve tracked wealth and keep opening positions
cash-neutral.

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

**Status (2026-07-19): Remediated by #167.** V1 now rejects unsupported
non-INR assets and quotes before persistence and preserves explicit INR
valuation boundaries.

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

**Status (2026-07-19): Remediated by #169.** Failed refreshes preserve the
cached quote's source and timestamp and expose stale provider state without
inventing a fresh manual quote.

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

**Remediation status (2026-07-19):** Implemented under GitHub issue #169,
pending merge at the time of this update. Refresh now carries complete cached
quote objects rather than numeric values labelled as manual input. A failed
Yahoo or CoinGecko request returns the exact cached quote, preserving price,
currency, source, timestamp, and day-change metadata. Genuine manual quotes
also retain their original timestamp. Dashboard failure copy explicitly says
that last-known prices are shown.

**Remediation evidence:**

- `src/services/quotes/quoteResolver.ts` preserves the cached quote on failure.
- `src/features/dashboard/useDashboard.ts` and
  `src/features/holdings/useHoldings.ts` pass the complete quote cache.
- `src/services/quotes/__tests__/quotes.test.ts` covers Yahoo, CoinGecko,
  genuine manual, debt, and mixed success/failure refresh paths.
- Dashboard and Holdings hook/component tests cover the integration contract
  and user-facing failure state.
- `npm run test:verify` passed with 45 suites and 273 tests.
- A fresh local x86_64 release APK was built, installed on `emulator-5554`, and
  passed `e2e/smoke-launch.yaml`.

### C4. Release APK uses the public debug signing key

**Status (2026-07-19): Remediated by #171 and merged in PR #172.** The durable Expo
config plugin now keeps debug builds on the debug key, requires owner-controlled
credentials for local release tasks, and leaves EAS preview/production builds on
Expo-managed credentials. The actual owner upload key and its expected
certificate fingerprint remain release-candidate operational inputs.

**Impact:** Directly distributed APKs cannot be trusted as production artifacts.
Anyone with the standard debug key could sign an APK accepted as an update to a
debug-signed installation.

**Original evidence:** The generated `android/app/build.gradle` configured the
release build with `signingConfigs.debug` and the standard debug credentials.

**Remediation evidence:**

- `plugins/withPrivateReleaseSigning.js` replaces generated release debug
  signing through Expo prebuild and fails local release tasks clearly when any
  required credential is absent.
- `npm run android:apk:release` failed without credentials and listed all four
  required signing values. It did not leave a stale release APK behind.
- A disposable, one-day local verification keystore produced an x86_64 release
  APK whose certificate subject was `CN=CogVest Verification`, proving that the
  private-signing path replaces the debug certificate. The disposable keystore
  and APK were removed after verification; they are not production credentials.
- A fresh x86_64 debug APK remained signed as `CN=Android Debug`, installed on
  `emulator-5554`, and passed `npm run test:v1:pc`.
- `npm run test:verify` passed 46 suites and 278 tests; Expo Doctor passed 17/17.
- Keystore and credential export patterns are ignored by Git. No EAS build was
  triggered during remediation.

## High-Severity Findings

### H1. Monthly gain includes new contributions

**Status (2026-07-21): Implemented by #173, pending merge.** Monthly performance
now separates total value change, net external flow, and cash-flow-adjusted market
movement. Contribution-only months produce zero market movement, purchase funding
and sale proceeds remain internal transfers, and withdrawals reduce net external
flow. Legacy or ambiguous cash-flow history reports performance as unavailable
instead of presenting a misleading gain.

**Remediation evidence:**

- `src/domain/calculations/monthlyPerformance.ts` owns external-flow
  classification, date weighting, and monthly performance calculations.
- Automatic snapshots persist an explicit performance basis; manual and legacy
  snapshots without reliable flow provenance are marked unavailable.
- Progress summaries and chart insights consume the same domain result, and the
  UI distinguishes `Market change`, `Net contribution`, and total value change.
- Unit, integration, persistence, and component tests cover contributions,
  withdrawals, internal transfers, opening positions, invalid denominators,
  legacy data, value masking, and snapshot rehydration.
- `npm run test:verify` passed 47 suites and 288 tests; Expo Doctor passed 17/17.
- A fresh x86_64 debug APK was built from commit `8c26f69`, installed on
  `emulator-5554`, and verified with strict package smoke plus the Maestro
  launch and navigation flows. Seeded visual QA also confirmed the Progress
  screen renders the distinct `Market change` and `Net contribution` metrics.

### H2. Cash savings metrics mix income, deposits, and sale proceeds

**Status (2026-07-21): Remediated by #161 and #175.** Cash and Progress now use
the same pure monthly metric. Only typed `income` entries form the investment-rate
denominator; capital contributions, sale proceeds, transfers, withdrawals, and
legacy uncategorized additions do not. Missing typed income produces an
unavailable rate instead of zero or a guessed percentage, and any unclassified
legacy addition keeps both income and the rate unavailable until classified.

**Remediation evidence:**

- `calculateCashMonthlyMetrics` owns typed income, monthly investment, and the
  nullable investment rate for both Cash and Progress.
- Linked buy trades and `purchaseFunding` cash movements are matched against all
  buy IDs and counted once in the canonical trade month. Unlinked legacy purchase
  funding remains countable without duplicating a known trade.
- Stored record dates use their calendar month while the active period follows
  the device-local month, avoiding UTC rollover errors around local midnight.
- Cash and Progress use the user-facing label `Investment rate` and render
  `Not enough data` for income and rate when classification is insufficient.
- Domain, hook, and component tests cover income, contribution, sale-proceeds,
  legacy-entry, linked-funded-buy, shared Cash/Progress, and unavailable paths.
- `npm run test:verify` passed 47 suites and 296 tests; Expo Doctor passed 17/17.

### H3. Automation only covers the immediately previous month

**Status (2026-07-22): Remediated by #178.** Snapshot automation now determines
every missing completed month from the earliest opening position, trade, or cash
entry through the last completed month. It processes gaps oldest-first, excludes
the current month, and preserves existing snapshots.

**Remediation evidence:**

- `getMissingCompletedSnapshotMonths` owns deterministic cross-year month
  enumeration and existing-snapshot exclusion.
- `buildGeneratedMonthEndSnapshot` accepts an explicit target month while
  preserving its previous-month default for existing callers.
- Progress automation requests historical prices for each target month, persists
  successful snapshots in order, continues after a non-derivable month, and
  reports a run-level status from the final store state.
- Completed-month selection follows the device-local calendar, explicit target
  months are rejected unless already completed, and fully closed positions do
  not trigger unnecessary historical-price requests.
- Concurrent app, Progress, and review touchpoints share one in-flight run per
  portfolio store, preventing duplicate provider work and competing results;
  callers crossing local month-end wait for that run and then process the newly
  completed month.
- Domain and hook tests cover cross-year enumeration, partial gaps, current-month
  exclusion, no-record behavior, per-month historical lookup, ordered
  persistence, idempotent reruns, preserved existing snapshots, and continuation
  after underivable months, plus local month boundaries, invalid targets, closed
  positions, and concurrent calls.
- `npm run test:verify` passed 47 suites and 310 tests; Expo Doctor passed 17/17.
- Historical fallback confidence and retry semantics remain open under H4 and
  #150; this remediation does not mark estimated prices as final-quality data.

### H4. Historical fallback can permanently store current prices as past values

**Status (2026-07-22): Remediated by #150.** Auto-generated snapshots now store
per-asset price evidence and explicit confirmed/provisional confidence. New
snapshots using latest local, manual, mixed, or unavailable prices remain visibly
provisional and are retried safely rather than appearing final.

**Remediation evidence:**

- Generated metadata records each holding's asset ID, selected price, and price
  basis. Cash-only snapshots are confirmed without fabricating asset evidence.
- Legacy aggregate-only metadata remains readable: historical-only auto snapshots
  infer confirmed confidence, while mixed/fallback/unavailable snapshots infer
  provisional confidence.
- Automation retries auto-generated provisional months that carry per-asset
  evidence, skips confirmed and manually reviewed months, ignores cached fallback
  entries as confirmation, and preserves the existing ID.
- Aggregate-only legacy automation stays visibly provisional but is not rewritten:
  older user corrections cannot be distinguished safely from untouched output.
- A failed or equal-confidence retry leaves the stored snapshot unchanged. A
  candidate replaces it only when confirmed asset coverage improves without
  regressing another asset's evidence.
- Open positions with missing or unsupported asset metadata block snapshot
  confirmation rather than producing an understated portfolio value.
- Monthly Progress names every month whose prices remain estimated, offers calm
  manual-review guidance, and does not claim confirmation while an older
  completed month is still provisional.
- Saving user corrections marks generated metadata manual so later automation
  cannot overwrite reviewed values.
- Domain, persistence, hook, and component tests cover confirmed, mixed,
  fallback, unavailable, cash-only, legacy protection, failed retry, partial
  improvement, per-asset non-regression, full confirmation, cached-fallback
  retry, missing-asset protection, confirmed skip, manual-review protection, and
  month-specific trust copy.
- `npm run test:verify` passed 47 suites and 328 tests; Expo Doctor passed 17/17.
- Precise exchange calendars and broader instrument/provider coverage remain
  outside V1 under the issue's explicit non-goals.

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

## Focused Add Holding Review

The follow-up Add Holding inspection found additional defects beyond the
cross-cutting currency, quote, date, persistence, and duplicate-save findings
above.

### AH1. Provider-selected assets lose provider identity at save time

The lookup result is used to populate the form and fetch a quote, but review/save
does not persist the lookup asset. Unless an existing local asset was selected,
`handleReview` rebuilds the asset through `buildManualAsset`. That path forces
INR/NSE defaults and drops the provider exchange and currency.

**Evidence:**

- `src/features/openingPositions/useAddOpeningPosition.ts:416-450` constructs a
  correct temporary provider asset for quote lookup.
- `src/features/openingPositions/useAddOpeningPosition.ts:472-497` ignores
  `selectedLookupResult` when constructing the reviewed asset.
- `src/features/openingPositions/useAddOpeningPosition.ts:399-413` applies manual
  INR/NSE defaults.

This is the Add Holding entry point for critical finding C2.

### AH2. A live autofilled quote is persisted as manual

After Yahoo or CoinGecko successfully autofills current price, save always writes
a new quote with `source: manual`, `currency: INR`, and the save timestamp. The
provider source, provider timestamp, currency, and day-change fields are lost.
Until the next successful refresh, Settings and holdings can claim the price was
manual even though the user did not enter it.

**Evidence:**

- `src/features/openingPositions/useAddOpeningPosition.ts:450-455` receives the
  provider quote but stores only its price in component state.
- `src/features/openingPositions/useAddOpeningPosition.ts:522-529` recreates the
  saved quote as manual.

**Required direction:** Keep explicit price-source state and persist the original
provider quote unless the user edits the price.

### AH3. Editing an existing asset creates a duplicate asset

Selecting an existing asset correctly reuses its ID only until instrument or
sector metadata is edited. The edit handler clears `selectedAssetId`, and save
then creates a new asset with a new ID. The original asset remains unchanged.
This can create duplicate holding cards for the same ticker.

The current test suite explicitly expects this behavior instead of catching it:

- `src/features/openingPositions/AddOpeningPositionForm.tsx:390-426` clears the
  saved selection on metadata edits.
- `src/features/openingPositions/useAddOpeningPosition.ts:495-520` creates a new
  asset after the selection is cleared.
- `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx:189`
  names the case as persisting an edit but asserts that two assets exist and the
  new position does not use the original ID.

**Required direction:** Make the user choose between updating shared asset
metadata and creating a distinct instrument. Ordinary metadata correction should
update/reuse the existing asset.

### AH4. Provider lookup can duplicate an already-saved asset

Lookup results are not matched against existing assets by provider ID, quote
source ID, exchange+ticker, or another canonical identity. Selecting Yahoo for
an asset already present locally creates another asset record.

**Evidence:**

- `src/services/assetLookup/index.ts:120-138` creates provider identities.
- `src/features/openingPositions/useAddOpeningPosition.ts:431-460` never checks
  them against `snapshot.assets`.
- `src/store/index.ts:182-187` appends assets without uniqueness enforcement.

**Required direction:** Resolve lookup selections to canonical existing assets
before creating new records.

### AH5. Quote-response races can apply the wrong asset's price

`selectLookupResult` has no request token, cancellation, or selected-result check
after awaiting the provider. If the user selects asset A, changes selection, and
selects asset B before A finishes, A's later response can overwrite B's current
price and quote status. A delayed failure can also clear a price the user entered
manually after selection.

**Evidence:** `src/features/openingPositions/useAddOpeningPosition.ts:431-460`.

**Required direction:** Associate each request with the selected provider ID,
ignore stale completions, and abort obsolete requests where supported.

### AH6. Switching assets carries stale position and price state

Changing the selected asset does not clear quantity, average cost, current price,
date, conviction, or notes. Selecting an existing asset with no cached quote also
leaves the previous asset's current price intact because `selectAsset` only sets
price when a quote exists. Editing name, symbol, ticker, quote-source ID, or asset
class after a live lookup can retain the old asset's autofilled current price.

**Evidence:**

- `src/features/openingPositions/useAddOpeningPosition.ts:365-396` changes asset
  identity without resetting position state and conditionally updates price.
- `src/features/openingPositions/AddOpeningPositionForm.tsx:282-334` clears the
  selection on identity edits but not current price.
- `src/features/openingPositions/useAddOpeningPosition.ts:462-469` changes class
  without clearing the old quote-derived price.

**Impact:** A valid-looking review can save one asset using another asset's
price, quantity, cost, or notes.

### AH7. The metadata UI exposes internal enum tokens

Instrument and sector are free-text inputs that require exact internal values
such as `financialServices`, `fixedDeposit`, and `digitalAsset`. Invalid spacing,
capitalization, or user-friendly labels are rejected. There is no selector or
explanation of allowed values.

**Evidence:**

- `src/features/openingPositions/AddOpeningPositionForm.tsx:390-426`.
- `src/domain/assets/metadata.ts:3-30` defines the accepted internal tokens.
- `src/features/openingPositions/openingPositionForm.ts:105-110` rejects anything
  outside those exact arrays.

This makes the supposed assisted-capture step behave like editing a schema.

### AH8. Manual stocks default to Financial Services

The initial stock metadata defaults sector to `financialServices`. A user adding
an energy, technology, healthcare, or consumer stock manually can continue
without changing it, silently storing false sector data.

**Evidence:**

- `src/domain/assets/metadata.ts:54-57`.
- `src/features/openingPositions/useAddOpeningPosition.ts:111-120` initializes
  the form from that default.

**Required direction:** Use `other`/unknown for manual stocks until the user or
provider supplies a sector.

### AH9. Review does not show the fields the user is committing

The final review surface shows only asset name/class and derived invested,
current, P&L, and P&L percentage. It omits ticker, exchange, currency, quantity,
average cost, current price, acquisition date, instrument, sector, conviction,
notes, and price source. Several of these are precisely the fields most likely
to be wrong after lookup or state carryover.

**Evidence:** `src/features/openingPositions/AddOpeningPositionForm.tsx:558-620`.

**Required direction:** Show a compact confirmation summary of identity,
classification, position inputs, source, and derived values before save.

### AH10. Save is non-atomic and post-save haptics can mask success

Add Holding separately writes the asset, opening position, and quote. A failure
between writes leaves partial state. Persistence finishes before awaiting
haptics; if haptics rejects, the data is already saved but the success state and
save lock are not applied, encouraging retry and duplication.

**Evidence:** `src/features/openingPositions/useAddOpeningPosition.ts:513-532`.

**Required direction:** Persist the complete opening-position command atomically,
disable save during execution, and treat haptics as a non-critical side effect.

### AH11. Local date default is wrong during early IST hours

The default acquisition date is derived with `new Date().toISOString()`, which is
UTC. In India between midnight and 05:29, it defaults to the previous calendar
day.

**Evidence:** `src/features/openingPositions/useAddOpeningPosition.ts:51-53`.

Use a local-calendar formatter rather than slicing a UTC timestamp.

### AH12. Search and existing-asset lists do not scale

Every existing asset is rendered before the search form, and every CoinGecko
result is appended after Yahoo results without ranking, deduplication, grouping,
or a display cap. Large portfolios or broad crypto searches can turn the first
step into a long, noisy screen.

**Evidence:**

- `src/features/openingPositions/AddOpeningPositionForm.tsx:170-198`.
- `src/services/assetLookup/index.ts:227-251`.
- `src/features/openingPositions/AddOpeningPositionForm.tsx:241-270`.

### AH13. The post-save state is a dead-end confirmation

After save, the controller stays in the Review phase, removes the review
position, and shows a success message. The preview disappears and Save becomes
disabled, but there is no `View holding`, `Return to Holdings`, or `Add another`
action. The user must infer that Android Back is the completion action.

**Evidence:**

- `src/features/openingPositions/useAddOpeningPosition.ts:530-533`.
- `src/features/openingPositions/AddOpeningPositionForm.tsx:623-681`.

### AH14. The lookup E2E proves completion, not correctness

The Maestro flow finds `BTC-USD`, selects it, and saves, but never verifies the
saved asset's currency, exchange, quote source, price, holding value, or absence
of duplicates. It also enters `110` into an already-autofilled current-price
field without first clearing that field, so the actual saved value may be an
appended number.

**Evidence:** `e2e/add-holding-lookup.yaml`.

The flow passed on the emulator during this review, demonstrating that these
semantic defects are invisible to the current E2E acceptance criteria.

## Complete Remediation Matrix

This matrix is the implementation contract for resolving every finding in this
review. Each row should become either a focused GitHub issue or an explicit
acceptance criterion in its owning issue. Findings should not be closed merely
because the UI changed; the verification column must have evidence.

### Critical Findings

| ID | Required fix | Minimum verification |
| --- | --- | --- |
| C1 | Define typed cash movements and an atomic investment-funding command. A cash-funded buy reduces deployable cash exactly once; externally funded opening positions are explicitly marked and do not imply a cash outflow. | Accounting invariant tests prove that deposits, purchases, sales, withdrawals, and market movement conserve total wealth. Emulator flow verifies displayed cash and portfolio totals after a funded purchase. |
| C2 | Preserve provider currency and exchange. Add an explicit FX conversion layer with source and timestamp, or reject unsupported foreign holdings in V1. Never aggregate a foreign numeric quote directly into INR totals. | USD lookup/save test retains USD; mixed-currency aggregation either converts using a fixture FX quote or returns a clear unsupported state. Maestro verifies the saved asset currency and displayed INR value. |
| C3 | Store user-entered manual prices separately from provider quotes. On provider failure, preserve the cached quote's original source and timestamp and mark it stale instead of rebuilding it as fresh manual data. | Failure-after-success tests verify unchanged source/time, explicit stale state, and partial portfolio freshness. |
| C4 | Replace debug release signing with a private release-keystore workflow. Keep credentials outside Git and inspect every distributed APK signature. | `apksigner verify --print-certs` shows the expected release certificate; release build fails clearly when signing secrets are absent. |

### High-Severity Findings

| ID | Required fix | Minimum verification |
| --- | --- | --- |
| H1 | Separate contribution, withdrawal, total value change, market movement, realized P&L, and unrealized P&L. Rename any metric that is not true gain. | Adding capital with unchanged prices produces zero market gain; contribution and value-change figures remain correct. |
| H2 | Add cash-entry purpose/category so income, contribution, transfer, sale proceeds, and withdrawal are distinct. Calculate savings rate from typed income only. | Sale proceeds and broker transfers do not increase salary or savings rate; income fixtures do. |
| H3 | Find every missing completed month from the earliest portfolio record through the previous completed month and generate in chronological order. | Tests backfill multiple consecutive gaps, skip existing months, and remain idempotent across repeated app launches. |
| H4 | Persist per-asset historical-price confidence. Current/local fallback creates a provisional snapshot, not a finalized historical fact, and is retried later. | Historical failure produces a visible provisional state; a later successful lookup upgrades the same month without duplication. |
| H5 | Do not persist salary as known zero. Derive salary only from typed income records or leave it unknown; omit dependent rates when unknown. | Generated snapshots distinguish unknown from zero and do not display false zero-income conclusions. |
| H6 | Validate MMKV payloads at runtime, migrate explicitly, preserve corrupt raw data, and show a recoverable startup state instead of silently returning an empty portfolio. | Corrupt JSON, unknown schema, and failed migration fixtures retain recoverable data and never masquerade as a new empty portfolio. |
| H7 | Add atomic store commands for linked financial operations, beginning with sell/redeem plus proceeds. Persist once and roll back or fail before mutation. | Fault injection between logical writes cannot create a trade without its required linked cash movement. |
| H8 | Add command IDs, uniqueness constraints, and `isSaving` guards. Repeated taps must return the original result or be rejected. | Double-tap tests create exactly one asset, position, trade, cash entry, and quote. |
| H9 | Introduce one strict local-calendar date parser. Reject impossible dates and inappropriate future dates, and ensure selectors ignore records not yet effective. | Tests cover leap years, `2026-02-30`, future dates, timezone boundaries, and midnight IST. |
| H10 | Add review/edit/delete flows for cash entries, opening positions, trades, assets, and snapshots. Define cascade impact before asset deletion. | Correction tests recalculate every downstream total; destructive actions require confirmation and leave no orphan records. |

### Medium-Severity Findings

| ID | Required fix | Minimum verification |
| --- | --- | --- |
| M1 | Compute freshness per required holding and summarize the oldest/stale/missing state rather than selecting the newest quote. | One fresh and one stale asset reports partial/stale portfolio status. |
| M2 | Add provider deadlines, request cancellation, bounded concurrency, and partial completion. | Fake timers prove a hung provider cannot block all assets indefinitely and successful assets still update. |
| M3 | Map only explicitly supported Yahoo `quoteType` values. Reject or label mutual funds, indices, futures, and currencies until their domain handling exists. | Provider mapping table tests every supported and rejected quote type. |
| M4 | Represent negative cash explicitly in allocation or surface it as a data-integrity/liability state instead of hiding it. | Negative-balance fixtures remain visible and allocation totals remain mathematically explainable. |
| M5 | Decide the local-first privacy contract. Disable Android backup if records must remain only on the device; otherwise disclose backup accurately. Decide whether MMKV encryption is required. | Manifest test checks backup policy; privacy copy matches configuration; encrypted-storage migration is tested if adopted. |
| M6 | Remove external-storage and overlay permissions unless a documented runtime dependency proves they are required. | Release manifest inspection contains only approved permissions and app smoke tests still pass. |
| M7 | Establish preview and production versioning with monotonic `versionCode`, meaningful `versionName`, and build metadata. | Upgrade installation succeeds from the previous signed APK and version information is recorded in release evidence. |
| M8 | Compile the destructive visual-QA route out of release builds or require a non-public development-only capability. Never permit it to overwrite real data silently. | Release deep-link test cannot seed; development seeding requires explicit confirmation and isolated test storage. |
| M9 | Define money and quantity precision. Prefer integer minor units for currency and a decimal-safe representation for fractional quantities and weighted cost. | Property/invariant tests cover repeated fractional crypto operations, fees, and rounding boundaries. |

### Add Holding Findings

| ID | Required fix | Minimum verification |
| --- | --- | --- |
| AH1 | Carry the selected provider candidate through review/save and preserve provider identity, currency, exchange, ticker, and quote source. | Lookup-save test asserts the complete persisted asset, not only visible form text. |
| AH2 | Track price value, provider, currency, timestamp, and `wasEdited`. Persist the original provider quote unless the user edits the value; then explicitly persist a manual quote. | Tests distinguish untouched autofill from user-edited price and verify Settings source labels. |
| AH3 | Keep existing asset identity during metadata correction. Update/reuse the existing asset unless the user explicitly chooses to create a separate instrument. | Editing sector retains the same asset ID and asset count. |
| AH4 | Resolve lookup candidates against existing assets by provider ID first and exchange+ticker fallback. Enforce the same uniqueness rule in the store. | Searching and selecting an existing HDFC or Bitcoin asset creates a new position but no duplicate asset. |
| AH5 | Add request IDs or abort controllers and ignore quote completions that do not match the current selected candidate. | Deferred A/B quote tests complete in both orders and B always retains B's price/status. |
| AH6 | Centralize `selectCandidate`, `changeAsset`, and `switchToManualEntry` transitions. Reset stale position and quote state according to an explicit policy. | Switching assets after completing position fields cannot retain the prior asset's price, quantity, cost, conviction, or notes. |
| AH7 | Replace internal enum text fields with user-facing selectors. Automate reliable metadata and show selectors only for unknown/low-confidence fields. | UI never requires typing `financialServices`; selector labels map correctly to persisted enum values and remain accessible. |
| AH8 | Leave manual stock sector unknown rather than defaulting to Financial Services. Do not silently normalize missing sector into a factual value. | Manual technology/energy stock starts unknown and can save without false Financial Services metadata. |
| AH9 | Expand final review to show identity, classification, position inputs, quote source/time, optional behavior fields, and derived values, with Edit actions. | Component and visual tests assert every persisted field is visible or explicitly summarized before save. |
| AH10 | Add one idempotent atomic `saveOpeningPosition` command. Disable Save while running and make haptics non-critical. | Storage and haptics failure tests prove no partial or duplicate save and accurate success messaging. |
| AH11 | Generate the default acquisition date from the local calendar rather than UTC slicing. | Fake-clock tests around 00:00-05:29 IST produce the correct local date. |
| AH12 | Rank exact/existing matches first, group providers, deduplicate, cap displayed results, and search/filter existing holdings instead of rendering an unbounded chip grid. | Search tests verify ranking/deduplication/caps; a large seeded portfolio remains usable on emulator. |
| AH13 | Replace the dead-end state with `View holding`, `Add another`, and `Return to Holdings`; default to a clear completion path. | Maestro saves, opens the resulting holding, returns, and adds another without stale state. |
| AH14 | Rewrite lookup E2E to clear autofilled fields before manual replacement and assert persisted ticker, currency, source, quantity, invested/current values, and duplicate absence. | Maestro fails when any semantic result is wrong, rather than passing on success copy alone. |

## Approved Add Holding Metadata Contract

The product decision is to minimize user input through API-derived metadata with
confidence-aware fallback.

### Derive automatically when confidence is high

- asset class;
- instrument type;
- exchange;
- currency;
- symbol and ticker;
- quote-provider ID;
- current price and price source.

Examples include Yahoo `EQUITY` to Stock, Yahoo `ETF` to ETF, `.NS` to NSE,
`.BO` to BSE, and CoinGecko results to Crypto. Unsupported provider instrument
types must be rejected or marked unsupported rather than coerced to Stock.

### Keep optional and reviewable when confidence is lower

- business sector and industry;
- debt subtype;
- ETF category;
- crypto category or network.

Yahoo's current search response does not reliably provide equity sector. Sector
must therefore remain unknown unless a reliable enrichment response or the user
supplies it. CoinGecko categories must not be treated as equity business sectors.

### Confidence model

```ts
type MetadataConfidence = "provider" | "inferred" | "unknown";

type DerivedMetadata<T> = {
  confidence: MetadataConfidence;
  value?: T;
};
```

High-confidence fields should be applied automatically and collapsed into a
readable summary. Unknown fields should not block saving. The UI may offer
`Choose later` and an optional user-facing selector. Internal tokens such as
`financialServices` must never be exposed as required text input.

The normal journey should be:

1. Search.
2. Explicitly select a result.
3. Review only unresolved metadata when necessary.
4. Enter quantity and average cost.
5. Review the complete record.
6. Save atomically.

## Stabilization Delivery Plan

The remediation should be managed under one `V1 Adversarial Stabilization`
milestone with focused issues and one implementation concern per PR.

### Stage 0: Correctness contracts

Before changing UI, write and approve contracts for:

- cash and investment accounting;
- contribution-adjusted performance;
- canonical asset identity;
- currency and FX support;
- quote provenance/freshness;
- snapshot confidence/backfill;
- persistence recovery and atomicity.

### Stage 1: Financial correctness

1. Cash/investment conservation and typed cash movements: C1, H2.
2. Contribution-adjusted performance and savings semantics: H1, H5.
3. Money/quantity precision policy: M9.

No later stage may rely on the old cash or gain semantics.

### Stage 2: Asset, currency, and quote trust

1. Canonical asset identity and duplicate prevention: AH1, AH3, AH4.
2. Currency preservation and V1 foreign-asset policy: C2.
3. Quote provenance, freshness, timeout, and concurrency: C3, M1, M2, M3.

### Stage 3: Add Holding stabilization

1. API metadata enrichment and selectors: AH7, AH8, approved metadata contract.
2. Selection transitions and stale-response protection: AH5, AH6, AH11, AH12.
3. Atomic/idempotent save: AH10, H8.
4. Complete review and completion UX: AH9, AH13.
5. Correctness-focused E2E: AH14.

### Stage 4: Snapshot correctness

1. Multi-month backfill: H3.
2. Provisional historical-price confidence and retry: H4.
3. Correct generated income/performance semantics: H5 and H1 integration.

### Stage 5: Persistence and correction

1. Validated storage, migrations, and recovery: H6.
2. Atomic sell/redeem and other linked commands: H7.
3. Edit/delete/cascade flows: H10.
4. Strict effective-date behavior across every record type: H9.

### Stage 6: Android privacy and release hardening

1. Backup/encryption privacy contract: M5.
2. Permission minimization and visual-QA isolation: M6, M8.
3. Private signing and monotonic versioning: C4, M7.
4. Dependency remediation described below.

### Stage 7: Final adversarial gate

V1 is not stabilized until:

- every matrix row has automated evidence or a documented manual release check;
- accounting invariants pass;
- a fresh signed APK is installed as an upgrade on the emulator;
- Maestro validates stored outcomes, not only navigation/success messages;
- privacy, permissions, signing, and version evidence is recorded;
- specs, design baseline, AGENTS.md, and testing documents match shipped
  behavior.

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

The contradictions found during this review were resolved in the July
documentation cleanup:

- Cash documentation exposes deposit and withdrawal while requiring explicit
  linked accounting for investment funding and sale proceeds.
- V1 stored monthly-snapshot trends are distinguished from deferred advanced
  per-asset market-price history.
- Dated issue-closeout reports and historical implementation plans are no
  longer treated as current contracts.

The accounting and snapshot findings elsewhere in this report remain open until
their active issues and current tests prove otherwise.

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
